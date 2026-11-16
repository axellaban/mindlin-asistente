# Outreach frío (línea 1)

Diseño del 16/11/2026, con lo que pidió Axel ese día. **Hecho: el paso 1** (la base del asistente y su API, ver «En qué orden se construye»). Lo demás, en [`PENDIENTES.md`](../PENDIENTES.md), en «Outreach frío (línea 1)».

## Qué es

La línea 1 le escribe primero a personas de las **bases de leads viejas de Mindlin**, que ellos van a cargar (probablemente desde planillas de Google).

- Son personas que alguna vez consultaron, pero hace mucho. Para WhatsApp son **contactos nuevos**: nunca hablaron con este número. Por eso se cuida la línea como en el outreach frío y no como en un seguimiento.
- Cuando alguien responde, entra al CRM y pasa al equipo (o a un flujo, o a la IA, según se configure).

La base viene del panel de prospección de Chapa Labs (`facundogregorini-lab/chapa-labs`, `/prospecting`, ver su `docs/PROSPECCION.md` y `docs/CENTRO_COMERCIAL.md`). Es lo que usan Turnia y habita.: misma lógica de embudo, cola, secuencia y envío. **Se rehace acá adaptado, no se copia el código.** Lo de las demos (Sofi, `/p/…`), PostHog, Meta Ads, el diseño de vidrio y la sincronización con planillas no se trae.

## La regla de WhatsApp, con su excepción

La regla general sigue: en las líneas de leads (3 y 4) no se le escribe a quien no escribió. **La línea 1 es la excepción**, autorizada por Axel el 16/11/2026, con estos cuidados. Todos se cambian desde el hub, salvo los marcados «fijo».

| Cuidado | De fábrica | Para qué |
| --- | --- | --- |
| Chip propio para la línea 1 | Fijo | Si WhatsApp bloquea el número, no se cae la línea de leads |
| Tope diario de mensajes automáticos (saludos y seguimientos; las respuestas en una charla no cuentan) | 20 | Un número nuevo que escribe mucho a desconocidos se bloquea |
| Subida gradual del tope | +5 por semana, hasta 60, **solo si la semana anterior no hubo frenos** | «Calentar» la línea sin apurarse |
| Tanda | 5 mensajes | Que no salgan todos juntos |
| Pausa mínima entre mensajes de la línea | Al azar, de 3 a 6 minutos (WAHA nativo); de 45 a 90 segundos (computer use) | Que parezca una persona |
| Franjas horarias (hora de Buenos Aires) | Lunes a viernes, de 10 a 13 y de 15 a 19; se pueden cargar feriados | Fuera de franja no sale nada, salvo «Mandar igual», que se confirma y vale ese día |
| Mensajes sin respuesta por persona | 2 (saludo y un seguimiento); como mucho, 3 (fijo) | No insistir |
| Textos | Al menos 2 variantes de cada mensaje, que se alternan | Cien mensajes idénticos son una señal de spam para WhatsApp |
| Freno automático | 3 «no salió» o 3 números inválidos seguidos, o la sesión de WAHA que deja de estar conectada (`WORKING`) | Revisar la línea antes de seguir |
| Baja | Para siempre y por teléfono, en todas las líneas (fijo) | Ver «Las respuestas» |

**El servidor es el que hace cumplir los cuidados**, no la pantalla. En cada envío, el asistente revisa:

- el tope del día;
- la franja horaria;
- la pausa desde el último mensaje de la línea;
- que no haya otro envío en curso;
- la baja;
- que el contacto esté tomado por quien manda.

Así, dos pestañas abiertas, una persona y un agente a la vez, o un reintento no pueden pasar de los límites.

Los cuidados de fábrica salen de lo que Turnia ya probó: 20 por día, tandas de 5 y pausas de 3 a 6 minutos. Si Mindlin quiere ir más rápido, se cambia en el hub; el riesgo de bloqueo lo asume Mindlin.

