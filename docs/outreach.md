# Outreach frío (línea 1)

Diseño del 16/11/2026, con lo que pidió Axel ese día. **Todavía no está hecho:** este documento es el plan para construirlo. Las tareas están en [`PENDIENTES.md`](../PENDIENTES.md), en «Outreach frío (línea 1)».

## Qué es

La línea 1 le escribe primero a personas de las **bases de leads viejas de Mindlin**, que ellos van a cargar (probablemente desde planillas de Google).

- Son personas que alguna vez consultaron, pero hace mucho. Para WhatsApp son **contactos nuevos**: nunca hablaron con este número. Por eso se cuida la línea como en el outreach frío y no como en un seguimiento.
- Cuando alguien responde con interés, entra al CRM y pasa al equipo (o a un flujo, o a la IA, según se configure).

La base viene del panel de prospección de Chapa Labs (`facundogregorini-lab/chapa-labs`, `/prospecting`, ver su `docs/PROSPECCION.md` y `docs/CENTRO_COMERCIAL.md`). Es lo que usan Turnia y habita.: misma lógica de embudo, cola, secuencia y envío. **Se rehace acá adaptado, no se copia el código.** Lo de las demos (Sofi, `/p/…`), PostHog, Meta Ads, el diseño de vidrio y la sincronización con planillas no se trae.

## La regla de WhatsApp, con su excepción

La regla general sigue: en las líneas de leads (3 y 4) no se le escribe a quien no escribió. **La línea 1 es la excepción**, autorizada por Axel el 16/11/2026, con estos cuidados, todos configurables desde el hub:

| Cuidado | De fábrica | Para qué |
| --- | --- | --- |
| Chip propio para la línea 1 | Obligatorio | Si WhatsApp bloquea el número, no se cae la línea de leads |
| Tope diario de primeros mensajes | 20 | Un número nuevo que escribe mucho a desconocidos se bloquea |
| Subida gradual del tope | +5 por semana, hasta 60 | «Calentar» la línea |
| Tanda | 5 mensajes | Que no salgan todos juntos |
| Pausa entre mensajes (WAHA nativo) | Al azar, de 3 a 6 minutos | Que parezca una persona |
| Pausa entre envíos (computer use) | Al azar, de 45 a 90 segundos | La del agente en WhatsApp Web |
| Franjas horarias | Lunes a viernes, de 10 a 13 y de 15 a 19 (hora de Buenos Aires) | Fuera de horario no sale nada, salvo «Mandar igual» confirmado |
| Mensajes por persona | 3 como máximo | Saludo, link y un seguimiento |
| Freno automático | 3 «no salió» o 3 números inválidos seguidos | Revisar la línea antes de seguir |
| Baja | Para siempre | «No me escriban más» corta todo, en todas las líneas |

Los cuidados de fábrica salen de lo que Turnia ya probó (20 por día, tandas de 5, pausas de 3 a 6 minutos). Si Mindlin quiere ir más rápido, se cambia en el hub. El riesgo de bloqueo lo asume Mindlin.

## Los dos modos de envío

Se elige por línea, y se pueden usar los dos.

1. **WAHA nativo.** El servidor manda el mensaje directo por la línea, sin abrir WhatsApp. Respeta el tope, las tandas, las pausas y las franjas.
   - Antes de mandar, WAHA pregunta si el número tiene WhatsApp. Eso no le manda nada a nadie.
   - Manda texto y también audios como nota de voz, fotos y PDF.
   - «Mandarme una prueba» manda el mensaje a un número del equipo.
   - **Cómo corre en Vercel Hobby:** una pausa de 3 a 6 minutos no entra en una función de Vercel, y el cron es una vez por día. Primera versión: la tanda la maneja la **pantalla del hub mientras está abierta**. Cada mensaje es un pedido al asistente, que vuelve a revisar el tope, el horario y la baja antes de mandar. Si se cierra la pantalla, la tanda se frena. Después, si hace falta que salga sola, un proceso chico en el servidor de Easypanel que haga lo mismo.
