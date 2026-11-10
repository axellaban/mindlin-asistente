#!/usr/bin/env bash
# Servidor del asistente comercial de Mindlin: WhatsApp (WAHA) + la bandeja del equipo (Chatwoot),
# con HTTPS (Caddy). Todo en Docker, en una carpeta: /opt/mindlin-asistente.
#
# Uso, como root en el servidor (Ubuntu 22.04 o 24.04, 4 GB de RAM o más; con menos de 6 GB
# suma 2 GB de swap y baja los hilos de Chatwoot para que entre todo):
#
#   bash servidor.sh instalar     Instala Docker si falta, genera las claves y levanta todo.
#   bash servidor.sh verificar    Revisa que todo ande y dice qué falta.
#   bash servidor.sh conectar     Crea una línea de WhatsApp conectada a una bandeja de Chatwoot.
#   bash servidor.sh bot          Conecta el asistente (Agent Bot) a una bandeja de Chatwoot.
#   bash servidor.sh claves       Muestra el usuario y la clave del panel de WAHA.
#   bash servidor.sh respaldo     Guarda una copia de las bases (Chatwoot y WAHA) en respaldos/.
#   bash servidor.sh actualizar   Baja las versiones fijadas en este archivo y reinicia.
#   bash servidor.sh estado       Muestra los contenedores.
#
# Las claves se generan solas y quedan en /opt/mindlin-asistente/.env (solo root puede leerlo).
# Nunca hace falta copiarlas a ningún chat.

set -euo pipefail

DIR="${MINDLIN_DIR:-/opt/mindlin-asistente}"
# Versiones fijadas: se probaron juntas. Para actualizar, se cambian acá y se corre «actualizar».
IMAGEN_CHATWOOT="${CHATWOOT_IMAGEN:-chatwoot/chatwoot:v4.19.1}"
IMAGEN_WAHA="${WAHA_IMAGEN:-devlikeapro/waha:gows-2026.10.1}"
# Puertos solo para el propio servidor (127.0.0.1): los usa este script y sirven para un túnel SSH.
PUERTO_CHATWOOT="${PUERTO_CHATWOOT:-3109}"
PUERTO_WAHA="${PUERTO_WAHA:-3100}"

ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
mal() { printf '  \033[31m✗\033[0m %s\n' "$*"; }
info() { printf '\n\033[1m%s\033[0m\n' "$*"; }
morir() { printf '\n\033[31mNo se pudo seguir:\033[0m %s\n' "$*" >&2; exit 1; }

clave() { openssl rand -hex "${1:-24}"; }

compose() { docker compose --project-directory "$DIR" -f "$DIR/docker-compose.yml" "$@"; }

cargar_env() {
  [ -f "$DIR/.env" ] || morir "todavía no está instalado. Corré primero: bash servidor.sh instalar"
  set -a
  # shellcheck disable=SC1091
  . "$DIR/.env"
  set +a
}

# JSON con python3 (viene con Ubuntu): campo de un objeto, por ruta "a.b.0.c".
json() {
  python3 -c '
import json, sys
d = json.load(sys.stdin)
for p in sys.argv[1].split("."):
    if p == "": continue
    d = d[int(p)] if isinstance(d, list) else d.get(p)
    if d is None: break
print("" if d is None else (json.dumps(d) if isinstance(d, (dict, list)) else d))
' "$1"
}

# ---------- instalar ----------

preguntar() {
  local var="$1" texto="$2" defecto="${3:-}" valor="${!1:-}"
  if [ -z "$valor" ]; then
    read -rp "$texto${defecto:+ [$defecto]}: " valor
    valor="${valor:-$defecto}"
  fi
  [ -n "$valor" ] || morir "falta $var"
  printf -v "$var" '%s' "$valor"
}