**Lo legal, para que lo confirme Mindlin con su abogado antes de la primera tanda** (no es una decisión técnica):

- **Registro Nacional No Llame** (ley 26.951): si aplica a WhatsApp y si hay que cruzar la base con el registro.
- **Datos personales** (ley 25.326): que la base se haya juntado con consentimiento para que los contacten.

El panel deja cargar una lista de números excluidos para eso.

## Los dos modos de envío

Se elige por línea, y se pueden usar los dos a la vez: comparten la cola, el tope y las pausas.

1. **WAHA nativo.** El servidor manda el mensaje directo por la línea, sin abrir WhatsApp.
   - Antes de mandar, WAHA pregunta si el número tiene WhatsApp. Eso no le manda nada a nadie.
   - Manda texto y también audios como nota de voz, fotos y PDF.
   - «Mandarme una prueba» manda el mensaje a un número del equipo.
   - **Cómo corre en Vercel Hobby:** una pausa de 3 a 6 minutos no entra en una función de Vercel, y el cron es una vez por día. Primera versión: la tanda la maneja la **pantalla del hub mientras está abierta**. Cada mensaje es un pedido al asistente, que hace cumplir los cuidados. Si se cierra la pantalla, la tanda se frena. Chrome demora los relojes de una pestaña en segundo plano (hasta un minuto), pero con pausas de minutos no cambia nada. Después, si hace falta que salga sola, un proceso chico en el servidor de Easypanel que haga lo mismo.
2. **Computer use.** Un agente de IA en el navegador (por ejemplo, Claude en Chrome) abre WhatsApp Web **con la sesión del número de la línea 1**, escribe y confirma, como una persona. También lo puede hacer una persona.
   - WhatsApp Web es un dispositivo vinculado más, como WAHA, así que lo que se manda desde ahí también entra a Chatwoot.
   - La pantalla **«Enviar»** muestra una tarjeta por vez: nombre, teléfono, el texto exacto y los botones «Abrir WhatsApp», «Salió», «No salió», «No tiene WhatsApp» y «Saltar».
   - Cada elemento lleva un `data-testid` estable, y la tarjeta tiene un estado en `data-state`: `ready`, `opened`, `wait`, `paused`, `done` o `stopped`.
   - La vista trae las **instrucciones para el agente**, listas para copiar. Entre otras cosas, le piden verificar el nombre y el número del chat antes de escribir.
   - Abierta con `?agente=1`, todo lo que se confirma desde esa pestaña queda marcado como hecho por el bot y no por una persona.
   - Abrir WhatsApp **no cuenta** como envío: cuenta cuando se confirma que salió. Si el mensaje ya entró a Chatwoot, se confirma solo.
   - Los diálogos del navegador (`confirm()`) traban a los agentes, así que no se usan: las confirmaciones van en la página, con doble toque.

En los dos modos, **tomar** un contacto lo reserva 10 minutos. Así una persona y el agente, o dos personas, no le escriben al mismo. Confirmar dos veces el mismo envío no suma dos.

## La secuencia

Configurable desde el hub, con versiones A/B. Es la de Turnia, adaptada:

1. **Saludo**, solo texto y sin link: «Hola {nombre}, ¿cómo estás? Te escribo de Mindlin Developers…».
2. **Si responde:** se elige qué pasa. Puede ir el mensaje con el proyecto (texto, brochure, foto o audio), pasar al equipo, seguir un flujo o atender la IA.
3. **Si no responde:** un seguimiento a los 2 días hábiles, y no más.

Los seguimientos no los manda un cron: **entran a la cola del día** y salen en la tanda, con los mismos cuidados. Así funciona igual en el plan Hobby.

Variables: `{nombre}`, `{proyecto}` (el que consultó en su momento, si la base lo trae) y `{link}`. Si falta el nombre, el texto no lo usa. **Los textos los escribe Mindlin.** Mientras tanto, el hub trae un borrador marcado «Borrador: revisar» y **no deja empezar a mandar con textos en borrador**.

