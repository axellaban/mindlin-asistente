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
     - **La situación:** fecha y hora (y si el equipo está trabajando), quién es, qué dice el CRM (etapa, responsable, para qué busca, presupuesto, próximo paso, notas) y **lo que el asistente ya anotó** de esa persona.
   - La IA responde (`lib/agente/agente.ts`), con Claude u OpenAI (ver «Modelo»). Puede usar tres herramientas:
     - `registrar_interesado`: lo guarda en la conversación (`conversaciones.interesado`) y da de alta en el CRM del hub si no existe; si ya existe, suma actividad **solo con lo que cambió** (si no hay nada nuevo, no escribe).
     - `pasar_a_persona`.
     - `marcar_senal`: avisa que pidió una visita, mostró una señal de compra o dijo que no le interesa (esta última, además, frena los seguimientos). Sirve para las etapas automáticas.
     - `elegir_proyecto`: solo si hay más de un proyecto activo. Con un proyecto ya elegido, ve los nombres de los otros (sin sus datos) para poder cambiar si preguntan por otro.
   - Manda la respuesta por Chatwoot, con el formato de WhatsApp (`lib/agente/whatsapp.ts`: `**negrita**` → `*negrita*`, sin `#` ni `[links](…)`).
   - **Si pasa a una persona:** deja una nota interna con el motivo y el resumen, abre la conversación y lo anota en el CRM.
4. **Si algo falla** (la IA, la base, Chatwoot), la conversación pasa al equipo con una nota. Nadie queda sin respuesta.

Además, cada mensaje anota en la conversación cuándo escribió cada uno: con eso salen los [seguimientos](seguimientos.md).

## Cuando interviene el equipo

Todo se maneja con los estados de Chatwoot: **pendiente** la atiende el asistente, **abierta** la atiende el equipo.

- **Tomar una conversación:** escribir en ella (desde Chatwoot o desde el celular de la línea) o abrirla. Pasa a abierta y el asistente se calla ahí; tampoco le manda seguimientos.
- **El asistente la pasa solo** cuando hace falta una persona (quiere visitar, reservar, negociar, algo que no está en la ficha, o si falla algo), con una nota interna del motivo y el resumen.
- **Devolvérsela al asistente:** en Chatwoot, **Marcar como pendiente**. Con el próximo mensaje del interesado vuelve a responder (leyendo lo que escribió el equipo, para seguir su línea) y vuelve a llevar seguimientos. Queda en el registro como «Volvió al asistente».
- **Pausar el asistente entero:** panel → Resumen → **Pausar el asistente**. Cada conversación nueva pasa al equipo con la nota «El asistente está pausado» y no salen seguimientos. Se reactiva con el mismo botón. Queda quién y cuándo.

## Modelo

Responde **Claude o OpenAI**, según la clave que esté cargada en Vercel. **Hoy, en producción, responde OpenAI (`gpt-6.1-sol`)**, según `/api/salud` el 11/11: Panel lo prendió el 10/11 para probar la línea. Están cargadas las dos claves, así que lo decide `ASISTENTE_PROVEEDOR` (ver la tabla). Falta que Axel confirme cuál queda (`PENDIENTES.md`). Los audios los transcribe OpenAI.

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

`/api/salud` y el panel dicen qué proveedor y qué modelo están respondiendo (nunca la clave). Para saber si de verdad responde, **Conexiones** en el panel (o «Probar las conexiones» en el hub) le hace un pedido chico a la IA y prueba también Chatwoot, la base y la planilla (ver [`panel.md`](panel.md)).

## Audios

- El aviso de Chatwoot trae la dirección de cada audio. El asistente lo baja **solo si está en la dirección de Chatwoot** (`CHATWOOT_URL`) y pesa hasta 25 MB.
- Lo transcribe OpenAI (`gpt-transcribe`, en castellano). Necesita `OPENAI_API_KEY`, aunque responda Claude.
- El texto queda en el historial como `[audio: «…»]` y la IA responde por escrito a lo que dice. Se transcribe antes de la espera de 6 segundos, así que si la persona manda un audio y después un texto, la respuesta tiene en cuenta los dos.
- Si no se puede (falta la clave, falla la descarga o la transcripción), queda `[audio]` y el bot pide con amabilidad que lo escriba, como antes. El error queda en el registro.
- Falta confirmar con la línea real que la dirección del audio llega completa en el aviso (en la prueba local con Chatwoot 4.19.1, los adjuntos traían `data_url`).

## Lo que tiene en cuenta además

- **Lo que ya sabe de la persona.** Lo que anota con `registrar_interesado` queda en la conversación y lo ve en cada mensaje, aunque la charla sea larga y el principio ya no entre en los últimos 40 mensajes. Así no vuelve a preguntar lo mismo.
- **El CRM, buscado bien.** Primero por el ID que ya quedó anotado en la conversación y después por teléfono. WhatsApp a veces no pasa el número (contactos con privacidad): antes eso creaba un contacto repetido en cada mensaje.
- **El horario del equipo comercial.** Lo carga Mindlin desde el hub (Inteligencia comercial) o el panel (Tono); se guarda con el tono. De fábrica, de lunes a viernes de 9 a 20 (hora de Buenos Aires). Fuera de ese horario sigue atendiendo igual, pero si pasa la conversación a una persona avisa que le escriben apenas vuelvan, sin prometer una hora. Código: `lib/agente/horario.ts`.
- **Respuestas cortadas.** Si la IA llega al tope de largo, no manda el mensaje a medias: pasa la conversación al equipo.
- **Tiempos.** Cada pedido a Chatwoot y a Google tiene 20 segundos como máximo; a la IA, 60 con un reintento.

## Etapas automáticas

Después de responder, el asistente mueve al lead de etapa en el CRM según lo que pasó en ese mensaje (`lib/etapas/`):

- **Qué pasó:** el primer mensaje que le contesta; una respuesta más; la respuesta a un seguimiento automático (si lo último que le mandamos fue un seguimiento); y lo que marque la IA con `marcar_senal` (visita, señal de compra, no le interesa). Si pasa la conversación al equipo, también cuenta.
- **En la corrida de seguimientos:** cada seguimiento que sale, y «no respondió a ningún seguimiento» cuando ya no hay un paso más y pasó al menos una corrida (un día) desde el último.
- **A qué etapa:** lo que esté configurado para cada evento (hub o `/panel/etapas`). Si en un mismo mensaje pasan varias cosas, se aplican en orden.
- **Cuidados fijos:** no toca Reserva ni Vendido; dentro del embudo solo avanza; a En pausa o Descartado solo desde las primeras etapas; reactiva a quien vuelve a escribir. Antes de mover, vuelve a leer la fila del CRM.
- Si el CRM falla, la respuesta al interesado sale igual y el error queda en el registro.

## Qué guarda

- **La base (Neon):**
  - historial de mensajes;
  - qué proyecto y qué contacto del CRM tiene cada conversación, y lo que el asistente anotó de la persona;
  - mensajes ya respondidos;
  - registro de lo que hizo el bot.
- **CRM del hub:** contacto nuevo (etapa Contacto inicial, o Nuevo si no hay reglas de etapas; origen WhatsApp, con «Entró por WhatsApp (asistente)» en las notas), actividad tipo WhatsApp con el usuario «Asistente WhatsApp» (también cada seguimiento automático) y los **cambios de etapa** automáticos, anotados como «Cambio de etapa» ([`integracion-crm.md`](integracion-crm.md)). Nunca cambia los datos que cargó una persona. Las etapas y columnas son las del hub desde noviembre de 2026 (con la columna Tags); las etapas de antes se leen como las de ahora.

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