instalar_paquetes() {
  local faltan=()
  for p in curl openssl python3; do command -v "$p" >/dev/null || faltan+=("$p"); done
  if [ ${#faltan[@]} -gt 0 ]; then
    info "Instalando: ${faltan[*]}"
    apt-get update -qq && apt-get install -y -qq "${faltan[@]}" >/dev/null
  fi
  if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
    info "Abriendo los puertos 80 y 443 en el firewall (ufw)"
    ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
  fi
  if ! command -v docker >/dev/null; then
    info "Instalando Docker (script oficial de get.docker.com)"
    curl -fsSL https://get.docker.com | sh
  fi
  docker compose version >/dev/null 2>&1 || morir "Docker no tiene el plugin compose (docker compose)."
}

# Memoria total en MB.
ram_mb() { awk '/^MemTotal:/ {print int($2 / 1024)}' /proc/meminfo; }
# Con menos de 6 GB (por ejemplo, 4 GB del piloto) Chatwoot va con menos hilos.
memoria_baja() { [ "$(ram_mb)" -lt 6000 ]; }

preparar_swap() {
  # Un archivo de swap de 2 GB si no hay ninguno: con 4 GB de RAM, evita que el sistema mate
  # un contenedor en un pico (una actualización, un respaldo). Se puede saltear con SALTEAR_SWAP=1.
  [ -z "${SALTEAR_SWAP:-}" ] || return 0
  memoria_baja || return 0
  if [ "$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)" -gt 0 ]; then
    ok "Swap ya activo: $(awk '/^SwapTotal:/ {print int($2 / 1024)}' /proc/meminfo) MB"
    return 0
  fi
  info "Creando 2 GB de swap (/swapfile)"
  if fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none; then
    chmod 600 /swapfile
    if mkswap /swapfile >/dev/null && swapon /swapfile; then
      grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
      # Que use el swap solo cuando hace falta.
      echo 'vm.swappiness=10' >/etc/sysctl.d/90-mindlin-swap.conf
      sysctl -q -p /etc/sysctl.d/90-mindlin-swap.conf || true
      ok "Swap de 2 GB activo (queda configurado para cada arranque)"
      return 0
    fi
  fi
  rm -f /swapfile
  mal "No se pudo crear el swap: seguí igual, pero vigilá la memoria con «verificar»."
}

escribir_env() {
  # Si ya existe, se conservan las claves (volver a instalar no rompe nada).
  if [ -f "$DIR/.env" ]; then
    # shellcheck disable=SC1091
    set -a; . "$DIR/.env"; set +a
  fi
  CHATWOOT_IMAGEN="$IMAGEN_CHATWOOT"
  WAHA_IMAGEN="$IMAGEN_WAHA"
  preguntar DOMINIO_CHAT "Dominio de Chatwoot (por ejemplo chat.mindlin.com.ar)"
  preguntar EMAIL_CERTIFICADOS "Mail para los avisos del certificado HTTPS" "${EMAIL_CERTIFICADOS:-}"
  : "${POSTGRES_PASSWORD:=$(clave)}"
  : "${REDIS_PASSWORD:=$(clave)}"
  : "${SECRET_KEY_BASE:=$(clave 64)}"
  : "${WAHA_API_KEY:=$(clave)}"
  : "${WAHA_DASHBOARD_PASSWORD:=$(clave 16)}"
  # Hilos de Chatwoot: con poca memoria, menos (un piloto con una línea no necesita más).
  local hilos_web=5 hilos_cola=10
  if memoria_baja; then hilos_web=3; hilos_cola=5; fi
  umask 077
  cat >"$DIR/.env" <<EOF
# Generado por servidor.sh. Contiene claves: no copiarlo a ningún lado.
DOMINIO_CHAT=$DOMINIO_CHAT
EMAIL_CERTIFICADOS=$EMAIL_CERTIFICADOS
CHATWOOT_IMAGEN=$CHATWOOT_IMAGEN
WAHA_IMAGEN=$WAHA_IMAGEN
PUERTO_CHATWOOT=$PUERTO_CHATWOOT
PUERTO_WAHA=$PUERTO_WAHA
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
SECRET_KEY_BASE=$SECRET_KEY_BASE
WAHA_API_KEY=$WAHA_API_KEY
WAHA_DASHBOARD_PASSWORD=$WAHA_DASHBOARD_PASSWORD
EOF

  cat >"$DIR/chatwoot.env" <<EOF
FRONTEND_URL=https://$DOMINIO_CHAT
SECRET_KEY_BASE=$SECRET_KEY_BASE
DEFAULT_LOCALE=es
ENABLE_ACCOUNT_SIGNUP=false
FORCE_SSL=false
RAILS_ENV=production
NODE_ENV=production
INSTALLATION_ENV=docker
RAILS_MAX_THREADS=$hilos_web
SIDEKIQ_CONCURRENCY=$hilos_cola
# Un solo proceso web (sin workers extra de Puma) y menos memoria fragmentada en Ruby.
WEB_CONCURRENCY=0
MALLOC_ARENA_MAX=2
RAILS_LOG_TO_STDOUT=true
LOG_LEVEL=info
POSTGRES_HOST=postgres
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DATABASE=chatwoot
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=$REDIS_PASSWORD
ACTIVE_STORAGE_SERVICE=local
ENABLE_PUSH_RELAY_SERVER=true
MAILER_SENDER_EMAIL=Mindlin Developers <no-responder@$DOMINIO_CHAT>
# Chatwoot (desde 4.13) no manda webhooks a direcciones internas. WAHA está en la red interna
# de Docker (http://waha:3000): sin esto, lo que se escribe en Chatwoot no llega a WhatsApp.
SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true
# Recomendado por WAHA para su integración con Chatwoot
RACK_TIMEOUT_SERVICE_TIMEOUT=60
CONVERSATION_MESSAGE_PER_MINUTE_LIMIT=3000
RACK_ATTACK_LIMIT=30000
EOF

  cat >"$DIR/waha.env" <<EOF
WAHA_API_KEY=$WAHA_API_KEY
WAHA_API_KEY_PLAIN=$WAHA_API_KEY
WAHA_DASHBOARD_ENABLED=True
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=$WAHA_DASHBOARD_PASSWORD
WHATSAPP_SWAGGER_ENABLED=True
WHATSAPP_SWAGGER_USERNAME=admin
WHATSAPP_SWAGGER_PASSWORD=$WAHA_DASHBOARD_PASSWORD
WAHA_BASE_URL=http://waha:3000
WAHA_PUBLIC_URL=http://localhost:$PUERTO_WAHA
WHATSAPP_DEFAULT_ENGINE=GOWS
WAHA_APPS_ENABLED=True
WAHA_APPS_ON=chatwoot
REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379
WHATSAPP_SESSIONS_POSTGRESQL_URL=postgres://postgres:$POSTGRES_PASSWORD@postgres:5432/postgres?sslmode=disable
WHATSAPP_RESTART_ALL_SESSIONS=True
WAHA_MEDIA_STORAGE=LOCAL
WHATSAPP_FILES_LIFETIME=1800
WHATSAPP_FILES_FOLDER=/app/.media
WAHA_LOG_FORMAT=JSON
WAHA_LOG_LEVEL=info
WAHA_PRINT_QR=False
TZ=America/Argentina/Buenos_Aires
EOF
  umask 022
}

escribir_compose() {
  cat >"$DIR/Caddyfile" <<EOF
{
	email $EMAIL_CERTIFICADOS
}

$DOMINIO_CHAT {
	encode gzip
	reverse_proxy chatwoot-rails:3000
}
EOF

  cat >"$DIR/docker-compose.yml" <<'EOF'
# Generado por servidor.sh. Para cambiar algo, cambiá servidor.sh en el repo y volvé a instalar.
name: mindlin

x-registro: &registro
  logging:
    driver: json-file
    options: { max-size: "50m", max-file: "5" }

x-chatwoot: &chatwoot
  <<: *registro
  image: ${CHATWOOT_IMAGEN}
  restart: always
  env_file: chatwoot.env
  volumes:
    - chatwoot_archivos:/app/storage
  depends_on:
    postgres: { condition: service_healthy }
    redis: { condition: service_started }

services:
  caddy:
    <<: *registro
    image: caddy:2-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_datos:/data
      - caddy_config:/config
    depends_on: [chatwoot-rails]

  chatwoot-rails:
    <<: *chatwoot
    entrypoint: docker/entrypoints/rails.sh
    command: ["bundle", "exec", "rails", "s", "-p", "3000", "-b", "0.0.0.0"]
    ports:
      - "127.0.0.1:${PUERTO_CHATWOOT}:3000"

  chatwoot-sidekiq:
    <<: *chatwoot
    command: ["bundle", "exec", "sidekiq", "-C", "config/sidekiq.yml"]

  postgres:
    <<: *registro
    image: pgvector/pgvector:pg16
    restart: always
    environment:
      POSTGRES_DB: chatwoot
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_datos:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 30

  redis:
    <<: *registro
    image: redis:7-alpine
    restart: always
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    command: ["sh", "-c", "redis-server --requirepass \"$$REDIS_PASSWORD\" --appendonly yes"]
    volumes:
      - redis_datos:/data

  waha:
    <<: *registro
    image: ${WAHA_IMAGEN}
    restart: always
    env_file: waha.env
    ports:
      - "127.0.0.1:${PUERTO_WAHA}:3000"
    volumes:
      - waha_sesiones:/app/.sessions
      - waha_archivos:/app/.media
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }

volumes:
  caddy_datos:
  caddy_config:
  chatwoot_archivos:
  postgres_datos:
  redis_datos:
  waha_sesiones:
  waha_archivos:
EOF
}

instalar() {
  [ "$(id -u)" = 0 ] || morir "hay que correrlo como root (sudo bash servidor.sh instalar)."
  mkdir -p "$DIR"
  # Una copia del script queda junto a la instalación (para el respaldo nocturno y los próximos comandos).
  [ "$(realpath "$0")" = "$(realpath "$DIR/servidor.sh" 2>/dev/null || true)" ] || cp "$0" "$DIR/servidor.sh"
  instalar_paquetes
  preparar_swap
  escribir_env
  escribir_compose
  info "Bajando las imágenes (la primera vez tarda unos minutos)"
  [ -n "${SALTEAR_DESCARGA:-}" ] || compose pull
  info "Preparando la base de Chatwoot"
  compose up -d postgres redis
  compose run --rm chatwoot-rails bundle exec rails db:chatwoot_prepare
  info "Levantando todo"
  compose up -d
  esperar_servicios
  programar_respaldo
  verificar || true
  cat <<EOF

Siguiente paso:
  1. Abrí https://$DOMINIO_CHAT y creá la cuenta de administrador (nombre, empresa, mail y contraseña).
  2. En Chatwoot: tu perfil (abajo a la izquierda) → Configuración del perfil → copiá el «Token de acceso».
  3. Acá: bash servidor.sh conectar
EOF
}

programar_respaldo() {
  # Una copia de las bases todas las noches a las 3, con la copia del script que queda en $DIR.
  echo "0 3 * * * root MINDLIN_DIR=$DIR bash $DIR/servidor.sh respaldo >/dev/null 2>&1" >/etc/cron.d/mindlin-respaldo
  ok "Respaldo de las bases programado todas las noches a las 3"
}

esperar_servicios() {
  info "Esperando que arranquen Chatwoot y WAHA"
  for _ in $(seq 1 90); do
    if curl -sf "http://127.0.0.1:$PUERTO_CHATWOOT/api" >/dev/null 2>&1 &&
      curl -sf -H "X-Api-Key: $WAHA_API_KEY" "http://127.0.0.1:$PUERTO_WAHA/api/version" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# ---------- verificar ----------

verificar() {
  cargar_env
  local fallas=0
  info "Contenedores"
  for s in caddy chatwoot-rails chatwoot-sidekiq postgres redis waha; do
    if [ -n "$(compose ps --status running -q "$s" 2>/dev/null)" ]; then ok "$s"; else mal "$s no está corriendo"; fallas=$((fallas + 1)); fi
  done

  info "Servicios"
  local v
  if v=$(curl -sf "http://127.0.0.1:$PUERTO_CHATWOOT/api" | json version); then ok "Chatwoot $v"; else mal "Chatwoot no responde"; fallas=$((fallas + 1)); fi
  if v=$(curl -sf -H "X-Api-Key: $WAHA_API_KEY" "http://127.0.0.1:$PUERTO_WAHA/api/version" | json version); then ok "WAHA $v"; else mal "WAHA no responde"; fallas=$((fallas + 1)); fi

  info "HTTPS"
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOMINIO_CHAT/api" || true)
  if [ "$codigo" = 200 ]; then
    ok "https://$DOMINIO_CHAT responde con certificado válido"
  else
    mal "https://$DOMINIO_CHAT no responde bien (código ${codigo:-sin respuesta})"
    echo "    Revisá que el DNS de $DOMINIO_CHAT apunte a la IP de este servidor y que los puertos 80 y 443 estén abiertos."
    echo "    El DNS apunta a: $(getent hosts "$DOMINIO_CHAT" | awk '{print $1}' | head -1 || echo 'nada')"
    fallas=$((fallas + 1))
  fi

  info "Líneas de WhatsApp"
  local sesiones
  sesiones=$(curl -sf -H "X-Api-Key: $WAHA_API_KEY" "http://127.0.0.1:$PUERTO_WAHA/api/sessions?all=true" || echo '[]')
  echo "$sesiones" | python3 -c '
import json, sys
s = json.load(sys.stdin)
if not s: print("  (todavía no hay ninguna: bash servidor.sh conectar)")
estados = {"WORKING": "conectada", "SCAN_QR_CODE": "esperando el QR", "STARTING": "arrancando", "STOPPED": "apagada", "FAILED": "con error"}
for x in s:
    me = (x.get("me") or {}).get("id", "")
    print("  · " + x["name"] + ": " + estados.get(x["status"], x["status"]) + " " + me)
'

  info "Recursos"
  free -m | awk '/^Mem:/ {printf "  RAM: %s MB usados de %s MB\n", $3, $2}'
  free -m | awk '/^Swap:/ {if ($2 > 0) printf "  Swap: %s MB usados de %s MB\n", $3, $2; else print "  Swap: no hay (con 4 GB de RAM conviene: bash servidor.sh instalar lo crea)"}'
  df -h / | awk 'NR==2 {printf "  Disco: %s usados de %s (%s libre)\n", $3, $2, $4}'

  echo
  if [ "$fallas" = 0 ]; then ok "Todo en orden."; elif [ "$fallas" = 1 ]; then mal "1 cosa para revisar."; else mal "$fallas cosas para revisar."; fi
  [ "$fallas" = 0 ]
}

# ---------- conectar una línea ----------

chatwoot_api() {
  # chatwoot_api MÉTODO RUTA [JSON]
  local metodo="$1" ruta="$2" cuerpo="${3:-}"
  curl -sS --fail-with-body -X "$metodo" "http://127.0.0.1:$PUERTO_CHATWOOT$ruta" \
    -H "api_access_token: $CHATWOOT_TOKEN" -H 'Content-Type: application/json' \
    ${cuerpo:+--data "$cuerpo"}
}

waha_api() {
  local metodo="$1" ruta="$2" cuerpo="${3:-}"
  curl -sS --fail-with-body -X "$metodo" "http://127.0.0.1:$PUERTO_WAHA$ruta" \
    -H "X-Api-Key: $WAHA_API_KEY" -H 'Content-Type: application/json' \
    ${cuerpo:+--data "$cuerpo"}
}

pedir_token_chatwoot() {
  if [ -z "${CHATWOOT_TOKEN:-}" ]; then
    echo "Pegá el «Token de acceso» de tu perfil de Chatwoot (no se ve mientras lo pegás) y Enter:"
    read -rs CHATWOOT_TOKEN
    echo
  fi
  local perfil
  perfil=$(chatwoot_api GET /api/v1/profile) || morir "Chatwoot no aceptó el token. Copialo de nuevo desde tu perfil."
  CHATWOOT_CUENTA=$(echo "$perfil" | json accounts.0.id)
  [ -n "$CHATWOOT_CUENTA" ] || morir "ese usuario no tiene ninguna cuenta en Chatwoot."
  ok "Chatwoot: cuenta $CHATWOOT_CUENTA ($(echo "$perfil" | json accounts.0.name))"
}

conectar() {
  cargar_env
  local sesion="${1:-${SESION:-default}}" nombre="${2:-${NOMBRE_BANDEJA:-}}"
  [[ "$sesion" =~ ^[a-z0-9_-]+$ ]] || morir "el nombre de la línea va en minúsculas, sin espacios (por ejemplo: lerma)."
  preguntar nombre "Nombre de la bandeja en Chatwoot" "WhatsApp $sesion"
  pedir_token_chatwoot

  local app_id webhook bandeja bandeja_id identificador
  app_id="app_$(clave 12)"
  webhook="http://waha:3000/webhooks/chatwoot/$sesion/$app_id"

  info "1/4 Línea «$sesion» en WAHA"
  if waha_api GET "/api/sessions/$sesion" >/dev/null 2>&1; then
    ok "ya existía"
  else
    waha_api POST /api/sessions "{\"name\":\"$sesion\",\"start\":false,\"config\":{\"ignore\":{\"groups\":true,\"status\":true,\"channels\":true,\"broadcast\":true}}}" >/dev/null
    ok "creada (ignora grupos, estados y canales)"
  fi

  info "2/4 Bandeja «$nombre» en Chatwoot"
  bandeja=$(chatwoot_api POST "/api/v1/accounts/$CHATWOOT_CUENTA/inboxes" \
    "$(python3 -c 'import json,sys; print(json.dumps({"name": sys.argv[1], "lock_to_single_conversation": True, "channel": {"type": "api", "webhook_url": sys.argv[2]}}))' "$nombre" "$webhook")")
  bandeja_id=$(echo "$bandeja" | json id)
  identificador=$(echo "$bandeja" | json inbox_identifier)
  [ -n "$bandeja_id" ] && [ -n "$identificador" ] || morir "Chatwoot no devolvió la bandeja: $bandeja"
  ok "bandeja $bandeja_id (una conversación por chat, como en WhatsApp)"

  info "3/4 Conexión WAHA → Chatwoot"
  waha_api POST /api/apps "$(python3 -c '
import json, sys
app_id, sesion, cuenta, token, bandeja, ident = sys.argv[1:7]
print(json.dumps({
  "id": app_id, "session": sesion, "app": "chatwoot", "enabled": True,
  "config": {
    "url": "http://chatwoot-rails:3000", "accountId": int(cuenta), "accountToken": token,
    "inboxId": int(bandeja), "inboxIdentifier": ident, "locale": "es-ES", "linkPreview": "OFF",
    "commands": {"server": True, "queue": False},
    "conversations": {"sort": "created_newest", "status": None, "markAsRead": True,
                      "syncMessageStatus": True, "outgoing": "message"}
  }
}))' "$app_id" "$sesion" "$CHATWOOT_CUENTA" "$CHATWOOT_TOKEN" "$bandeja_id" "$identificador")" >/dev/null
  ok "lo que se mande desde el celular aparece como mensaje (así el bot sabe que lo tomó una persona)"

  info "4/4 Encendiendo la línea"
  waha_api POST "/api/sessions/$sesion/start" >/dev/null || true
  ok "lista para escanear el QR"

  cat <<EOF

Ahora, con el celular del chip:
  1. En Chatwoot, abrí la conversación «WhatsApp Integration» de la bandeja «$nombre».
     Ahí aparece el QR. Si no aparece, escribí: start
  2. En el celular: WhatsApp → Dispositivos vinculados → Vincular un dispositivo → escaneá el QR.
  3. Mandá un mensaje desde otro teléfono a ese número: tiene que aparecer en Chatwoot.
EOF
}

# ---------- conectar el asistente (Agent Bot) ----------

bot() {
  cargar_env
  pedir_token_chatwoot
  local bandejas bandeja_id base clave_webhook url creado bot_id bot_token
  bandejas=$(chatwoot_api GET "/api/v1/accounts/$CHATWOOT_CUENTA/inboxes")
  echo "Bandejas:"
  echo "$bandejas" | python3 -c '
import json, sys
for b in json.load(sys.stdin)["payload"]:
    print("  " + str(b["id"]) + ": " + b["name"])
'
  preguntar BANDEJA_ID "Número de la bandeja donde va a responder el asistente"
  bandeja_id="$BANDEJA_ID"
  preguntar URL_ASISTENTE "Dirección del asistente en Vercel (por ejemplo https://mindlin-asistente.vercel.app)"
  base="${URL_ASISTENTE%/}"
  url="$base/api/chatwoot/webhook"

  creado=$(chatwoot_api POST "/api/v1/accounts/$CHATWOOT_CUENTA/agent_bots" \
    "$(python3 -c 'import json,sys; print(json.dumps({"name": "Asistente Mindlin", "description": "Atiende las consultas comerciales; pasa a una persona cuando hace falta.", "outgoing_url": sys.argv[1]}))' "$url")")
  bot_id=$(echo "$creado" | json id)
  bot_token=$(echo "$creado" | json access_token)
  # Chatwoot firma cada aviso al bot con esta clave (X-Chatwoot-Signature): el asistente la verifica.
  clave_webhook=$(echo "$creado" | json secret)
  [ -n "$bot_id" ] && [ -n "$bot_token" ] && [ -n "$clave_webhook" ] || morir "Chatwoot no devolvió el bot completo: $creado"
  chatwoot_api POST "/api/v1/accounts/$CHATWOOT_CUENTA/inboxes/$bandeja_id/set_agent_bot" "{\"agent_bot\":$bot_id}" >/dev/null
  ok "Agent Bot $bot_id conectado a la bandeja $bandeja_id"

  umask 077
  cat >"$DIR/asistente.env" <<EOF
# Cargar estas cuatro variables en Vercel (Settings → Environment Variables) y volver a publicar.
CHATWOOT_URL=https://$DOMINIO_CHAT
CHATWOOT_ACCOUNT_ID=$CHATWOOT_CUENTA
CHATWOOT_BOT_TOKEN=$bot_token
CHATWOOT_WEBHOOK_SECRET=$clave_webhook
EOF
  umask 022
  echo
  echo "Copiá estas cuatro variables directo a Vercel (no a un chat). Quedan guardadas en $DIR/asistente.env:"
  echo
  cat "$DIR/asistente.env"
}

claves() {
  cargar_env
  echo "Panel de WAHA (solo hace falta para revisar algo a mano):"
  echo "  Desde tu compu: ssh -L $PUERTO_WAHA:127.0.0.1:$PUERTO_WAHA root@<IP del servidor>"
  echo "  y abrí http://localhost:$PUERTO_WAHA/dashboard"
  echo "  Usuario: admin"
  echo "  Clave:   $WAHA_DASHBOARD_PASSWORD"
  echo "  API key: $WAHA_API_KEY"
  [ -f "$DIR/asistente.env" ] && { echo; echo "Variables del asistente para Vercel:"; cat "$DIR/asistente.env"; }
  return 0
}

respaldo() {
  cargar_env
  mkdir -p "$DIR/respaldos"
  local archivo
  archivo="$DIR/respaldos/bases-$(date +%Y%m%d-%H%M).sql.gz"
  compose exec -T postgres pg_dumpall -U postgres | gzip >"$archivo"
  chmod 600 "$archivo"
  # Se quedan los últimos 14.
  ls -1t "$DIR"/respaldos/bases-*.sql.gz | tail -n +15 | xargs -r rm -f
  ok "Copia guardada: $archivo ($(du -h "$archivo" | cut -f1))"
}

actualizar() {
  respaldo
  cargar_env
  preparar_swap
  escribir_env
  escribir_compose
  [ -n "${SALTEAR_DESCARGA:-}" ] || compose pull
  compose run --rm chatwoot-rails bundle exec rails db:chatwoot_prepare
  compose up -d
  esperar_servicios && verificar
}

case "${1:-}" in
  instalar) instalar ;;
  verificar) verificar ;;
  conectar) shift; conectar "$@" ;;
  bot) bot ;;
  claves) claves ;;
  respaldo) respaldo ;;
  actualizar) actualizar ;;
  estado) cargar_env; compose ps ;;
  *) sed -n '2,/^set -euo pipefail/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//' ;;
esac