## Las respuestas

Acá estamos mejor que Turnia, que lee WhatsApp una vez por día. A la línea 1 se le asigna el Agent Bot en Chatwoot, y **cada respuesta llega en el momento** por el webhook que ya existe.

- **Lo que sale de la línea 1:** el saludo que sale por WAHA o por WhatsApp Web vuelve a Chatwoot como mensaje saliente. En la línea 1 eso **no** se lee como «escribió el equipo». Si coincide con un envío de la cola, lo confirma.
- **La respuesta** queda en el contacto de outreach, y la cola deja de mandarle la secuencia.
- **Respuestas automáticas** («Gracias por comunicarte con…», «Nuestro horario…», «Esta empresa usa un servicio seguro de Meta…»): van aparte, no cuentan como respuesta y no se contestan. La regla es la de Turnia, `isAutomaticReply`.
- **«No me escriban más»:** la regla que ya existe ([`baja.md`](baja.md)).
  - Hoy esa baja se guarda por conversación.
  - Para el outreach se guarda también **por teléfono**: a quien pidió la baja en cualquier línea no se le escribe desde la 1, y quien la pide en la 1 no recibe seguimientos en ninguna.
- **Qué pasa después** (configurable por línea): pasa al equipo con una nota (como hoy), sigue un flujo o atiende la IA con las fichas.
- **Al CRM** entra quien responde, salvo una respuesta automática o un «no». Entra con el origen «WhatsApp», la etiqueta de la base (como campaña) y la etapa de primer contacto. Quien no responde no entra, así el CRM no se llena de contactos fríos. Si el teléfono ya estaba en el CRM, se suma la actividad al lead que ya existe: no se crea otro.
- **Bandeja «Responder»** en el hub: quiénes respondieron, su último mensaje textual y una respuesta sugerida, con «Copiar», «Abrir chat» y «Ya lo mandé».

## Prospectos: cargar la base

- **Cargar:** pegar desde una planilla (copiar las columnas y pegarlas) o subir un CSV. Más adelante, si lo piden, leer una planilla de Google compartida con la cuenta de servicio, la misma del CRM.
- **Columnas que reconoce:** nombre, teléfono, proyecto que consultó, fecha de la consulta, origen y notas. Lo demás se guarda como nota. Antes de guardar, una vista previa muestra cómo leyó cada columna y cuántos entran.
- **Teléfonos argentinos:** se pasan a 549 + área + número, sin el 0 ni el 15 («011 15 …», «0221 15-…», «+54 9 …»). Lo que no se puede leer con seguridad queda **«Por revisar»**: se ve, pero no entra a la cola.
- **Quiénes no entran a la cola:**
  - los repetidos, dentro de la base y contra lo ya cargado; un número compartido aparece una sola vez;
  - quien pidió la baja o está en la lista de excluidos;
  - quien en el CRM está en Reserva o Vendido;
  - quien tiene una conversación abierta con el equipo, o escribió a las líneas 3 o 4 en los últimos 30 días: ya está hablando con Mindlin.
  - **Descartado en el CRM:** se excluye de fábrica. Se puede incluir por lote, si la idea es reactivarlos.
- **Lote:** cada carga es un lote con nombre (por ejemplo, «Leads Kommo 2024»), para medirlos por separado. Un lote se puede pausar o borrar entero.
- **«Verificar 20 números»** (con WAHA): pregunta si tienen WhatsApp, de a poco, sin mandar nada.
- **Orden de la cola: el puntaje** (abajo, «El puntaje»). Se puede elegir a uno a mano.

## El puntaje (16/11)

Idea traída del ranking de prospectos de Chapa Labs (habita.), adaptada a leads viejos de departamentos. Cada persona tiene un puntaje de 0 a 100 que dice a quién conviene escribirle primero. Se ve con el detalle de lo que sumó cada cosa. Los pesos se cambian desde el hub (0 apaga una variable) y, al cambiarlos, se recalcula todo.

