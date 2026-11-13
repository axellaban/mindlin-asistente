# Servidor con Easypanel

Decidido por Axel el 13/11/2026: WAHA y Chatwoot pasan a correr en **Easypanel**, en el mismo VPS de Hostinger (KVM 1). Hasta acá estaban instalados directo sobre Ubuntu con `infra/servidor.sh`. Easypanel es un panel web, así que se pueden ver, reiniciar y actualizar sin usar la consola. Como todavía no había datos reales (solo pruebas), se reinstala de cero.

Son las mismas versiones y los mismos ajustes que ya se probaron: Chatwoot 4.19.1, WAHA 2026.10.1 (GOWS), Postgres 16 con pgvector y Redis 7, con menos hilos en Chatwoot para 4 GB de RAM.

## Qué cambia

| | Antes (Ubuntu + `servidor.sh`) | Ahora (Easypanel) |
| --- | --- | --- |
| Quién levanta y actualiza los contenedores | `servidor.sh instalar` y `actualizar` | Easypanel, con [`infra/easypanel/docker-compose.yml`](../infra/easypanel/docker-compose.yml) |
| HTTPS | Caddy | Easypanel (pestaña Dominios) |
| Claves (Postgres, Redis, WAHA…) | `/opt/mindlin-asistente/.env` | Easypanel → servicio → Entorno |
| Panel de WAHA | Solo por túnel SSH | `https://waha.mindlindevelopers.com/dashboard` (usuario y clave) |
| Línea, bandeja y Agent Bot | `servidor.sh conectar` y `bot` | Igual: `servidor.sh conectar` y `bot` |
| Verificar y respaldo nocturno | `servidor.sh verificar` y `respaldo` | Igual |

`servidor.sh` sigue sirviendo, en modo Easypanel. Queda guardado en `/opt/mindlin-asistente/.env` con `MODO=easypanel` y sin claves: la de WAHA la lee del contenedor cada vez. En este modo, `instalar` y `actualizar` no corren, para no pisar lo que maneja Easypanel. Comandos nuevos:

- `generar`: cinco claves nuevas para pegar en el Entorno de Easypanel.
- `easypanel`: se corre una vez, después de implementar. Crea el swap si falta, programa el respaldo nocturno y verifica.

## Qué se pierde al reinstalar

- Todo lo del servidor actual: la cuenta de Chatwoot, la bandeja, el Agent Bot y la línea vinculada. **Axel vuelve a escanear el QR** con el celular del chip.
- En Vercel quedan viejas tres variables: `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_BOT_TOKEN` y `CHATWOOT_WEBHOOK_SECRET`. Se cambian en el paso 12. `CHATWOOT_URL` sigue igual.
- En la base del asistente se borran las conversaciones de prueba del Chatwoot anterior (migración `202611130009_chatwoot_nuevo.sql`, al publicar). El Chatwoot nuevo vuelve a numerar desde 1, y un número repetido haría que el asistente ignore un mensaje nuevo. **La configuración no se toca:** fichas, tono, ejemplos, seguimientos, etapas y pausa.
- Las filas que crearon esas pruebas en la planilla del CRM quedan como están.

## Paso a paso (IA de paneles, con Axel)

Las reglas de [`IA_DE_PANELES.md`](../IA_DE_PANELES.md) siguen valiendo. Sobre todo, **ninguna clave va a un chat, a GitHub ni a una captura**: se copian directo de un lugar al otro.

1. **DNS (DonWeb, donde está `mindlindevelopers.com`):** agregar un registro **A** `waha` que apunte a `187.53.99.210`, la misma IP que `chat`. Si Axel quiere el panel con dominio propio, también `panel`.
2. **Hostinger, reinstalar con Easypanel.** Hay que frenar y confirmar con Axel antes: **borra todo el servidor**.
   - Ir a hPanel → VPS `srv2145105` → **Sistema operativo** → cambiar a la plantilla de aplicación **Easypanel** (Ubuntu 24.04).
   - Poner una contraseña de root nueva y guardarla en el gestor de contraseñas de Axel.
   - Esperar a que termine.
3. **Firewall de Hostinger:** si está activo, tiene que dejar pasar los puertos 22, 80, 443 y 3000 (el de Easypanel).
4. **Easypanel:** abrir `http://187.53.99.210:3000` y crear el usuario administrador, con el mail de Axel y una contraseña del gestor. Si en el paso 1 se creó `panel`, cargarlo en Easypanel → Ajustes → dominio del panel.
5. **El servicio:** crear el proyecto `mindlin`.
   - Agregar un servicio **Compose** llamado `asistente`.
   - En Fuente: **Inline**, y pegar entero [`infra/easypanel/docker-compose.yml`](../infra/easypanel/docker-compose.yml) (en GitHub, botón **Raw**).
   - Guardar, todavía sin implementar.
