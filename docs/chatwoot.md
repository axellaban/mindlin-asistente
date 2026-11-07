# Chatwoot y WAHA: lo que se confirmó probando

Probado el 07/11/2026 con Chatwoot 4.19.1 y WAHA 2026.10.1 levantados con `infra/servidor.sh` en Docker, y la app conectada como Agent Bot. El QR y los mensajes reales de WhatsApp todavía no se probaron: ese entorno no tenía salida a WhatsApp.

## Conversaciones y Agent Bot

- **Pendiente y abierta.** Con un Agent Bot en la bandeja, cada conversación nueva entra como **pendiente**. Cuando pasa a **abierta** (`toggle_status`), Chatwoot muestra «La conversación fue reabierta por Asistente Mindlin».
- **Chatwoot sigue avisando al bot aunque la conversación esté abierta,** también de los mensajes del propio bot y de las personas. Por eso el bot mira el estado antes de contestar.
- **Quién escribió.** En el aviso, `sender.type` es `agent_bot` para lo del bot y `user` para lo de una persona del equipo. En los mensajes del interesado, el contacto viene en `conversation.meta.sender`, con nombre y teléfono.
- **Qué puede hacer el token del Agent Bot:**
  - **Puede:** mandar mensajes, dejar notas internas y cambiar el estado.
  - **No puede:** leer el historial (`GET …/messages` devuelve 401). Por eso el asistente lo arma con los avisos y lo guarda en Supabase (tabla `mensajes`).
- **Avisos firmados.** Llegan con `X-Chatwoot-Timestamp` y `X-Chatwoot-Signature = sha256=HMAC(clave del bot, "hora.cuerpo")`. La clave es el `secret` del Agent Bot; `servidor.sh bot` la deja en `asistente.env` como `CHATWOOT_WEBHOOK_SECRET`.
- **Tiempo de respuesta.** Chatwoot espera **5 segundos**. Si el webhook responde 429 o 500, reintenta. Si falla de otra forma, **pasa la conversación pendiente a abierta**, así que si el asistente se cae, atiende el equipo. Por eso la app responde enseguida y hace el trabajo después (`after`).

## WAHA → Chatwoot

- **Hay que habilitar las direcciones internas.** Desde la 4.13, Chatwoot no manda webhooks a direcciones internas («Hostname 'waha' has no public ip addresses»). Sin `SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true`, lo que se escribe en Chatwoot no llega a WhatsApp. El instalador ya lo configura.
- **La conversación «Integración de WhatsApp».** WAHA la crea para avisos y para el QR, con el contacto `whatsapp.integration`. Sus mensajes entran como si los escribiera un interesado, así que el bot la ignora.
- **Los errores de envío** («No se pudo enviar un mensaje en WhatsApp») llegan como **notas internas**, y el bot las ignora.
- **Lo que se manda desde el celular** entra como nota interna por defecto. `servidor.sh conectar` lo configura para que entre como mensaje (`conversations.outgoing = "message"`), así el bot se da cuenta de que lo tomó una persona.

## Falta probar con la línea real

- El QR desde la conversación «Integración de WhatsApp».
- Que los mensajes del bot no vuelvan a entrar como si los hubiera escrito una persona desde el celular. Si pasara, el webhook ya descarta un mensaje de «persona» con el mismo texto que mandó el bot en los últimos 3 minutos.
- Los audios: cómo llegan los adjuntos (`attachments[].data_url`) y si se pueden bajar con el token del bot.