| Variable | De fábrica |
| --- | --- |
| Hace cuánto consultó | Menos de 6 meses 25 · de 6 a 12 meses 18 · de 1 a 2 años 10 · más 4 · sin fecha 6 |
| Proyecto | Con ficha activa 20 · con ficha apagada 8 |
| Hasta dónde llegó en el CRM | Visita o negociación 25 · seguimiento 12 · nuevo 4 |
| De dónde vino (el origen contiene…) | Referido o recomendación 15 · web 8 · Instagram, Facebook, Meta o Google 6 · portales 4 |
| Datos | Nombre 4 · proyecto 4 |
| WhatsApp verificado | 8 |

- **La cola sale por puntaje**, salvo los seguimientos que ya tocan, que van primero.
- **Un 15 % de los nuevos sale al azar** (configurable, de 0 a 50 %). Sin eso, los de puntaje bajo nunca se contactan y no se puede saber si el puntaje acierta. Queda marcado en cada envío.
- **Aprendizajes:** cuánto responde cada valor de cada variable, de todos y solo de los que salieron al azar, y por franja de puntaje. Si el puntaje acierta, los de 70 a 100 responden más que los de 0 a 39. Con menos de 30 casos, «muestra chica». No se cambian los pesos solos: decide una persona.
- **Cuando alguien responde**, entra al CRM y desde ahí manda el scoring del hub (HQ → Comercial → Scoring).
- Código: `lib/outreach/puntaje.ts` (puro, con pruebas).

## El embudo y los resultados

- **Embudo contra la meta:** cargados → con WhatsApp → contactados → respondieron → interesados → visita → reserva. Cada paso incluye a los siguientes. Las metas se cambian en el hub.
  - Interesados, visita y reserva salen de la etapa del lead en el CRM.
  - Las respuestas automáticas no cuentan como «respondieron».
- **Por lote y por versión del mensaje:** cuántos respondieron dentro de los 7 días del primer contacto. Con menos de 30 casos, se marca «muestra chica». No hay versión «ganadora» automática: decide una persona.
- **Ejecución:** cuántos salieron por día, por quién (persona o bot), por qué modo (WAHA o computer use) y cuántos frenos hubo.

## Dónde se guarda

En la base del asistente (Neon), con una migración nueva. Nombres orientativos:

| Tabla | Qué guarda |
| --- | --- |
| `outreach_lotes` | Cada carga: nombre, origen, fecha, quién, si está pausado y si incluye a los descartados |
| `outreach_contactos` | Una fila por persona: lote, nombre, teléfono, proyecto, etapa (`por_revisar`, `por_contactar`, `saludado`, `respondio`, `interesado`, `cerrado`, `invalido`, `baja`), mensajes sin respuesta, línea, `tiene_whatsapp`, próxima acción y su fecha, toma (quién y hasta cuándo), id del lead del CRM y conversación de Chatwoot |
| `outreach_eventos` | Lo que pasó; solo se agrega. Envío, no salió, respuesta, baja, verificación y freno, con modo, versión, quién, si fue persona o bot, y una clave para no contar dos veces el mismo envío |
| `outreach_config` | Por línea: cuidados, franjas, feriados, excluidos, secuencia y versiones, qué pasa al responder y metas |
| `bajas` | Teléfonos que pidieron la baja, con fecha y línea. Lo leen el outreach y los seguimientos |

**Los datos son personales:** solo los ve quien tiene el permiso del módulo en el hub. No van al repo ni a las pruebas: las pruebas usan datos inventados. Borrar un lote borra sus contactos y deja en los eventos solo los totales.

## WAHA nativo, en el código (paso 4)

