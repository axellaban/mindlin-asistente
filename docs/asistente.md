# Cómo funciona el asistente

## El recorrido de un mensaje

1. **Llega el aviso.** El interesado escribe por WhatsApp, WAHA lo pasa a Chatwoot y Chatwoot avisa al webhook `POST /api/chatwoot/webhook`.
2. **El webhook** (`lib/webhook.ts`):
   - verifica la firma;
   - guarda el mensaje en el historial (`mensajes`);
   - decide qué hacer (`lib/chatwoot/evento.ts`);
   - responde enseguida. El resto corre después.
3. **La atención** (`lib/agente/servicio.ts`):
   - No contesta dos veces el mismo mensaje (`mensajes_respondidos`).
   - Espera 6 segundos por si la persona sigue escribiendo. Si llegó otro mensaje, contesta ese; si ya escribió alguien del equipo, no contesta.
   - Arma el contexto (`lib/agente/contexto.ts`):
     - **Instrucciones estables:** tono, reglas, la ficha del proyecto y los ejemplos. Van en el caché de Anthropic.
     - **La situación:** fecha y hora, quién es y qué dice el CRM.
   - Claude responde (`lib/agente/agente.ts`). Puede usar tres herramientas:
     - `registrar_interesado`: alta en el CRM del hub si no existe; si ya existe, solo suma actividad.
     - `pasar_a_persona`.
     - `elegir_proyecto`: solo si hay más de un proyecto activo.
   - Manda la respuesta por Chatwoot.
   - **Si pasa a una persona:** deja una nota interna con el motivo y el resumen, abre la conversación y lo anota en el CRM.
4. **Si algo falla** (Claude, Supabase, Chatwoot), la conversación pasa al equipo con una nota. Nadie queda sin respuesta.

Si una persona del equipo escribe en una conversación pendiente, desde Chatwoot o desde el celular, la conversación pasa a abierta y el bot deja de contestar ahí.

## Modelo

Por defecto, `claude-opus-5-5` con esfuerzo `medium`, y `fallbacks: "default"`: si el modelo rechaza una consulta por sus filtros de seguridad, Anthropic la reintenta en el modelo que recomienda para ese caso. Se cambia sin tocar código con variables opcionales:

| Variable | Para qué | Por defecto |
| --- | --- | --- |
| `ASISTENTE_MODELO` | Otro modelo de Claude | `claude-opus-5-5` |
| `ASISTENTE_ESFUERZO` | `low`, `medium`, `high`, `xhigh` o `max` | `medium` |
| `CRM_RESPONSABLE` | Responsable de los contactos nuevos en el CRM (el apodo como figura en el hub) | vacío |

## Qué guarda

- **Supabase:**
  - historial de mensajes;
  - qué proyecto y qué contacto del CRM tiene cada conversación;
  - mensajes ya respondidos;
  - registro de lo que hizo el bot.
- **CRM del hub:** contacto nuevo (etapa Nuevo, origen Otro, con «Entró por WhatsApp (asistente)» en las notas) y actividad tipo WhatsApp con el usuario «Asistente WhatsApp». Nunca cambia lo que cargó una persona.

## Prueba local de punta a punta

Se hizo el 07/11/2026. Así se repite:

1. Chatwoot y WAHA con `MINDLIN_DIR=<carpeta> DOMINIO_CHAT=chat.localhost EMAIL_CERTIFICADOS=… bash infra/servidor.sh instalar`. Después, la configuración inicial, `conectar` y `bot` con `URL_ASISTENTE=http://172.17.0.1:<puerto>`.
2. Postgres con PostgREST detrás de `/rest/v1`, con las migraciones de `supabase/migrations/` aplicadas y una clave `service_role` firmada con el secreto JWT de PostgREST.
3. Un servidor que imita la API de Anthropic, apuntado con `ANTHROPIC_BASE_URL`.
4. La app: `next start -p <puerto> -H 0.0.0.0`, con las variables de Chatwoot, Supabase y Anthropic.
5. Mensajes creados por la API de Chatwoot, como si fueran de un interesado o de una persona del equipo.

Se comprobaron estos casos:
- respuesta;
- historial guardado;
- paso a una persona (nota, conversación abierta y registro);
- una persona que escribe antes que el bot;
- que el bot no conteste en conversaciones abiertas;
- el pedido que llega a Claude: modelo, `betas`, `fallbacks`, esfuerzo, caché y herramientas con `strict`.