6. **Las claves:** pasar `infra/servidor.sh` al servidor como `/root/servidor.sh`, igual que en la tarea 4 de `IA_DE_PANELES.md`. Después:
   - Correr `bash /root/servidor.sh generar` en la terminal del servidor.
   - En Easypanel → `asistente` → **Entorno**, pegar esas cinco líneas y debajo el resto de [`infra/easypanel/variables.env.example`](../infra/easypanel/variables.env.example): dominios e hilos.
   - Prender **Crear archivo .env** y guardar.
7. **Implementar.** La primera vez tarda entre 5 y 10 minutos: baja unos 2 GB y prepara la base de Chatwoot.
8. **Dominios** (Easypanel → `asistente` → Dominios), los dos con HTTPS. Easypanel saca el certificado solo.
   - `chat.mindlindevelopers.com` → servicio `chatwoot-rails`, puerto `3000`.
   - `waha.mindlindevelopers.com` → servicio `waha`, puerto `3000`.
9. **Preparar el servidor:** correr `bash /root/servidor.sh easypanel`. Crea el swap, programa el respaldo nocturno y verifica que anden los 5 contenedores, Chatwoot, WAHA y el HTTPS. Copiar la salida (no tiene claves) en `docs/estado-paneles.md`, sección «Servidor».
10. **Chatwoot:** hacer el alta igual que en la tarea 5, pasos 1 y 2: cuenta «Mindlin Developers» y copiar el Token de acceso del perfil.
11. **La línea:** correr `bash /opt/mindlin-asistente/servidor.sh conectar default "WhatsApp Lerma 439"` y pegar el token cuando lo pida.
    - **Con Axel y el celular del chip:** el QR aparece en la conversación «Integración de WhatsApp» de esa bandeja.
    - Después, mandar un mensaje desde otro teléfono: tiene que aparecer en Chatwoot.
12. **El asistente.** Este paso asigna el Agent Bot a la bandeja, así que el asistente empieza a contestar en la línea. Si todavía no tiene que contestar, primero hay que pausarlo desde el hub: Comercial → Asistente de WhatsApp → **Pausar el asistente**.
    - Correr `bash /opt/mindlin-asistente/servidor.sh bot`, con la bandeja que muestra y `https://mindlin-asistente.vercel.app`.
    - Muestra cuatro variables. Reemplazar las cuatro en Vercel → `mindlin-asistente` → Settings → Environment Variables (Production, como Secret) y volver a publicar.
13. **Comprobar:** `https://mindlin-asistente.vercel.app/api/salud` tiene que decir `configuracionCompleta: true`. Anotar el resultado en `docs/estado-paneles.md`.

## Para manejarlo sin consola (Axel)

- **¿Anda todo?** Easypanel → `mindlin` → `asistente`: los cinco contenedores en verde. Los mensajes de cada uno están en la pestaña de registros.
- **Reiniciar:** botón **Implementar**, que vuelve a levantar todo. No borra nada: los datos están en volúmenes.
- **La línea de WhatsApp:** `https://waha.mindlindevelopers.com/dashboard`. El usuario es `admin` y la clave es `WAHA_DASHBOARD_PASSWORD`, en Entorno. Ahí se ve si está conectada.
- **Actualizar versiones:** Claude cambia `infra/easypanel/docker-compose.yml` en el repo. Se pega el nuevo en Fuente y se toca **Implementar**. Al arrancar, Chatwoot actualiza su base solo.
- **Respaldos:** todas las noches a las 3 en `/opt/mindlin-asistente/respaldos` (quedan los últimos 14), además del backup semanal de Hostinger.
- **No hay que** cambiarles el nombre a los servicios del Compose ni borrar el servicio `asistente`: se pierden los datos. Tampoco hay que cambiar `POSTGRES_PASSWORD` ni `SECRET_KEY_BASE` una vez instalado.
- Si la RAM pasa del 85 % seguido (`servidor.sh verificar` la muestra), el paso siguiente es el KVM 2 (8 GB). En Entorno se suben los hilos a 5 y 10.

## Cómo se probó

El 13/11, en Docker local, se probó lo mismo que hace Easypanel: el Compose levantado con `docker compose up` y su `.env`, y un proxy HTTPS adelante para los dos dominios. Se probaron:

- `generar`, `easypanel`, `conectar`, `bot`, `respaldo`, `claves` y `verificar`, y que `instalar` y `actualizar` se frenan;
- volver a implementar (contenedores recreados) sin perder la cuenta, la bandeja ni el bot;
- que WAHA crea la conversación «Integración de WhatsApp» en Chatwoot.

En reposo, los cinco contenedores usan unos 1,25 GB de RAM; Easypanel suma lo suyo.

En esa prueba apareció el mismo problema del PR #12: detrás de un proxy, Chatwoot no ve el encabezado `api_access_token` y contesta 401. Por eso `servidor.sh` ahora le habla con `Authorization: Bearer`.

Falta probar en el servidor: la pantalla de Easypanel, sus certificados y el QR con WhatsApp de verdad (desde la prueba local no se llega a WhatsApp).