- **Las variables:** `WAHA_URL` y `WAHA_API_KEY` en Vercel; las carga la tarea 16. La sesión de la línea va en `config.waha_sesion` (de fábrica, «linea1»).
- **`POST outreach/{línea}/enviar` manda uno por pedido:**
  1. toma el siguiente, con todos los cuidados;
  2. revisa que la sesión esté conectada (`WORKING`; si no, frena la línea);
  3. si el número no está verificado, pregunta si tiene WhatsApp;
  4. manda el texto y confirma.
- **Si el número no tiene WhatsApp**, queda inválido sin contar como falla: en las bases viejas hay muchos fijos, y eso no dice nada de la salud de la línea. **Si el mensaje no sale**, cuenta como falla.
- **La tanda la maneja la pantalla del hub:** llama, espera la pausa (`espera.hasta`) y vuelve a llamar, hasta la tanda o el tope. Si se cierra la pantalla, se frena.
- **El eco:** lo que sale por WAHA vuelve a Chatwoot como saliente. El webhook no lo confirma de nuevo (la clave de la toma empieza con «waha-»).
- **«Verificar números»** (de a 20, sin mandar nada) y **«Mandarme una prueba»** (el saludo a un número del equipo, sin contar).
- **Por ahora, solo texto.** Las fotos, los audios y los PDF de la secuencia van después, si Mindlin los pide.

## Las respuestas, en el código (paso 3)

- El webhook reconoce la línea de outreach por la bandeja y le pasa **todos** sus mensajes a `lib/outreach/webhook.ts`, esté como esté la conversación (una respuesta en una conversación abierta también se anota).
- **Lo que sale por la línea** no corre al asistente ni abre la conversación. Si el texto y el teléfono coinciden con el contacto tomado, el envío se confirma solo.
- **Lo que entra** se clasifica (`lib/outreach/respuestas.ts`):
  - **automática:** se anota y no cuenta;
  - **baja:** baja por teléfono, se le contesta una vez y queda la nota;
  - **no:** queda cerrado;
  - **equivocado:** queda inválido;
  - **respuesta:** el contacto pasa a «respondió» y se corta la secuencia. Entra al CRM con la etapa «Contacto inicial» y la etiqueta «Outreach: {base}», o, si ya estaba, se le suma la actividad. Después hace lo que diga `al_responder`.
- **Reintentos:** si Chatwoot reintenta el mismo mensaje, no se anota dos veces. El alta en el CRM y el aviso salen solo con la primera respuesta.
- **Alguien que no está en la base** y escribe a la línea 1: pasa al equipo, como antes.
- **La baja ahora es también por teléfono, en todas las líneas.** Quien la pide en la 3 o la 4 no recibe nada del outreach, y quien la pide en la 1 no recibe seguimientos en ninguna. Se guarda en la tabla `bajas`.
- **Arreglo de paso:** el registro no aceptaba el tipo «pidio_baja», y en producción el asistente fallaba al anotar una baja. Lo arregla la migración `202611160017_registro_baja.sql`.

## El código (paso 1)

| Archivo | Qué hace |
| --- | --- |
| `lib/outreach/telefono.ts` | Los teléfonos argentinos al formato 549…; lo dudoso, con su motivo |
| `lib/outreach/importar.ts` | Leer lo pegado o un CSV (títulos reconocidos por nombre) y decidir quién entra a la cola |
| `lib/outreach/reglas.ts` | Los cuidados (validar, de fábrica), el reloj de Buenos Aires, las franjas, los días hábiles, el tope que sube, los textos y «¿puede salir ahora?» |
| `lib/outreach/datos.ts` | La base: lotes, cola, toma de 10 minutos (con la línea bloqueada), confirmar sin contar dos veces, fallas y freno, baja por teléfono |
| `lib/outreach/api.ts` | Las direcciones `/api/hub/outreach/…` |

Pruebas: las puras corren siempre; `datos.test.ts`, contra un Postgres de verdad (como en el control Verificar).