2. **Computer use.** Un agente de IA en el navegador (por ejemplo, Claude en Chrome) abre WhatsApp Web, escribe y confirma, como una persona. También lo puede hacer una persona.
   - La pantalla **«Enviar»** muestra una tarjeta por vez: nombre, teléfono, el texto exacto y los botones «Abrir WhatsApp», «Salió», «No salió», «No tiene WhatsApp» y «Saltar».
   - Cada elemento lleva un `data-testid` estable, y la tarjeta tiene un estado en `data-state`: `ready`, `opened`, `wait`, `paused`, `done` o `stopped`.
   - La vista trae las **instrucciones para el agente**, listas para copiar.
   - Abierta con `?agente=1`, todo lo que se confirma desde esa pestaña queda marcado como hecho por el bot y no por una persona.
   - Abrir WhatsApp **no cuenta** como envío: cuenta cuando se confirma que salió.
   - Los diálogos del navegador (`confirm()`) traban a los agentes, así que no se usan: las confirmaciones van en la página, con doble toque.

En los dos modos, **tomar** un contacto lo reserva 10 minutos. Así una persona y el agente, o dos personas, no le escriben al mismo. Confirmar dos veces el mismo envío no suma dos.

## La secuencia

Configurable desde el hub, con versiones A/B. Es la de Turnia, adaptada:

1. **Saludo**, solo texto y sin link: «Hola {nombre}, ¿cómo estás? Te escribo de Mindlin Developers…».
2. **Si responde:** el mensaje con el proyecto (texto, brochure, foto o audio), o directamente al equipo, a un flujo o a la IA. Se elige qué hacer.
3. **Si no responde:** un seguimiento a los 2 días hábiles, y no más. Son 3 mensajes como máximo por persona.

Variables: `{nombre}`, `{proyecto}` (el que consultó en su momento, si la base lo trae) y `{link}`. Los textos los escribe Mindlin. Mientras tanto, el hub trae un borrador marcado «Borrador: revisar».

## Las respuestas

Acá estamos mejor que Turnia, que lee WhatsApp una vez por día. A la línea 1 se le asigna el Agent Bot en Chatwoot, y **cada respuesta llega en el momento** por el webhook que ya existe.

- La respuesta queda en el contacto de outreach y la cola deja de mandarle la secuencia.
- **Respuestas automáticas** («Gracias por comunicarte con…», «Nuestro horario…», «Esta empresa usa un servicio seguro de Meta…»): van aparte, no cuentan como respuesta y no se contestan. La regla es la de Turnia, `isAutomaticReply`.
- **«No me escriban más»:** baja para siempre, con la regla que ya existe ([`baja.md`](baja.md)).
- **Qué pasa después** (configurable por línea): pasa al equipo con una nota (como hoy), sigue un flujo o atiende la IA con las fichas.
- **Al CRM** entra **solo quien responde con interés**, con el origen «WhatsApp», la etiqueta de la base y la etapa de primer contacto. Así el CRM no se llena de contactos fríos. Si el teléfono ya estaba en el CRM, se suma la actividad al lead que ya existe: no se crea otro.
- **Bandeja «Responder»** en el hub: quiénes respondieron, su último mensaje textual y una respuesta sugerida, con «Copiar», «Abrir chat» y «Ya lo mandé».

## Prospectos: cargar la base

- **Cargar:** pegar desde una planilla (copiar las columnas y pegarlas) o subir un CSV. Más adelante, si lo piden, leer una planilla de Google compartida con la cuenta de servicio, la misma del CRM.
- **Columnas que reconoce:** nombre, teléfono, proyecto que consultó, fecha de la consulta, origen y notas. Lo demás se guarda como nota.
- **Al cargar:**
  - se normaliza el teléfono al formato 549…;
  - se sacan los repetidos, dentro de la base y contra lo ya cargado;
  - se marca a quien ya está en el CRM con una etapa avanzada (Reserva, Vendido) o como Descartado, y a quien pidió la baja;
  - un número compartido aparece una sola vez.
