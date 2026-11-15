# Pendientes

El alcance es el de la **propuesta de Mindlin para la primera versión** (cinco puntos: conversación por WhatsApp con su forma de hablar, contexto por proyecto, conexión con su CRM, seguimientos y que el equipo pueda intervenir). Lo que la propuesta deja para después está al final, en «Fuera de esta versión».

Dueños:
- **Claude:** el código.
- **Panel:** la IA con computer use, o Axel. Sus tareas están en [`IA_DE_PANELES.md`](IA_DE_PANELES.md) y anota los resultados en [`docs/estado-paneles.md`](docs/estado-paneles.md).
- **Axel.**
- **Mindlin:** el cliente.

Al terminar una tarea: marcarla `[x]`, con la fecha y lo que el siguiente necesita saber (sin claves).

## Lo próximo, en orden (para atender consultas reales)

**El asistente contesta por WhatsApp de punta a punta** (tarea 10, 13/11, con datos inventados). Responde con la ficha de Lerma 439, anota al interesado en el CRM, le mueve la etapa y pasa la conversación al equipo cuando hace falta. No hubo eco, y un número nuevo lo atiende solo. Detalle en [`docs/estado-paneles.md`](docs/estado-paneles.md), «Prueba de punta a punta (Easypanel)».

- **Servidor:** Easypanel en el mismo VPS. Chatwoot 4.19.1 en `chat.mindlindevelopers.com` y WAHA 2026.10.1 en `waha.mindlindevelopers.com`, los cinco contenedores en verde, swap y respaldo nocturno.
- **Línea:** vinculada (`WORKING`), bandeja 1 «WhatsApp Lerma 439», cuenta 1 «Mindlin Developers», con el Agent Bot asignado.
- **IA:** responde OpenAI (`gpt-6.1-sol`).
- **Vercel:** el proyecto está en la cuenta `mindlindevelopers.ia` (plan Hobby). Por eso el cron de seguimientos corre una vez por día ([#17](https://github.com/axellaban/mindlin-asistente/pull/17)) y el repo es público. Las dos cosas se revierten si vuelve a un plan Pro.
- **Hub:** conectado. Todo se configura desde HQ → Comercial → Asistente de WhatsApp, y «Probar las conexiones» dice qué pieza no anda.
- **Lo que más confunde:** el asistente solo atiende conversaciones **pendientes**. Si alguien del equipo escribe desde Chatwoot, se corre a propósito y la conversación queda abierta; para devolvérsela, se la marca «Pendiente».

**Líneas y flujos (15/11).** El asistente maneja las cuatro líneas que pidió Mindlin ([`docs/lineas.md`](docs/lineas.md)): 1 outreach frío, 2 equipo (facturas y outreach cálido), 3 y 4 leads entrantes. La 3 es la que ya andaba. Cada línea de leads se configura aparte: modo, instrucciones, proyectos, seguimientos y **flujos como los bots de Kommo** ([`docs/flujos.md`](docs/flujos.md)), que se arman en el hub con un editor de pasos.

1. **Panel con Axel:** la QA en producción de las líneas y los flujos (tarea 12 de [`IA_DE_PANELES.md`](IA_DE_PANELES.md)). Después, cuando Axel tenga el chip o número de la línea 4, conectarla (tarea 11).
2. **Claude:** la QA desde el código y, después, las conversaciones en el hub. Ver «Traspaso para la próxima sesión».
3. **Mindlin:** armar en el hub el flujo de cada proyecto a partir de los modelos (los textos de Kommo) y probarlo en Probar. Los flujos arrancan apagados: se prenden de a uno.
4. **Mindlin (pendiente de recibir):** qué tiene que tener el panel de **outreach frío** (línea 1). Hasta entonces la línea existe, pero el asistente no hace nada ahí.
5. **Al final:** la línea 2, con lo que hoy hace el bot de Telegram (documento «Bot de Telegram: todo lo que hace», 14/11). Antes hay que decidir sus «Decisiones a tomar» (ver abajo).
6. **Axel:** las decisiones que destraban el piloto: activar los seguimientos con Mindlin (hoy hay 6 reglas cargadas y todas archivadas: no sale ninguno), qué hacer con el contacto de prueba del CRM y con qué IA responde. Ver «Decisiones abiertas».
7. **Mindlin:** revisar los borradores que se cargaron desde Kommo ([`docs/kommo.md`](docs/kommo.md)): la ficha de Lerma 439 y las cinco apagadas, el modo de cada línea («presenta y pasa» o conversar), el horario del equipo, los seguimientos y las etapas automáticas. Probarlo desde el hub (pestaña Probar).
8. **Axel y Panel:** el equipo en Chatwoot y la app del celular (tarea 7), que depende del correo de Chatwoot.
9. **Todos:** pruebas internas con el equipo y, después, consultas reales en la línea de Lerma 439.
10. **Claude con Axel:** revisar las respuestas de las primeras conversaciones y ajustar el tono con el material de Mindlin.

## Decisiones abiertas

- [ ] Correo para Chatwoot (invitaciones a agentes y avisos; también hace falta para el email más adelante). Opciones: Zoho (donde están los correos de Mindlin), Google Workspace o un servicio como Brevo. — Axel
- [x] ~~Los contactos que da de alta el asistente, ¿entran en «Nuevo» o en «Contacto inicial»?~~ Desde el 11/11 entran en **«Contacto inicial»**, la etapa del evento «El asistente le respondió por primera vez», así no disparan la alarma «nuevo sin contactar en 2 h». Si Mindlin prefiere que entren en «Nuevo», se cambia ese evento a «No mover» en Etapas automáticas. — Claude, 13/11
- [ ] Seguimientos: quedaron cargados y **archivados** los de Kommo (6 reglas, uno por proyecto, a las 24 h). Falta revisarlos, pasarlos a «Activa» (hub → Seguimientos, o `/panel/seguimientos`) y decidir si se suman más pasos. Sin reglas activas no sale ninguno. — Axel con Mindlin
- [ ] El contacto de prueba del CRM (`cmwb5wcob9uz6`, «Juan Prueba», hoy en «Visita / reunión»): ¿se borra o se pasa a «Descartado»? Lo crearon las pruebas del 10/11 y del 13/11. — Axel
- [ ] Modo de atención de cada línea de leads: ¿«presenta y pasa» (como Kommo: cuando la persona responde, sigue el equipo), que el asistente siga la conversación (como está hoy) o un flujo? Desde el 15/11 se elige por línea en el hub (la línea → Inteligencia comercial y Flujos). La 3 conservó el modo que tenía el tono. — Mindlin
- [ ] Para qué es la línea 4 (otra campaña, otra zona, otros proyectos) y qué proyectos atiende. — Mindlin
- [ ] Línea 2 (bot de Telegram a WhatsApp), antes de empezarla: ¿el mismo número que el asistente comercial o uno aparte? (el documento recomienda uno aparte, que es la línea 2); ¿qué avisos siguen por WhatsApp? (con WAHA no hay plantillas pagas, pero escribirle a alguien que no habló en 24 h tiene riesgo de bloqueo); ¿convivencia con Telegram unas semanas o corte? — Mindlin con Axel
- [ ] Etapas automáticas: revisar las de fábrica (Comercial → Asistente de WhatsApp → Etapas automáticas). Por ejemplo, ¿«señal de compra» tiene que mover a Negociación? Hoy no mueve. — Mindlin
- [ ] VIA 53 y Torre Cuatro Vientos: los dos documentos de Mindlin tienen datos distintos (precios, entrega, forma de pago, el semipiso). Confirmar cuáles valen antes de activarlos (está en las notas internas de cada ficha). — Mindlin
- [ ] Con qué IA responde. Acá quedó decidido Claude (10/11), pero en producción responde OpenAI (`gpt-6.1-sol`, cargado por Panel el 10/11 para la prueba de la línea; con ese anduvo la prueba de punta a punta del 13/11). Los dos andan; hay que elegir uno y dejarlo en Vercel. — Axel
- [ ] Horario del equipo comercial: hoy es de lunes a viernes de 9 a 20 (fuera de eso, si pasa la conversación avisa que le escriben apenas vuelvan). ¿Es así? Desde el 13/11 se cambia en el hub: Inteligencia comercial → Horario del equipo comercial (o en el panel, Tono). — Mindlin
- [ ] Plan de Vercel: seguir en Hobby (seguimientos una vez por día y repo público) o pasar a Pro. Con Pro, el proyecto sigue en la cuenta de Mindlin, el repo puede volver a privado (que era el objetivo) y los seguimientos pueden volver a cada 15 minutos. Con Pro también se destraban las esperas cortas de los flujos: con Hobby, una espera de «2 horas» sale en la corrida del día siguiente a las 10. Con Hobby anda: los seguimientos tienen un margen para que «1 día» sea «mañana a las 10». — Axel
- [ ] Cuando la cuenta de GitHub de Mindlin vuelva: transferirles este repo. — Axel

Decididas: Vercel en la cuenta de Axel (07/11) y, desde el 13/11, en la de Mindlin (`mindlindevelopers.ia`, plan Hobby), con el repo público para que publique (Axel); servidor Hostinger KVM 1 con 4 GB (07/11, comprado el 09/11), con Easypanel (Axel, 13/11); Chatwoot en `chat.mindlindevelopers.com` (09/11); origen «WhatsApp» en el CRM (ya existe en el hub, 10/11); el CRM es una planilla de Google (Axel, 10/11); el asistente mueve a los leads de etapa y se configura desde el hub, que arma Claude (Axel, 11/11); lotes y correos quedan afuera por ahora (Axel, 11/11); audios: se transcriben con OpenAI, clave cargada (11/11).

## 1. Conversación por WhatsApp con la forma de hablar de Mindlin

- [x] Webhook del Agent Bot: verifica la firma, guarda el historial, contesta y pasa a una persona si algo falla. Probado de punta a punta con un Chatwoot real (`docs/chatwoot.md`). — Claude, 07/11
- [x] El agente: tono, criterios comerciales, ejemplos, reglas fijas (no inventa precios ni condiciones, no mezcla proyectos), espera de 6 segundos por si siguen escribiendo. — Claude, 07/11
- [x] Tono y ejemplos editables en el panel (`/panel/tono`). — Claude, 10/11
- [x] Claude como proveedor, con OpenAI como alternativa por variable (`docs/asistente.md`). `ANTHROPIC_API_KEY` cargada. — Claude y Axel, 10/11
- [x] Audios: transcripción lista con OpenAI; sin esa clave, pide que lo escriban. — Claude, 10/11
- [x] Recuerda lo que ya anotó de cada persona (no repite preguntas ni filas en el CRM), responde con el formato de WhatsApp, cambia de proyecto si preguntan por otro y tiene en cuenta el horario del equipo. — Claude, 11/11
- [x] «Probar» en el panel: chatear con el asistente sin WhatsApp ni CRM, para ajustar tono y fichas. — Claude, 11/11
- [x] Horario del equipo comercial configurable desde el hub (Inteligencia comercial) y el panel (Tono). Antes estaba fijo en el código. — Claude, 13/11
- [x] Lo que hacían los bots de Kommo, configurable (`docs/kommo.md`): presentación por proyecto, modo «presenta y pasa», calificación con «de dónde es» y «hace cuánto busca», y el criterio de alquiler. — Claude, 11/11
- [x] API para que el hub lea y cambie toda la configuración (`docs/api-hub.md`). — Claude, 11/11
- [x] Base comercial del documento de Mindlin: «Sobre la empresa» y «Objeciones, perfiles y señales», editables en el hub. Y la herramienta marcar_senal para que la IA avise visita, señal de compra o «no me interesa». — Claude, 11/11
- [ ] Tono: revisar el borrador y sumar 10 a 20 conversaciones reales de ejemplo, sin datos personales. — Mindlin
- [ ] Probar con Claude de verdad (en las pruebas se usó uno simulado) y ajustar. La prueba de punta a punta del 13/11 fue con OpenAI. — Claude con Axel
- [x] Prueba por la línea real: el mensaje entró a la bandeja y la respuesta del Agent Bot llegó a WhatsApp (después del arreglo del #12). — Panel y Axel, 10/11
- [x] Con la línea real, confirmar que los mensajes del bot no vuelven a entrar como si los hubiera escrito una persona: cada respuesta apareció una sola vez y la conversación no se abrió sola. — Panel y Axel, 13/11
- [x] **Prueba de punta a punta por WhatsApp** (tarea 10): contestó con la ficha, anotó en el CRM, movió la etapa, pasó la conversación al equipo cuando pidió una visita, se calló mientras la tenía el equipo y atendió solo un número nuevo. — Panel y Axel, 13/11

## 2. Contexto separado para cada proyecto

- [x] Una ficha por proyecto; si hay más de uno, la IA pregunta por cuál consulta y nunca mezcla sus datos. Lo vacío no lo dice. — Claude, 07/11
- [x] Cargar y modificar fichas, y dar de alta proyectos, desde el panel (`/panel/proyectos`). — Claude, 10/11
- [x] Borradores desde Kommo: Lerma 439 completada en lo vacío y cinco fichas nuevas apagadas (Güemes, 17 y 43, Ramblas del Plata, VIA 53, Torre Cuatro Vientos). — Claude, 11/11
- [ ] Revisar y completar cada ficha (lo que cambia: precios, disponibilidad, avance de obra; lo que venía cortado: ver las notas internas de cada una) y activar las que correspondan. — Mindlin

## 3. Conexión con el CRM de Mindlin

- [x] Busca a la persona por teléfono y consulta etapa, responsable y notas; da de alta al interesado con lo que busca y anota el resumen en la actividad. Nunca cambia lo que cargó una persona. — Claude, 07/11
- [x] Columnas, etapas y orígenes al día con el hub de noviembre. — Claude, 10/11
- [x] **Etapas automáticas:** mueve al lead de etapa según lo que pasa (respondió, no respondió a los seguimientos, quiere visita, no le interesa…) y lo anota como «Cambio de etapa», con cuidados fijos (no toca Reserva ni Vendido, no retrocede). Configurable desde el hub y `/panel/etapas`. — Claude, 11/11
- [x] Pantallas en el hub: HQ → Comercial → Asistente de WhatsApp (repo `mindlinhub`). — Claude, 11/11
- [x] En esas pantallas, el horario del equipo, cada cuánto salen los seguimientos (lo manda el asistente) y «Probar las conexiones». — Claude, 13/11
- [x] Probar las etapas con la planilla real y la línea de prueba: pasó a «Seguimiento» al responder y a «Visita / reunión» al pedir el showroom, con el «Cambio de etapa» en la actividad. — Panel y Axel, 13/11
- [x] Busca por el ID anotado además del teléfono (sin eso, un contacto sin número se repetía en cada mensaje) y lee para qué busca, presupuesto y próximo paso. — Claude, 11/11
- [x] Planilla compartida con la cuenta de servicio y `CRM_SHEET_ID` en Vercel. — Panel, 09/11
- [x] El acuerdo de integración: qué lee y escribe, y qué tiene que cuidar Mindlin ([`docs/integracion-crm.md`](docs/integracion-crm.md)). — Claude, 10/11
- [x] Decidido: el CRM es una planilla de Google, que es lo que el asistente ya usa. Mindlin no tiene que construir nada para la integración. — Axel, 10/11
- [ ] Confirmar si es la planilla del CRM del hub (la que ya está en `CRM_SHEET_ID`) u otra. Si es otra: mismas pestañas y columnas, compartirla con la cuenta de servicio y cambiar `CRM_SHEET_ID` (`docs/integracion-crm.md`). — Axel
- [ ] Avisarle a Mindlin que no cambien el orden ni los nombres de las columnas sin avisar. — Axel
- [ ] Si en el hub cargan `CRM_CONTACTOS_SHEET_ID` (planilla comercial aparte, nueva desde el 11/11), poner el mismo ID en `CRM_SHEET_ID` de este proyecto. Si no, el asistente escribe en una planilla que el hub no lee. — Axel
- [x] Probar el CRM con la planilla real (con la línea de prueba): el contacto quedó con proyecto `lerma-439`, origen WhatsApp y su etapa. Antes hubo que poner al día tres títulos de «CRM Contactos» (B decía «Proyecto» y faltaban «Hora próximo paso» y «Tags»); se cambiaron solo esas celdas de la fila 1, después de confirmar que el hub lee la planilla por posición. — Panel y Axel, 13/11

## Traspaso para la próxima sesión (15/11, Claude)

Las líneas y los flujos ya están en `main`: asistente #21 y hub matimindlin111/mindlinhub#86. Lo que sigue, en orden:

1. **QA en producción** (Panel con Axel): tarea 12 de [`IA_DE_PANELES.md`](IA_DE_PANELES.md). Va primero porque desde una sesión de código no se llega a producción ni a WhatsApp.
2. **QA desde el código** (la próxima IA de código):
   - Recorrer las pantallas nuevas del hub (Comercial → Asistente de WhatsApp: tarjetas de líneas, Flujos, editor, Probar, Conexión) en la computadora y en el celular. Una forma: una página temporal sin sesión que muestre `<Asistente />`, con `page.route` de Playwright devolviendo datos inventados para `/api/comercial/asistente/**`. Las mismas formas de datos están en `components/asistente/Asistente.test.tsx`.
   - En el asistente: `/panel/lineas` con Postgres local.
   - Revisar el código mergeado (`lib/flujos/`, `lib/agente/charla.ts`, `lib/webhook.ts`, la migración `202611150011`) y anotar acá lo que salga, con dueño.
   - Todo lo de la lista «QA de punta a punta», de abajo.
3. **Conversaciones en el hub:** sección 12 de [`docs/arquitectura.md`](docs/arquitectura.md) y la lista «Conversaciones en el hub», más abajo. Se hace después de la QA.
4. **Esperan a Mindlin:** el panel de outreach frío (línea 1) y las decisiones de la línea 2 (bot de Telegram).

Para trabajar: ramas `claude/…` y PR, `npm run verificar` antes del PR y Postgres local para las pruebas (`PRUEBA_DATABASE_URL`). Las ramas `claude/modest-bardeen-xcg21w` de los dos repos ya están mergeadas: si se reusan, hay que arrancarlas de nuevo desde `main`.

## QA de punta a punta (después del merge de las líneas y los flujos)

Pedido de Axel (15/11): con todo en `main`, revisar el asistente comercial completo y el CRM, de principio a fin. Se hace con datos inventados y un teléfono de prueba, en la línea 3 (y en la 4 cuando esté). Lo que se encuentre se anota acá como tarea (con dueño) y se corrige en PRs chicos. Dueños: Claude (código y revisión), Panel con Axel (lo que pasa en Chatwoot, WhatsApp y Vercel) y Mindlin (lo comercial).

**Hallazgos de la QA desde el código (15/11, Claude).** Revisado lo mergeado en el #21: `lib/flujos/`, `lib/agente/charla.ts`, `lib/webhook.ts` y la migración `202611150011`. La migración es idempotente y sus índices cuidan lo importante: una sola corrida viva por conversación, un flujo activo por línea y proyecto, y una bandeja por línea. Lo que salió:

- [x] **Bug:** el equipo no podía devolverle la conversación al asistente si venía de un flujo que terminó con «Terminar» o si la línea estaba en «presenta y pasa». El aviso de «pendiente» llega antes que el mensaje y gastaba la marca, así que el mensaje siguiente volvía a pasar al equipo, una y otra vez. Ahora se mira el registro: si lo último fue que el equipo la devolvió, contesta la IA. — Claude, 15/11
- [x] **Bug:** una espera corta de un flujo (por ejemplo, 2 horas) que arrancaba poco antes de las 10 vencía en la corrida de las 10, al minuto. El margen del cron ahora nunca pasa de la mitad de la espera. — Claude, 15/11
- [x] **Eco:** el webhook miraba los últimos 10 mensajes para reconocer el eco. Con un flujo de más de 10 mensajes seguidos, el eco de uno de los primeros abría la conversación como si la hubiera tomado una persona. Ahora mira 30. — Claude, 15/11
- [ ] Probar en producción que «Pendiente» le devuelve la conversación al asistente: el paso 7 de la tarea 10 no figura en la prueba del 13/11. Quedó sumado a la tarea 12. — Panel con Axel
- [x] **Pantallas del hub** (recorridas en la computadora y en el celular contra el asistente en local, con su base y datos inventados): sin errores de consola, sin pedidos fallidos y nada corrido de costado. El editor de flujos se desarmaba con una espera adentro de otra (la trae el modelo «Presentación, brochure y un seguimiento»): las tarjetas se salían de su camino y, en el celular, la flecha tapaba el título. Arreglado en el hub ([#87](https://github.com/matimindlin111/mindlinhub/pull/87)), junto con la pastilla «General» estirada y las tarjetas de las líneas: la 4, sin bandeja, decía «atiende la IA» y ahora dice «Falta conectarla». — Claude, 15/11
- [x] `/panel/lineas` del asistente, en la computadora y en el celular: anda bien. — Claude, 15/11
- [ ] Sugerencia: en el celular, las cuatro tarjetas de las líneas y la cabecera ocupan la primera pantalla y hay que bajar para llegar a las solapas. Se podría mostrar las líneas en una fila que se desliza. — Mindlin decide, después Claude
- [ ] «Probar» con la IA de verdad y subir archivos no se pudieron ver en local (sin clave de IA ni Chatwoot): los cubre la tarea 12. — Panel con Axel
- [ ] Menor: el tipo de un archivo subido es el que declara el navegador; no se mira el contenido. Solo pueden subir quienes tienen Comercial en el hub, así que el riesgo es bajo. Se puede sumar el control de las primeras letras del archivo. — Claude, si se decide

**1. Bugs, arreglos, base de datos y arquitectura**

- [ ] La publicación aplicó `202611150011_lineas_y_flujos.sql` (en el log de Vercel, «aplicada»). En la base: las cuatro líneas, la 3 con la bandeja 1, y las conversaciones viejas en la línea 3.
- [ ] Conexiones (hub → Resumen): todo en verde y «Líneas» dice que atiende en la bandeja 1.
- [ ] **Webhook:**
  - responde en la línea 3;
  - una bandeja sin línea pasa al equipo, con la nota;
  - una línea pausada y la pausa general pasan al equipo;
  - si escribe el equipo, el asistente se corre;
  - «Pendiente» se la devuelve al asistente;
  - no hay eco: ni con texto ni con un archivo de un flujo.
- [ ] **Flujos de verdad, por WhatsApp:**
  - arranca con un número nuevo;
  - los mensajes salen en orden y con sus pausas;
  - la foto, el audio y el PDF llegan bien a WhatsApp, con su epígrafe;
  - si responde, sigue por «Si responde»;
  - si no responde, el cron del día siguiente a las 10 sigue por el otro camino;
  - «Terminar» y después escribe: pasa al equipo;
  - el equipo toma la conversación: el flujo se corta;
  - una sola corrida por conversación (`flujo_corridas`) y ningún mensaje repetido.
- [ ] **CRM:**
  - alta con el origen WhatsApp y la etapa de primer contacto;
  - los pasos «Mover de etapa» y las señales (visita, compra, no le interesa) se anotan como «Cambio de etapa»;
  - no toca Reserva ni Vendido;
  - no crea contactos repetidos (mismo teléfono en dos líneas).
- [ ] **Seguimientos:** reglas por línea y generales; nunca a quien lleva un flujo; el tope de 20 sumando los flujos.
- [ ] **Registro y logs:**
  - errores en el registro del asistente;
  - en Vercel, que el webhook y el cron terminen bien lejos de los 300 segundos;
  - el tamaño de la base en Neon;
  - las funciones por día (plan Hobby).
- [ ] **Seguridad:**
  - ninguna clave en el repo ni en los logs;
  - el permiso del módulo en el hub;
  - los archivos solo de los tipos permitidos y hasta 2,5 MB;
  - los datos personales solo para quien tiene Comercial.
- [ ] **Arquitectura:**
  - revisar las decisiones de las secciones 11 y 12 de [`docs/arquitectura.md`](docs/arquitectura.md);
  - los límites del plan Hobby (esperas que se revisan una vez por día);
  - qué falta para la línea 4.

**2. Flujos comerciales, reglas, marketing y la base de conocimiento de cada proyecto**

- [ ] **Fichas:**
  - en cada proyecto, presentación, precios, financiación, disponibilidad, tipologías y links al día;
  - las cinco apagadas, revisadas y prendidas las que correspondan;
  - las palabras clave, que llevan al proyecto correcto sin confundir (por ejemplo, «53» o «caba»).
- [ ] **Lo general:** «Sobre la empresa», «Objeciones, perfiles y señales» y 10 a 20 ejemplos reales sin datos personales.
- [ ] **Flujos por proyecto:**
  - armados desde los modelos de Kommo, con los textos, el brochure, la foto de obra y el audio;
  - cuánto espera cada uno y a qué etapa mueve;
  - cuándo pasa al equipo y cuándo sigue la IA;
  - probados en Probar antes de prenderlos.
- [ ] **Reglas:**
  - el modo de cada línea;
  - las instrucciones de la línea 4 (de qué campaña vienen);
  - las 6 reglas de seguimiento archivadas, revisadas y activadas;
  - las etapas automáticas (por ejemplo, ¿«señal de compra» mueve a Negociación?).
- [ ] **Conversaciones difíciles en Probar y por WhatsApp:**
  - un precio que no está en la ficha;
  - otro proyecto en la misma charla;
  - un alquiler;
  - «no me interesa»;
  - una visita;
  - un audio;
  - alguien que escribe sin parar;
  - preguntas por la empresa y por Borok.
- [ ] **Marketing:**
  - de qué campaña viene cada lead (por línea, o por el primer mensaje del anuncio);
  - cuánto responden a cada flujo y a cada versión de cada seguimiento;
  - qué queda en el CRM para medir.

**3. UX y UI**

- [ ] **Hub, Asistente de WhatsApp:**
  - las tarjetas de las líneas, las solapas por línea y la marca «Vale para todas las líneas»;
  - el editor de flujos: arrastrar en la computadora; en el celular arrastrar no anda en todos los navegadores, así que se usan las flechas;
  - la vista previa, subir y escuchar archivos, Probar con «Simular que no respondió» y Conexión;
  - los textos, el teclado, y cómo se ve en el celular.
- [ ] **Hub, CRM:** la ficha del lead y la bandeja de Chats, con lo que escribe el asistente (actividad y etapas).
- [ ] **Panel del asistente:** Líneas, Conversaciones, Tono y Seguimientos.
- [ ] **Chatwoot y WhatsApp:**
  - cómo le llegan a la persona los mensajes, las pausas y los archivos;
  - cómo ve el equipo las notas internas y el paso al equipo (la app del celular, tarea 7).

## Conversaciones en el hub (decidido el 15/11, falta hacerlo)

Cómo se hace, en [`docs/arquitectura.md`](docs/arquitectura.md), sección 12: se leen de la base del asistente, solo cuando se abren, y Chatwoot se abre para los adjuntos.

- [ ] API del asistente: listar las conversaciones (por línea, buscando por nombre o teléfono) y leer una (mensajes, lo anotado, el flujo y lo que hizo el asistente), y las de un contacto del CRM. — Claude
- [ ] Hub, CRM: sumar los mensajes de WhatsApp al Chat de la ficha y a la bandeja de Chats, con «Abrir en Chatwoot». — Claude
- [ ] Hub, Asistente de WhatsApp: la solapa «Conversaciones» por línea. — Claude
- [ ] Asignar el Agent Bot a las bandejas de las líneas 1 y 2 cuando estén, para que se guarden sus conversaciones. — Panel
- [ ] Fase 2, si hace falta: fotos y audios adentro del hub, pedidos a Chatwoot en el momento con un usuario «Hub» (token nuevo en Vercel). — Claude y Panel
- [ ] Fase 3: responder desde el hub por Chatwoot. — Claude

## Líneas y flujos (15/11)

- [x] Cuatro líneas, cada una atada a su bandeja de Chatwoot. El asistente de ventas solo contesta en las de leads; en las otras, o en una bandeja que no es de ninguna línea, pasa al equipo con una nota. Pausa, modo, instrucciones y proyectos por línea, y seguimientos que pueden valer para una sola línea ([`docs/lineas.md`](docs/lineas.md)). — Claude, 15/11
- [x] Flujos como los bots de Kommo, con mensajes fijos, pausas, archivos (foto, audio, PDF), «La IA escribe», «Esperar respuesta» con dos caminos, mover de etapa, pasar al equipo, que siga la IA y terminar. Uno general por línea y uno por proyecto, elegido por las palabras clave. Las esperas vencidas las retoma el cron diario. Probar los corre igual que WhatsApp, sin mandar nada ([`docs/flujos.md`](docs/flujos.md)). — Claude, 15/11
- [x] En el hub: elegir la línea, ver para qué es cada una y, adentro, todas las solapas, más Flujos (editor que se arrastra, con modelos de Kommo) y Conexión. — Claude, 15/11
- [ ] Conectar la línea 4 (tarea 11). — Panel con Axel
- [ ] Armar los flujos de cada proyecto y probarlos. — Mindlin
- [ ] Panel de outreach frío (línea 1): Mindlin pasa qué incorporar. — Mindlin, después Claude
- [ ] Línea 2: lo del bot de Telegram en WhatsApp (va al final). — Claude, cuando estén las decisiones

## 4. Seguimientos

- [x] Reglas «si queda en tal etapa y pasan tantos días sin respuesta, mandar este mensaje», con la etapa del CRM. Frenan si la persona responde o si el equipo toma la conversación. De 9 a 20 y con tope (`docs/seguimientos.md`). — Claude, 10/11
- [x] Cargarlas desde el panel (`/panel/seguimientos`), con versiones para comparar mensajes. — Claude, 10/11
- [x] Email previsto: qué haría falta, sin código todavía (`docs/arquitectura.md`, sección 9). — Claude, 10/11
- [x] `CRON_SECRET` en Vercel (solo Production); el cron rechaza pedidos sin autorización. Falta ver salir un seguimiento con un contacto de prueba. — Panel, 10/11
- [x] El cron pasó de cada 15 minutos a una vez por día, a las 10 (plan Hobby; [#17](https://github.com/axellaban/mindlin-asistente/pull/17)). Se revierte si el proyecto vuelve a Pro. — Claude, 13/11
- [x] Con una corrida por día, cada regla vence medio día antes: «1 día» quiere decir «en la corrida de mañana a las 10» y no a los dos días. El panel y el hub dicen cada cuánto salen, y una prueba controla que coincida con `vercel.json` ([`docs/seguimientos.md`](docs/seguimientos.md)). — Claude, 13/11
- [ ] Revisar y activar las 6 reglas archivadas que vinieron de Kommo, y decidir si se suman más pasos (ver «Decisiones abiertas»). — Axel con Mindlin

## 5. Que el equipo pueda intervenir

- [x] Si alguien del equipo escribe (en Chatwoot o desde el celular), la conversación pasa a abierta y el asistente se calla. — Claude, 07/11
- [x] El asistente pasa la conversación sola cuando hace falta una persona, con nota interna y resumen. — Claude, 07/11
- [x] Devolverle una conversación al asistente («Marcar como pendiente» en Chatwoot) y pausar el asistente entero desde el panel. — Claude, 10/11
- [ ] Equipo en Chatwoot y app del celular (tarea 7). Depende del correo. — Panel

## Infraestructura

- [x] Instalador de WAHA y Chatwoot con HTTPS, verificación y respaldo nocturno (`infra/servidor.sh`). — Claude, 07/11
- [x] Instalado en el servidor (tarea 4): Chatwoot por HTTPS, WAHA interno, respaldo nocturno y swap. — Panel, 09/11
- [x] Proyecto en Vercel, base Neon con migraciones solas, cuenta de servicio de Google. — Panel y Claude, 07/11 a 09/11
- [x] Instalador para 4 GB: swap si falta y menos hilos en Chatwoot. — Claude, 10/11
- [x] Panel con clave (`/panel`, `docs/panel.md`). — Claude, 10/11
- [x] `PANEL_CLAVE` en Vercel. — Axel, 10/11
- [x] Easypanel: el Compose para pegar ([`infra/easypanel/`](infra/easypanel/)), `servidor.sh` en modo Easypanel (`generar`, `easypanel`; `conectar` y `bot` con `Authorization: Bearer`, que hace falta detrás de un proxy), la guía [`docs/easypanel.md`](docs/easypanel.md) y la limpieza de las conversaciones de prueba del Chatwoot anterior. Probado en Docker local. — Claude, 13/11
- [x] Reinstalar el servidor con Easypanel (tarea 9, reemplaza a la tarea 8). Chatwoot y WAHA con HTTPS en sus dominios, los cinco contenedores en verde, swap y respaldo nocturno. Línea vinculada de nuevo (`WORKING`, bandeja 1, cuenta 1), Agent Bot asignado y las cuatro variables de Chatwoot en Vercel (despliegue `daee11f` Ready). Lo que salió distinto de la guía está en `docs/estado-paneles.md`. — Panel con Axel, 13/11
- [x] El proyecto de Vercel pasó a la cuenta `mindlindevelopers.ia` (plan Hobby). Para que publique: cron diario ([#17](https://github.com/axellaban/mindlin-asistente/pull/17)) y repo público. — Axel y Claude, 13/11
- [x] **Conexiones:** probar de verdad cada pieza (Chatwoot con el token del bot, la base, la planilla y sus columnas, la IA) y ver lo último que pasó, sin mandar nada. En el panel (`/panel/chequeo`) y en el hub (Resumen → «Probar las conexiones»). `/api/salud` solo mira que las variables existan, y el 13/11 eso no alcanzó para ver que las claves eran del Chatwoot anterior. En la prueba del 13/11 encontró los títulos viejos del CRM. — Claude, 13/11
- [x] Conexiones marcaba «Revisar» en Chatwoot con el token bien: Chatwoot 4.19.1 contesta `Resource could not be found` y el chequeo esperaba otro texto. Ahora ese 404 cuenta como token válido. — Claude, 13/11
- [x] Un Preview de Vercel quedó en Error el 13/11: era la rama del PR #16 (informe de la IA de paneles), que había salido de un `main` anterior al cron diario y el plan Hobby la rechazó. No afecta a producción ni a las ramas nuevas, que ya salen con el cron diario. — Claude, 13/11
- [x] La línea de prueba con el QR (tarea 5): escaneado desde Chatwoot, WAHA en `WORKING`. — Axel y Panel, 10/11
- [ ] Hostinger: delegar el acceso Admin a la cuenta de Axel. Las claves iniciales ya no hace falta rotarlas: al reinstalar con Easypanel (13/11), Axel puso una contraseña de root nueva. — Axel

## Piloto

- [ ] Pruebas internas con el equipo. — Todos
- [ ] Consultas reales en la línea de Lerma 439. — Mindlin

## Fuera de esta versión

Lo deja la propuesta para después (lo construye Mindlin o se presupuesta aparte): scoring, afinar etapas, mensajes y reglas comerciales, agenda automática, clasificación de proveedores y postulantes, terrenos (calificar lotes; el cuestionario del «bot para lotes» de Kommo ya se puede armar como flujo), email (previsto; incluye los correos de VIA 53 de Kommo), avisos al responsable por el hub y la conexión del hub con Chatwoot.
