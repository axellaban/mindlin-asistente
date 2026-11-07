# Servidor: WAHA + Chatwoot

`servidor.sh` instala y opera todo en un VPS con Ubuntu (22.04 o 24.04), 2 vCPU, 4 GB de RAM y 30 GB libres. El paso a paso para hacerlo está en [`IA_DE_PANELES.md`](../IA_DE_PANELES.md), tareas 4 a 6.

## Qué levanta

En `/opt/mindlin-asistente`, con Docker Compose (proyecto `mindlin`):

| Servicio | Imagen | Para qué |
| --- | --- | --- |
| `caddy` | `caddy:2-alpine` | HTTPS con certificado automático (Let's Encrypt), puertos 80 y 443 |
| `chatwoot-rails`, `chatwoot-sidekiq` | `chatwoot/chatwoot:v4.19.1` | La bandeja del equipo |
| `postgres` | `pgvector/pgvector:pg16` | Base de Chatwoot y sesiones de WAHA |
| `redis` | `redis:7-alpine` | Colas de Chatwoot y de la integración de WAHA |
| `waha` | `devlikeapro/waha:gows-2026.10.1` | WhatsApp (motor GOWS, sin navegador) con su integración con Chatwoot |

Solo Caddy queda expuesto a internet. Chatwoot y WAHA escuchan además en `127.0.0.1:3109` y `127.0.0.1:3100`, solo dentro del servidor: los usa el script, y sirven para entrar por túnel SSH (`servidor.sh claves` dice cómo).

## Comandos

```
bash servidor.sh instalar     # Docker si falta, claves nuevas (o las que ya había), base de Chatwoot y todo arriba
bash servidor.sh verificar    # contenedores, versiones, HTTPS, líneas de WhatsApp, RAM y disco
bash servidor.sh conectar <línea> "<bandeja>"   # sesión de WAHA + bandeja API en Chatwoot + la conexión entre las dos
bash servidor.sh bot          # Agent Bot en Chatwoot apuntando al asistente de Vercel; deja las 4 variables en asistente.env
bash servidor.sh respaldo     # pg_dumpall comprimido en respaldos/ (se guardan los últimos 14; corre solo todas las noches a las 3)
bash servidor.sh actualizar   # respaldo, versiones fijadas en el script, migraciones de Chatwoot y reinicio
bash servidor.sh claves       # usuario y clave del panel de WAHA, y las variables del asistente
```

Volver a correr `instalar` no rompe nada: conserva las claves de `.env` y los datos.

## Decisiones

- **Una conversación por chat** (bandeja con «lock to single conversation» y WAHA con *Created: Newest / Any status*), como en WhatsApp.
- **Lo que se manda desde el celular aparece como mensaje, no como nota interna** (`conversations.outgoing = "message"`). Así el asistente se da cuenta de que una persona tomó la conversación.
- La línea ignora grupos, estados, canales y listas de difusión.
- Se probó entero en Docker local (instalar dos veces, conectar, bot y respaldo), con Chatwoot 4.19.1 y WAHA 2026.10.1. El QR y los mensajes reales de WhatsApp quedan para la prueba en el servidor.

## Para actualizar versiones

Cambiar `IMAGEN_CHATWOOT` o `IMAGEN_WAHA` al principio de `servidor.sh`, probar y correr `actualizar` en el servidor.
