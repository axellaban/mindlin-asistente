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
   - Si trae audios, los baja de Chatwoot, los transcribe y guarda el texto en el historial como `[audio: «…»]` (ver «Audios»).
   - Espera 6 segundos por si la persona sigue escribiendo. Si llegó otro mensaje, contesta ese; si ya escribió alguien del equipo, no contesta.
   - Arma el contexto (`lib/agente/contexto.ts`):
     - **Instrucciones estables:** tono, reglas, la ficha del proyecto y los ejemplos. Van en el caché de Anthropic.
     - **La situación:** fecha y hora, quién es y qué dice el CRM.
   - La IA responde (`lib/agente/agente.ts`), con Claude u OpenAI (ver «Modelo»). Puede usar tres herramientas:
     - `registrar_interesado`: alta en el CRM del hub si no existe; si ya existe, solo suma actividad.
     - `pasar_a_persona`.
     - `elegir_proyecto`: solo si hay más de un proyecto activo.
   - Manda la respuesta por Chatwoot.
   - **Si pasa a una persona:** deja una nota interna con el motivo y el resumen, abre la conversación y lo anota en el CRM.
4. **Si algo falla** (la IA, la base, Chatwoot), la conversación pasa al equipo con una nota. Nadie queda sin respuesta.

Además, cada mensaje anota en la conversación cuándo escribió cada uno: con eso salen los [seguimientos](seguimientos.md).

Si una persona del equipo escribe en una conversación pendiente, desde Chatwoot o desde el celular, la conversación pasa a abierta y el bot deja de contestar ahí.

## Modelo

Responde **OpenAI o Claude**, según la clave que esté cargada en Vercel. Axel pidió OpenAI (09/11); Claude queda como alternativa sin tocar código.

- **OpenAI** (`lib/agente/openai.ts`): por defecto `gpt-6.1-sol`, la opción de menor costo de la familia GPT-6, que OpenAI recomienda para producción. Usa la API «Responses» (con los modelos nuevos de OpenAI, las herramientas solo andan por ahí), con herramientas estrictas y `store: false` (OpenAI no guarda las conversaciones). Le devuelve a OpenAI su razonamiento cifrado entre una herramienta y la siguiente, como pide su documentación. Reintenta dos veces si OpenAI está saturado.
- **Claude** (`lib/agente/claude.ts`): por defecto `claude-opus-5-5` con esfuerzo `medium` y `fallbacks: "default"`: si el modelo rechaza una consulta por sus filtros de seguridad, Anthropic la reintenta en el modelo que recomienda para ese caso.
- El agente arma los pedidos siempre igual; el adaptador de OpenAI los traduce. Así el historial, las reglas, las herramientas y el paso a una persona son los mismos con las dos.

| Variable | Para qué | Por defecto |
| --- | --- | --- |
| `OPENAI_API_KEY` | Responder con OpenAI y transcribir audios | — |
| `ANTHROPIC_API_KEY` | Responder con Claude | — |
| `ASISTENTE_PROVEEDOR` | `openai` o `anthropic`, si están las dos claves | el que tenga clave; con las dos, `anthropic` |
| `ASISTENTE_MODELO` | Otro modelo del proveedor elegido | `gpt-6.1-sol` o `claude-opus-5-5` |
| `ASISTENTE_ESFUERZO` | `low`, `medium`, `high`, `xhigh` o `max` (en OpenAI, los tres últimos son `high`) | `medium` |
| `ASISTENTE_MODELO_AUDIOS` | Modelo para transcribir | `gpt-transcribe` |
| `CRM_RESPONSABLE` | Responsable de los contactos nuevos en el CRM (el apodo como figura en el hub) | vacío |

`/api/salud` y el panel dicen qué proveedor y qué modelo están respondiendo (nunca la clave).

## Audios

- El aviso de Chatwoot trae la dirección de cada audio. El asistente lo baja **solo si está en la dirección de Chatwoot** (`CHATWOOT_URL`) y pesa hasta 25 MB.
- Lo transcribe OpenAI (`gpt-transcribe`, en castellano). Necesita `OPENAI_API_KEY`, aunque responda Claude.
- El texto queda en el historial como `[audio: «…»]` y la IA responde por escrito a lo que dice. Se transcribe antes de la espera de 6 segundos, así que si la persona manda un audio y después un texto, la respuesta tiene en cuenta los dos.
- Si no se puede (falta la clave, falla la descarga o la transcripción), queda `[audio]` y el bot pide con amabilidad que lo escriba, como antes. El error queda en el registro.
- Falta confirmar con la línea real que la dirección del audio llega completa en el aviso (en la prueba local con Chatwoot 4.19.1, los adjuntos traían `data_url`).

## Qué guarda

- **La base (Neon):**
  - historial de mensajes;
  - qué proyecto y qué contacto del CRM tiene cada conversación;
  - mensajes ya respondidos;
  - registro de lo que hizo el bot.
- **CRM del hub:** contacto nuevo (etapa Nuevo, origen WhatsApp, con «Entró por WhatsApp (asistente)» en las notas) y actividad tipo WhatsApp con el usuario «Asistente WhatsApp» (también cada seguimiento automático). Nunca cambia lo que cargó una persona. Las etapas y columnas son las del hub desde noviembre de 2026 (con la columna Tags); las etapas de antes se leen como las de ahora.

## Prueba local de punta a punta

Se hizo el 07/11/2026. Así se repite:

1. Chatwoot y WAHA con `MINDLIN_DIR=<carpeta> DOMINIO_CHAT=chat.localhost EMAIL_CERTIFICADOS=… bash infra/servidor.sh instalar`. Después, la configuración inicial, `conectar` y `bot` con `URL_ASISTENTE=http://172.17.0.1:<puerto>`.
2. Un Postgres con las migraciones de `db/migraciones/` (`DATABASE_URL=… npm run migrar`). Esa prueba se hizo cuando la base era Supabase; desde el cambio a Neon, `lib/datos/postgres.test.ts` prueba las migraciones y las consultas contra un Postgres de verdad en cada PR.
3. Un servidor que imita la API de Anthropic, apuntado con `ANTHROPIC_BASE_URL`.
4. La app: `next start -p <puerto> -H 0.0.0.0`, con las variables de Chatwoot, la base y Anthropic.
5. Mensajes creados por la API de Chatwoot, como si fueran de un interesado o de una persona del equipo.

Se comprobaron estos casos:
- respuesta;
- historial guardado;
- paso a una persona (nota, conversación abierta y registro);
- una persona que escribe antes que el bot;
- que el bot no conteste en conversaciones abiertas;
- el pedido que llega a Claude: modelo, `betas`, `fallbacks`, esfuerzo, caché y herramientas con `strict`.