- **Lote:** cada carga es un lote con nombre (por ejemplo, «Leads Kommo 2024»), para medirlos por separado.
- **«Verificar 20 números»:** WAHA pregunta si tienen WhatsApp, de a poco, sin mandar nada.
- **Orden de la cola:** primero los más recientes y los que consultaron por un proyecto que hoy tiene ficha activa. Se puede cambiar a mano.

## El embudo y los resultados

- **Embudo contra la meta:** cargados → con WhatsApp → contactados → respondieron → interesados → visita → reserva. Cada paso incluye a los siguientes. Las metas se cambian en el hub.
- **Por lote y por versión del mensaje:** cuántos respondieron dentro de los 7 días del primer contacto. Con menos de 30 casos, se marca «muestra chica».
- **Ejecución:** cuántos salieron por día, por quién (persona o bot) y por qué modo (WAHA o computer use).

## Dónde se guarda

En la base del asistente (Neon), con una migración nueva. Nombres orientativos:

| Tabla | Qué guarda |
| --- | --- |
| `outreach_lotes` | Cada carga: nombre, origen, fecha, quién |
| `outreach_contactos` | Una fila por persona: lote, nombre, teléfono, proyecto, etapa (`por_contactar`, `saludado`, `respondio`, `interesado`, `cerrado`, `invalido`, `baja`), mensajes usados, línea, `tiene_whatsapp`, próxima acción, toma (quién y hasta cuándo), id del lead del CRM |
| `outreach_eventos` | Lo que pasó, solo se agrega: envío, no salió, respuesta, baja, verificación. Con modo, versión, quién y si fue persona o bot |
| `outreach_config` | Por línea: cuidados, franjas, secuencia y versiones, qué pasa al responder, metas |

## Qué se reutiliza de lo que ya hay

- **Líneas** (`lib/lineas.ts`): la línea 1 ya existe, con su tipo `outreach_frio`. Hoy, si alguien responde, pasa al equipo con una nota: eso cambia a anotar la respuesta y hacer lo configurado.
- **Baja** (`lib/baja.ts`), **campañas** (`lib/campanias.ts`, la etiqueta del lote), **CRM** (`lib/crm`) y **Chatwoot** (`lib/chatwoot`).
- **Flujos:** «si responde, sigue un flujo» usa el motor de `lib/flujos`.
- **El hub:** la línea 1 deja de decir «Próximamente» y suma sus solapas: Prospectos · Enviar · Responder · Secuencia · Resultados · Conexión.

## Lo que hay que averiguar antes de construir

- **Cómo sale un primer mensaje:** si va por la API de WAHA (`sendText`, `sendVoice`, `checkNumberStatus`) o creando la conversación en Chatwoot. Lo recomendable es WAHA directo, y confirmar en la línea de prueba que el mensaje aparece en Chatwoot como saliente y que la respuesta entra a la bandeja de la línea 1. El asistente necesita la URL y la clave de WAHA en Vercel (variables nuevas `WAHA_URL` y `WAHA_API_KEY`, que carga la IA de paneles).
- **Que el asistente no se confunda con su propio mensaje:** el saludo que sale por WAHA vuelve a Chatwoot como saliente, y no tiene que leerse como «escribió el equipo».

## En qué orden se construye

1. Base y API del asistente: tablas, cargar la base, la cola (con la toma de 10 minutos), confirmar o no salió, y los cuidados.
2. Hub: Prospectos (cargar y ver), Secuencia (textos, versiones y cuidados) y **Enviar con computer use**. Esto no necesita WAHA y se puede usar ya.
3. Respuestas por el webhook: respuestas automáticas, baja, CRM y qué pasa después. Más la bandeja «Responder».
4. **WAHA nativo:** verificar números, la tanda desde la pantalla del hub y «Mandarme una prueba».
5. Embudo, resultados y la subida gradual del tope.
6. Si hace falta, el proceso en el servidor para que la tanda salga sin el hub abierto.