**Cola, en orden:** primero los seguimientos que ya tocan; después los nuevos, de la consulta más reciente a la más vieja y, a igual fecha, los de un proyecto con ficha activa. «No salió» lo pasa al día hábil siguiente; «Saltar», 4 horas.

## Qué se reutiliza de lo que ya hay

- **Líneas** (`lib/lineas.ts`): la línea 1 ya existe, con su tipo `outreach_frio`. Hoy, si alguien responde, pasa al equipo con una nota. Eso cambia a anotar la respuesta y hacer lo que esté configurado.
- **Baja** (`lib/baja.ts`), **campañas** (`lib/campanias.ts`, para la etiqueta del lote), **CRM** (`lib/crm`) y **Chatwoot** (`lib/chatwoot`).
- **Flujos:** «si responde, sigue un flujo» usa el motor de `lib/flujos`.
- **El hub:** la línea 1 deja de decir «Próximamente» y suma sus solapas: Prospectos · Enviar · Responder · Secuencia · Resultados · Conexión. Lleva su doc en `docs/` del hub.

## Lo que hay que averiguar antes de construir el modo WAHA

- **Cómo sale un primer mensaje.** Lo recomendable es la API de WAHA directo (`sendText`, `sendVoice`, `checkNumberStatus`), y no crear la conversación en Chatwoot. Hay que confirmar en la línea de prueba:
  - que el mensaje aparece en Chatwoot como saliente, en la bandeja de la línea 1;
  - que la respuesta entra a esa misma conversación.
- **Las variables:** el asistente necesita `WAHA_URL` y `WAHA_API_KEY` en Vercel (se suman a `.env.example`, solo los nombres). Las carga la IA de paneles en la tarea 16.

## En qué orden se construye

Cada paso es un PR chico, con pruebas y su doc.

1. **Asistente** (hecho el 16/11: `db/migraciones/202611160015_outreach.sql` y `lib/outreach/`; la API, en [`api-hub.md`](api-hub.md), «Outreach frío»):
   - la migración (incluida `bajas`);
   - cargar la base, con la vista previa, los teléfonos y los cruces;
   - la cola, con la toma de 10 minutos;
   - confirmar o «no salió», con la clave para no contar dos veces;
   - los cuidados, que hace cumplir el servidor;
   - la API para el hub.
2. **Hub, línea 1:**
   - Prospectos (cargar y ver);
   - Secuencia (textos, variantes, versiones y cuidados);
   - **Enviar con computer use** (tarjeta con `data-testid`, `?agente=1` e instrucciones para el agente). No necesita WAHA y se puede usar ya.
3. **Respuestas por el webhook** (hecho el 16/11: `lib/outreach/webhook.ts` y `respuestas.ts`):
   - los mensajes salientes de la línea 1;
   - las respuestas automáticas;
   - la baja por teléfono;
   - el alta en el CRM;
   - qué pasa después (equipo, flujo o IA);
   - la bandeja «Responder».
4. **WAHA nativo** (hecho el 16/11 en el asistente: `lib/outreach/waha.ts` y `enviarPorWaha`; falta la tarea 16 y la pantalla del hub): verificar números, la tanda desde el hub, «Mandarme una prueba» y el freno por sesión caída. Antes, la prueba de la tarea 16.
5. **Embudo y resultados:** el embudo contra la meta, los resultados por lote y por versión, y la subida gradual del tope.
6. **Si hace falta:** el proceso en el servidor, para que la tanda salga sin el hub abierto.

**QA antes de la primera tanda real:** con un lote de 5 números del equipo, en los dos modos. Hay que probar:

- el tope, la pausa y la franja, también con dos pestañas abiertas;
- la toma, una persona y el agente a la vez;
- «no salió» y el freno;
- una respuesta automática, un «no me escriban más» y una respuesta real, que tiene que entrar al CRM una sola vez;
- un número inválido;
- un número que ya estaba en el CRM.

Recién después, la primera tanda de 20.
