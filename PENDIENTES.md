# Pendientes

El alcance es el de la **propuesta de Mindlin para la primera versión** (cinco puntos: conversación por WhatsApp con su forma de hablar, contexto por proyecto, conexión con su CRM, seguimientos y que el equipo pueda intervenir). Lo que la propuesta deja para después está al final, en «Fuera de esta versión».

Dueños:
- **Claude:** el código.
- **Panel:** la IA con computer use, o Axel. Sus tareas están en [`IA_DE_PANELES.md`](IA_DE_PANELES.md) y anota los resultados en [`docs/estado-paneles.md`](docs/estado-paneles.md).
- **Axel.**
- **Mindlin:** el cliente (Mati y su equipo).

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

**En qué orden sigue:**

1. ~~La IA de paneles prueba todo en producción (tareas 12 a 15).~~ Hecho el 16/11 ([#41](https://github.com/axellaban/mindlin-asistente/pull/41), detalle en [`docs/estado-paneles.md`](docs/estado-paneles.md)). Lo que quedó sin probar está abajo, en «Lo que quedó de la QA del 16/11».
2. Axel decide lo suyo y Mati carga lo de Mindlin (ver «Qué falta, por persona», abajo).
3. Se activan los seguimientos y los flujos.
4. Pruebas internas con el equipo.
5. Consultas reales en la línea de Lerma 439.

## Qué falta, por persona (al 15/11)

Esta es la lista para mirar. Lo de más abajo es el detalle y el historial.

### Axel: decide

1. **Seguimientos:** revisar con Mati las 6 reglas que vinieron de Kommo (una por proyecto, a las 24 h) y pasarlas a «Activa». Hoy están archivadas y **no sale ningún seguimiento**. Se hace en el hub → Asistente de WhatsApp → Seguimientos.
2. **Con qué IA responde: Claude u OpenAI.** Hoy responde OpenAI (`gpt-6.1-sol`).
   - Se elige con `ASISTENTE_PROVEEDOR` en Vercel y se vuelve a publicar.
   - Conviene probarla antes en «Probar» con las conversaciones difíciles.
   - Si es Claude, falta probarlo de verdad: Claude con Axel.
3. **Plan de Vercel:** seguir en Hobby o pasar a Pro.
   - **Con Hobby:** los seguimientos y las esperas de los flujos salen una vez por día, a las 10, y el repo queda público.
   - **Con Pro**, o con un servicio gratis que llame al cron cada 15 minutos: salen a la hora justa y el repo puede volver a ser privado. Lo que cambia en el código está en la mejora 10.
4. **Correo para Chatwoot:** Zoho, Google Workspace o Brevo. Sin él no se puede invitar al equipo a Chatwoot ni usar su app del celular (tarea 7).
5. **A quién le llegan los avisos de los leads sin responsable** (`ASISTENTE_AVISAR_SIN_RESPONSABLE` en el hub, por ejemplo `Mati,Tade`; tarea 13). Los avisos andan (QA del 16/11); falta elegir a quién.
6. ~~El mail del usuario «Hub» de Chatwoot~~: hecho el 16/11 (tarea 14). Las fotos y los audios se ven en el hub.
7. **Las filas de prueba del CRM:** «Juan Prueba» (`cmwb5wcob9uz6`) y las que liste la tarea 15. ¿Se borran o pasan a «Descartado»?

### Axel: hace

8. ~~Pasarle a la IA de paneles las tareas 12 a 15~~ (hechas el 16/11). Falta un **número que nunca le haya escrito a la línea 3**, para probar el alta, la campaña y un flujo de verdad (ver «Lo que quedó de la QA del 16/11»).
9. Conseguir el chip o número de la línea 4 (tarea 11) y **el de la línea 1** (outreach frío, chip propio para no arriesgar la línea de leads).
10. Avisarle a Mindlin que no cambien el orden ni los nombres de las columnas del CRM sin avisar.
11. Hostinger: delegar el acceso Admin a su cuenta.
12. Cuando vuelva la cuenta de GitHub de Mindlin, transferirles este repo.

### Mati (Mindlin): define

1. **Cómo atiende cada línea de leads:**
   - «presenta y pasa» (cuando la persona responde, sigue el equipo);
   - que el asistente converse, como hoy;
   - o un flujo.

   Se elige por línea en el hub.
2. **Para qué es la línea 4** y qué proyectos atiende.
3. **Línea 2**, lo del bot de Telegram por WhatsApp. Lo define con Axel:
   - ¿un número aparte o el mismo?;
   - ¿qué avisos pasan a WhatsApp?;
   - ¿conviven unas semanas con Telegram o se corta?
4. **Línea 1 (outreach frío):** cargar las bases de leads viejas (en planillas) y revisar los textos de la secuencia. El hub trae un borrador con 3 variantes del saludo y 3 del seguimiento: Mati los cambia a su gusto y marca «Textos revisados»; hasta entonces no sale nada. Antes de la primera tanda, confirmar con su abogado el Registro No Llame y el consentimiento de la base. Ver [`docs/outreach.md`](docs/outreach.md).
5. **Etapas automáticas:** revisar las de fábrica. Por ejemplo, ¿«señal de compra» tiene que mover a Negociación? Hoy no mueve.
6. **VIA 53 y Torre Cuatro Vientos:** sus dos documentos tienen datos distintos (precios, entrega, forma de pago, el semipiso). ¿Cuáles valen?
7. **Horario del equipo comercial:** hoy es de lunes a viernes de 9 a 20.
8. **Formularios:** si usan formularios (de la web o de Meta) para juntar leads, avisar, así entran solos al CRM.

### Mati (Mindlin): carga, en el hub

9. **Fichas de cada proyecto:**
   - revisar y completar precios, disponibilidad, avance de obra y links;
   - prender las cinco que están apagadas, si corresponde.
10. **Tono:** revisar el borrador y sumar 10 a 20 conversaciones reales de ejemplo, sin datos personales.
11. **Campañas:** las de Meta, con el texto del primer mensaje de cada anuncio (línea → Inteligencia comercial → Campañas). Así se sabe de qué anuncio viene cada lead.
12. **Flujos de cada proyecto:** armarlos desde los modelos de Kommo (textos, brochure, foto de obra) y probarlos en «Probar» antes de prenderlos.
13. **Respuestas rápidas del chat:** cómo llegar, horarios, formas de pago, link al brochure (CRM → un chat → ⚡). El hub no trae ninguna inventada.
14. **Una vez por semana:** revisar respuestas reales del asistente (Asistente de WhatsApp → Revisar).
15. **Después:** pruebas internas con el equipo y consultas reales en la línea de Lerma 439.

### La IA de paneles (computer use), con Axel

Las tareas de [`IA_DE_PANELES.md`](IA_DE_PANELES.md), en este orden:

- ~~**12 a 15:**~~ hechas el 16/11 (QA de líneas y flujos, avisos, usuario «Hub» de Chatwoot y todo lo del 15/11). Queda lo de «Lo que quedó de la QA del 16/11», con un número nuevo.
- **11:** la línea 4, con el chip.
- **16:** la línea 1 (outreach), con su chip.
- **7:** el equipo en Chatwoot, cuando esté el correo.

### Claude (código)

- **Outreach frío (línea 1):** hecho del lado del asistente el 16/11 (base, cola y cuidados, puntaje, respuestas, WAHA y resultados; [`docs/outreach.md`](docs/outreach.md)). Las pantallas del hub, también (matimindlin111/mindlinhub#112, #113 y #114, publicadas el 17/11). Se retoma con lo que salga de la tarea 16 y de la primera tanda de prueba.

Además, se retoma con:

- lo que salga de las tareas 12 y 15;
- la línea 2, cuando Mati y Axel la definan;
- los formularios, si los usan;
- probar Claude de verdad, si se elige Claude.

Decididas: Vercel en la cuenta de Axel (07/11) y, desde el 13/11, en la de Mindlin (`mindlindevelopers.ia`, plan Hobby), con el repo público para que publique (Axel); servidor Hostinger KVM 1 con 4 GB (07/11, comprado el 09/11), con Easypanel (Axel, 13/11); Chatwoot en `chat.mindlindevelopers.com` (09/11); origen «WhatsApp» en el CRM (ya existe en el hub, 10/11); el CRM es una planilla de Google (Axel, 10/11), y es la misma que usa el CRM del hub en producción (confirmado el 15/11); el asistente mueve a los leads de etapa y se configura desde el hub, que arma Claude (Axel, 11/11); lotes y correos quedan afuera por ahora (Axel, 11/11); audios: se transcriben con OpenAI, clave cargada (11/11).

## Outreach frío (línea 1)

Decidido el 16/11 (Axel): la línea 1 le escribe primero a las bases de leads viejas de Mindlin, con la excepción a la regla de WhatsApp y los cuidados configurables, y con los dos modos de envío (WAHA nativo y computer use). Diseño, cuidados y orden en [`docs/outreach.md`](docs/outreach.md). La base es el panel de prospección de Chapa Labs (`facundogregorini-lab/chapa-labs`, `/prospecting`): se rehace acá, no se copia.

- [x] Diseño y la excepción a la regla, anotada en `AGENTS.md`. — Claude, 16/11
- [x] 1. Asistente: migración (`outreach_*` y `bajas` por teléfono), cargar la base (vista previa, teléfonos argentinos, repetidos, cruce con el CRM, las bajas y las conversaciones en curso), la cola con la toma de 10 minutos, confirmar o «no salió» sin contar dos veces, los cuidados que hace cumplir el servidor y la API para el hub (`docs/api-hub.md`, «Outreach frío»). Falta conectar el webhook a la tabla `bajas` (paso 3). — Claude, 16/11
- [x] Puntaje de las bases (0 a 100, pesos configurables, 15 % al azar, aprendizajes), en el asistente. Las pantallas, en el paso 2. — Claude, 16/11
- [x] 2. Hub, línea 1: Resumen, Prospectos (con el puntaje y los aprendizajes), Secuencia (textos, versiones, cuidados y pesos del puntaje) y Enviar con computer use (tarjeta con `data-testid`, `?agente=1` e instrucciones para el agente). En el repo del hub (#112). — Otra IA, 16/11
- [x] Hub: el scoring del CRM se puede configurar aunque el CRM esté en la planilla (pestaña «CRM Config»), con la etapa como señal y la pantalla rehecha (#112 y #114). — Otra IA y Claude, 16/11
- [x] 3. Respuestas por el webhook: los salientes de la línea 1 (no son «escribió el equipo» y confirman solos), respuestas automáticas, «no», número equivocado, baja por teléfono (en todas las líneas), alta en el CRM de quien responde, qué pasa después (equipo o IA; un flujo, más adelante) y la API de la bandeja «Responder». — Claude, 16/11
- [x] Arreglo: el registro no aceptaba «pidio_baja» y el asistente fallaba al anotar una baja en producción (migración `202611160017_registro_baja.sql`). — Claude, 16/11
- [x] Hub: la bandeja «Responder» de la línea 1 (`GET outreach/{línea}/respuestas`, «Abrir en Chatwoot», responder desde el hub y marcar interesado o cerrado) y «Al responder» (equipo o IA) en Secuencia (#113). — Claude, 16/11
- [x] 4. WAHA nativo, en el asistente: mandar uno por pedido (`POST outreach/{línea}/enviar`), verificar números, «Mandarme una prueba», estado de la sesión y el freno si se cae. Solo texto por ahora. — Claude, 16/11
- [x] 4b. Hub: el botón de la tanda por WAHA (llama a `enviar`, espera la pausa y repite hasta la tanda), «Verificar 20 números», «Mandarme una prueba» y si WAHA está conectado (#113). — Claude, 16/11
- [ ] 4c. Probar en la línea 1 de verdad (tarea 16): que el mensaje por WAHA aparezca en Chatwoot como saliente en su bandeja y que la respuesta entre a esa conversación. — Panel con Axel
- [ ] QA con 5 números del equipo, en los dos modos, antes de la primera tanda real (lista en `docs/outreach.md`). — Claude y Panel con Axel
- [x] 5. Embudo contra la meta, resultados por base y por versión, lo que salió cada día (`POST outreach/{línea}/resultados`) y la subida gradual del tope. — Claude, 16/11
- [x] 5b. Hub: la solapa «Resultados» de la línea 1 (embudo contra la meta con dónde se frena, por base, por versión, por día y los aprendizajes del puntaje) y las metas en Secuencia (#113). — Claude, 16/11
- [ ] Tarea 16 de la IA de paneles: el chip de la línea 1 vinculado, su bandeja con el Agent Bot, `WAHA_URL` y `WAHA_API_KEY` en Vercel del asistente y la prueba del primer mensaje. — Panel con Axel
- [ ] Cargar las bases y revisar los textos de la secuencia. Hay un borrador con 3 variantes del saludo y 3 del seguimiento (hub → línea 1 → Secuencia): Mati los cambia a su gusto y marca «Textos revisados»; sin eso no sale nada. Cuando quiera, más adelante. — Mindlin
- [ ] Confirmar con su abogado lo legal antes de la primera tanda: el Registro No Llame (ley 26.951) y el consentimiento de la base (ley 25.326). — Mindlin

## Lo que quedó de la QA del 16/11

La QA de la IA de paneles (tareas 12 a 15) está en [`docs/estado-paneles.md`](docs/estado-paneles.md). Probado en producción: WhatsApp de punta a punta, el CRM en la planilla, fotos y audios en el hub, avisos, responder desde el hub, «Revisar», respuestas rápidas y devolver el chat al asistente. Lo que no se pudo probar o quedó a medias:

- [ ] **Con un número que nunca le escribió a la línea 3:** el alta en el CRM, la campaña (desde el primer mensaje de un anuncio) y un flujo de verdad (mensajes en orden, un archivo que llega a WhatsApp, la espera del cron de las 10 y la devolución a la IA al terminar). — Panel con Axel
- [ ] **La baja** («no me escriban más»), con una conversación de prueba que pueda quedar marcada para siempre (no la de Axel). — Panel con Axel
- [ ] **Recepción en el teléfono** de lo que se manda desde el hub (respuesta y respuesta rápida) y la **campanita de Mati** con el aviso. — Panel con Axel
- [ ] **Seguimientos y su espaciado:** se ven recién con alguna regla activa (hoy las 6 están archivadas) y una corrida de las 10 dentro de la ventana de logs. — Panel con Axel, después de que Axel y Mati activen reglas
- [x] La ayuda de Conversaciones del hub todavía mandaba las fotos y los audios a Chatwoot: corregida (matimindlin111/mindlinhub#116). — Claude, 17/11
- [x] El presupuesto de un contacto que ya existía quedaba en la actividad y la ficha seguía vacía: ahora el asistente completa lo **vacío** de la ficha (para qué, ambientes, presupuesto, forma de pago, plazo) sin tocar lo que cargó una persona ([`docs/integracion-crm.md`](docs/integracion-crm.md)). — Claude, 17/11

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
- [x] **Confirmado (15/11): el CRM del hub en producción es la planilla de Google**, no la base de datos. El asistente y el hub trabajan sobre la misma planilla: lo que escribe el asistente (leads nuevos, cambios de etapa, etiquetas de campaña) se ve en el CRM del hub, y «qué vende» se mide contra el mismo CRM. No hace falta que el asistente escriba por la API del hub. — Axel, 15/11
- [x] Comprobado el 16/11: el hub de producción no tiene `DATABASE_URL` y lo que escribe el asistente aparece en el CRM del hub y en «CRM Actividad» (el valor de `CRM_SHEET_ID` no se ve porque es Secret, pero la escritura real lo confirma). — Panel con Axel. El pedido original era: que el hub de producción no tenga `DATABASE_URL` y que `CRM_SHEET_ID` del asistente sea la misma planilla que lee el hub (`CRM_CONTACTOS_SHEET_ID` del hub o, si no está, su `CRM_SHEET_ID`). Si alguna de las dos no se cumple, frenar y avisar a Axel. — Panel, tarea 15 de [`IA_DE_PANELES.md`](IA_DE_PANELES.md)
- [ ] Avisarle a Mindlin que no cambien el orden ni los nombres de las columnas sin avisar. — Axel
- [ ] Si en el hub cargan `CRM_CONTACTOS_SHEET_ID` (planilla comercial aparte, nueva desde el 11/11), poner el mismo ID en `CRM_SHEET_ID` de este proyecto. Si no, el asistente escribe en una planilla que el hub no lee. Lo revisa la tarea 15. — Axel
- [x] Probar el CRM con la planilla real (con la línea de prueba): el contacto quedó con proyecto `lerma-439`, origen WhatsApp y su etapa. Antes hubo que poner al día tres títulos de «CRM Contactos» (B decía «Proyecto» y faltaban «Hora próximo paso» y «Tags»); se cambiaron solo esas celdas de la fila 1, después de confirmar que el hub lee la planilla por posición. — Panel y Axel, 13/11

## Traspaso para la próxima sesión (15/11, Claude; al día al cierre)

**Hecho el 15/11:**

- la QA desde el código (abajo);
- las mejoras 1 a 8 de Axel;
- las ideas traídas de DeskcommCRM;
- el control del contenido de los archivos;
- las líneas en una fila que se desliza en el celular.

Cada cosa salió en su PR (ver las listas al final). **Del lado del código no queda nada abierto.** Lo que falta, y de quién es, está arriba, en «Qué falta, por persona». La próxima IA de código retoma con lo que salga de las tareas 12 y 15 de la IA de paneles.

Para trabajar: ramas `claude/…` y PR, `npm run verificar` antes del PR y Postgres local para las pruebas (`PRUEBA_DATABASE_URL`). Para ver las pantallas del hub sin sesión: una página temporal en `app/t/…` (queda fuera del login) que muestre `<Asistente />`, con `page.route` de Playwright mandando los pedidos al asistente en local. No se sube.

## QA de punta a punta (después del merge de las líneas y los flujos)

Pedido de Axel (15/11): con todo en `main`, revisar el asistente comercial completo y el CRM, de principio a fin. Se hace con datos inventados y un teléfono de prueba, en la línea 3 (y en la 4 cuando esté). Lo que se encuentre se anota acá como tarea (con dueño) y se corrige en PRs chicos. Dueños: Claude (código y revisión), Panel con Axel (lo que pasa en Chatwoot, WhatsApp y Vercel) y Mindlin (lo comercial).

**Hallazgos de la QA desde el código (15/11, Claude).** Revisado lo mergeado en el #21: `lib/flujos/`, `lib/agente/charla.ts`, `lib/webhook.ts` y la migración `202611150011`. La migración es idempotente y sus índices cuidan lo importante: una sola corrida viva por conversación, un flujo activo por línea y proyecto, y una bandeja por línea. Lo que salió:

- [x] **Bug:** el equipo no podía devolverle la conversación al asistente si venía de un flujo que terminó con «Terminar» o si la línea estaba en «presenta y pasa». El aviso de «pendiente» llega antes que el mensaje y gastaba la marca, así que el mensaje siguiente volvía a pasar al equipo, una y otra vez. Ahora se mira el registro: si lo último fue que el equipo la devolvió, contesta la IA. — Claude, 15/11
- [x] **Bug:** una espera corta de un flujo (por ejemplo, 2 horas) que arrancaba poco antes de las 10 vencía en la corrida de las 10, al minuto. El margen del cron ahora nunca pasa de la mitad de la espera. — Claude, 15/11
- [x] **Eco:** el webhook miraba los últimos 10 mensajes para reconocer el eco. Con un flujo de más de 10 mensajes seguidos, el eco de uno de los primeros abría la conversación como si la hubiera tomado una persona. Ahora mira 30. — Claude, 15/11
- [ ] Probar en producción que «Pendiente» le devuelve la conversación al asistente: el paso 7 de la tarea 10 no figura en la prueba del 13/11. Quedó sumado a la tarea 12. — Panel con Axel
- [x] **Pantallas del hub** (recorridas en la computadora y en el celular contra el asistente en local, con su base y datos inventados): sin errores de consola, sin pedidos fallidos y nada corrido de costado. El editor de flujos se desarmaba con una espera adentro de otra (la trae el modelo «Presentación, brochure y un seguimiento»): las tarjetas se salían de su camino y, en el celular, la flecha tapaba el título. Arreglado en el hub ([#87](https://github.com/matimindlin111/mindlinhub/pull/87)), junto con la pastilla «General» estirada y las tarjetas de las líneas: la 4, sin bandeja, decía «atiende la IA» y ahora dice «Falta conectarla». — Claude, 15/11
- [x] `/panel/lineas` del asistente, en la computadora y en el celular: anda bien. — Claude, 15/11
- [x] En el celular, las cuatro tarjetas de las líneas ocupaban la primera pantalla y había que bajar para llegar a las solapas. Ahora van en una fila que se desliza y la elegida queda a la vista (matimindlin111/mindlinhub#101). — Claude, 15/11
- [x] Subir archivos por la API del hub, en local: una foto entra; un tipo que no se permite y uno de más de 2,5 MB se rechazan con un mensaje claro. — Claude, 15/11
- [ ] «Probar» con la IA de verdad no se pudo ver en local (sin clave de IA), ni cómo llega un archivo a WhatsApp: los cubre la tarea 12. — Panel con Axel
- [x] Menor: el tipo de un archivo subido era el que declaraba el navegador. Desde el 15/11 también se mira el contenido (las primeras letras del archivo): un programa renombrado como foto no entra (`coincideElContenido`, `lib/panel/validar.ts`). — Claude, 15/11

**Del lado del código, revisado el 15/11 (Claude).** Cada punto de abajo está cubierto por pruebas automáticas, que corren en cada PR. Esas pruebas cubren tres cosas:

- **El webhook:** responde en su línea, pasa al equipo una bandeja sin línea o una línea pausada, se corre si escribe el equipo, vuelve con «Pendiente» y reconoce el eco de texto y de archivos.
- **Los flujos y el CRM:** los flujos de punta a punta; el CRM, que no toca Reserva ni Vendido y no repite contactos (tampoco la misma persona por dos líneas, prueba sumada hoy).
- **Los seguimientos:** por línea y generales, nunca a quien lleva un flujo, con tope y espaciados.

Seguridad y arquitectura quedan marcadas abajo. Lo que sigue sin tilde se ve **en producción**: lo prueba la IA de paneles en las tareas 12 y 15.

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
- [x] **Seguridad** (revisado en el código el 15/11):
  - **ninguna clave en el repo:** se buscaron claves de Anthropic, OpenAI, GitHub, Google y AWS en todos los archivos, y no hay;
  - **los logs de Vercel** muestran solo qué hizo el asistente y cuántos mensajes mandó el cron, sin claves;
  - **el permiso del módulo en el hub:** la ruta que habla con el asistente pide el permiso de Asistente de WhatsApp, y las del CRM, el de Comercial;
  - **los archivos:** solo de los tipos permitidos, hasta 2,5 MB, y ahora también con el contenido revisado;
  - **los datos personales** solo se ven desde el hub, con esos permisos. — Claude
- [x] **Arquitectura** (revisado el 15/11):
  - las decisiones de las secciones 11 a 14 de [`docs/arquitectura.md`](docs/arquitectura.md) siguen valiendo;
  - los límites del plan Hobby están escritos donde corresponde: esperas y seguimientos una vez por día, y la corrida dentro de los 300 segundos aun con los mensajes espaciados;
  - a la línea 4 solo le falta el chip (tarea 11). — Claude

**2. Flujos comerciales, reglas, marketing y la base de conocimiento de cada proyecto**

Esto lo carga y lo decide Mindlin: está resumido arriba, en «Qué falta, por persona».

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

## Conversaciones en el hub (decidido y hecho el 15/11; quedan las fases 2 y 3)

Cómo se hace, en [`docs/arquitectura.md`](docs/arquitectura.md), sección 12: se leen de la base del asistente, solo cuando se abren, y Chatwoot se abre para los adjuntos.

- [x] API del asistente: listar las conversaciones (todas o por línea; el hub busca por nombre o teléfono en la lista) y leer una (mensajes, lo anotado, el flujo y lo que hizo el asistente), y las de un contacto del CRM por su ID o su teléfono, con el link a Chatwoot ([`docs/api-hub.md`](docs/api-hub.md), «Conversaciones»). — Claude, 15/11
- [x] Hub, CRM: sumar los mensajes de WhatsApp al Chat de la ficha y a la bandeja de Chats, con «Abrir en Chatwoot» (matimindlin111/mindlinhub#88). — Claude, 15/11
- [x] Hub, Asistente de WhatsApp: la solapa «Conversaciones» por línea (matimindlin111/mindlinhub#88). — Claude, 15/11
- [ ] Asignar el Agent Bot a las bandejas de las líneas 1 y 2 cuando estén, para que se guarden sus conversaciones. — Panel
- [x] Fase 2: fotos y audios adentro del hub, pedidos a Chatwoot en el momento (`GET /adjuntos`). — Claude, 15/11
- [ ] Crear el usuario «Hub» en Chatwoot y cargar su token como `CHATWOOT_HUB_TOKEN` en Vercel (tarea 14 de [`IA_DE_PANELES.md`](IA_DE_PANELES.md)). — Panel con Axel
- [x] Fase 3: responder desde el hub por Chatwoot (el asistente: `POST /responder`; el hub: el chat del lead). — Claude, 15/11

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

## Mejoras pedidas por Axel (15/11), en orden de prioridad

Van después de la QA de punta a punta. Cada una en su PR, con su doc. Dueño: Claude, salvo que diga otra cosa.

1. [x] **Conversaciones en el CRM del hub.** Hecho el 15/11: API del asistente ([#26](https://github.com/axellaban/mindlin-asistente/pull/26)) y pantallas del hub (matimindlin111/mindlinhub#88). Falta ver las conversaciones reales en producción (tarea 12). Se leen de la base del asistente cuando alguien las abre, y se ven en la ficha del lead → Chat, en la bandeja de Chats y en una solapa «Conversaciones» por línea. Para los adjuntos, «Abrir en Chatwoot». Cómo se arma: [`docs/arquitectura.md`](docs/arquitectura.md), sección 12, y la lista «Conversaciones en el hub».
2. [x] **Saber de qué campaña viene cada lead.** Hecho el 15/11 ([#27](https://github.com/axellaban/mindlin-asistente/pull/27) y matimindlin111/mindlinhub#89, [`docs/campanias.md`](docs/campanias.md)). Falta que **Mindlin pase sus campañas y el texto del primer mensaje de cada anuncio**, para cargarlas en el hub (la línea → Inteligencia comercial → Campañas). Por la línea y por el primer mensaje del anuncio (el texto que arma Meta, o palabras configurables por campaña). Se guarda en el CRM como origen o etiqueta. Mindlin dice qué campañas tiene.
3. [x] **Medir qué flujo vende, no solo cuál responde.** Hecho el 15/11 ([#28](https://github.com/axellaban/mindlin-asistente/pull/28) y matimindlin111/mindlinhub#91, [`docs/resultados.md`](docs/resultados.md)). Se mide contra la planilla del CRM, que es el CRM del hub (confirmado el 15/11). Cruzar cada flujo y cada versión de seguimiento con la etapa a la que llegó el lead en el CRM (visita, negociación, reserva) y mostrarlo en el hub, junto a los números de cada flujo y cada regla.
4. [x] **Avisar al responsable cuando el asistente pasa la conversación al equipo.** Hecho el 15/11 ([#29](https://github.com/axellaban/mindlin-asistente/pull/29) y matimindlin111/mindlinhub#92, [`docs/avisos.md`](docs/avisos.md)). Para prenderlo, **Panel carga `HUB_URL`** en el Vercel del asistente (tarea 13 de [`IA_DE_PANELES.md`](IA_DE_PANELES.md)); y **Axel decide** a quién le llegan los avisos de leads sin responsable (`ASISTENTE_AVISAR_SIN_RESPONSABLE` en el hub). Un aviso en el hub (la campanita y el celular, como los demás avisos del hub), con el resumen y el link a la conversación.
5. [x] **Ver en qué paso del flujo va cada persona, y sacarla o reiniciarla a mano** desde el hub (Flujos → «Quiénes van»). Hecho el 15/11 ([#30](https://github.com/axellaban/mindlin-asistente/pull/30) y matimindlin111/mindlinhub#93).
6. [x] **Responder desde el hub.** Desde la ficha del lead, el texto sale por Chatwoot y el asistente se corre. Hecho el 15/11 ([#31](https://github.com/axellaban/mindlin-asistente/pull/31) y matimindlin111/mindlinhub#94). Solo texto: los archivos, desde Chatwoot.
7. [x] **Revisar respuestas reales todas las semanas.** Hecho el 15/11 ([#32](https://github.com/axellaban/mindlin-asistente/pull/32) y matimindlin111/mindlinhub#95, [`docs/revisar.md`](docs/revisar.md)). Falta que **Mindlin** lo use una vez por semana (Asistente de WhatsApp → Revisar). En el hub, una lista de las respuestas del asistente para marcar las buenas (pasan a ejemplos) y las malas (con qué corregir en el tono o la ficha). Lo usa Mindlin.
8. [x] **Fotos y audios del lead adentro del hub.** Hecho el 15/11 ([#33](https://github.com/axellaban/mindlin-asistente/pull/33) y matimindlin111/mindlinhub#96): se ven en Conversaciones y en el chat del lead del CRM, directo desde Chatwoot. Para prenderlo, **Panel crea el usuario «Hub»** (tarea 14 de [`IA_DE_PANELES.md`](IA_DE_PANELES.md)).
9. [ ] **Una sola IA.** Elegir Claude u OpenAI y dejarla fija en Vercel. Hoy responde OpenAI, por la prueba. — Axel
   - No hace falta código: se elige con `ASISTENTE_PROVEEDOR` (`anthropic` u `openai`) en Vercel y se vuelve a publicar. La otra clave se puede dejar (OpenAI igual hace falta para transcribir los audios). Antes de dejarla fija, conviene probar la elegida en la pestaña Probar del hub con las conversaciones difíciles de la QA. Ver [`docs/asistente.md`](docs/asistente.md).
10. [ ] **Esperas de los flujos a la hora justa** (al final, porque depende de si Mindlin pasa a Vercel Pro). Con Pro, el cron puede volver a correr cada 15 minutos (`CORRIDA` en `lib/seguimientos/reglas.ts` y `vercel.json`). Sin Pro, un servicio externo gratuito que llame al cron. Mientras tanto, las esperas salen en la corrida de las 10 del día siguiente. — Axel decide
   - **Cuando decida, lo que cambia (Claude):**
     - **Con Pro:** el cron de `vercel.json` vuelve a `*/15 * * * *`.
     - **Con un servicio externo:** el de `vercel.json` queda una vez por día, como respaldo, y un servicio como cron-job.org llama a `https://mindlin-asistente.vercel.app/api/cron/seguimientos` cada 15 minutos con el encabezado `Authorization: Bearer <CRON_SECRET>`. Así lo hace ya el hub con sus avisos.
     - **En los dos casos:** `CORRIDA` (`lib/seguimientos/reglas.ts`) baja a 15 minutos. Si no, el margen de medio día haría salir las esperas y los seguimientos antes de tiempo. Hay una prueba que controla que `CORRIDA` y `vercel.json` coincidan: con el servicio externo, esa prueba se ajusta.

## Ideas traídas de DeskcommCRM (15/11)

Se evaluó instalar DeskcommCRM (un CRM de código abierto con WhatsApp e IA) y se eligió seguir con lo nuestro y sumar lo que sirve de él (camino C). Lo demás ya lo tenían el hub o el asistente. Dueño: Claude.

1. [x] **«No me escriban más», firme** ([#35](https://github.com/axellaban/mindlin-asistente/pull/35), [`docs/baja.md`](docs/baja.md)): una sola regla de baja; corta flujos y seguimientos para siempre en esa conversación. Arregla, además, que la señal «no le interesa» se borraba cuando la persona volvía a escribir.
2. [x] **Seguimientos espaciados** ([#36](https://github.com/axellaban/mindlin-asistente/pull/36), [`docs/seguimientos.md`](docs/seguimientos.md), «Espaciados»): entre 4 y 9 segundos al azar entre un mensaje automático y el siguiente, y los flujos escalonados, para no mandar 20 seguidos desde el mismo número.
3. [x] **Hub: «Te escribieron y nadie les contestó»** (matimindlin111/mindlinhub#99): en el Dashboard del CRM y en Chats, los leads que escribieron por WhatsApp y esperan respuesta del equipo (o a los que el asistente no les contestó en 10 minutos). Un «gracias» o un 👍 no cuentan. También se ve ahí la marca «Pidió que no le escriban».
4. [x] **Hub: respuestas rápidas** (matimindlin111/mindlinhub#100): textos guardados para mandar con un toque desde el chat del lead (⚡ o «/»), con {nombre} y {proyecto}. Se guardan en la pestaña «CRM Respuestas rápidas» de la planilla del CRM. **Mindlin carga las suyas** (cómo llegar, horarios, formas de pago): el hub no trae ninguna inventada.

**Lo que no se trajo, y por qué:**
- su bandeja de conversaciones (está Chatwoot);
- sus agentes de IA (está el asistente);
- el tablero del embudo, los motivos de pérdida, la importación de contactos y el scoring (ya los tiene el CRM del hub);
- el reparto de leads en rueda entre vendedores (con el equipo de hoy no hace falta; se puede sumar si crece);
- las automatizaciones «cuando pasa X, hacer Y» (por ahora alcanzan las etapas automáticas y los flujos);
- la entrada de leads desde formularios web o de Meta (se puede sumar si Mindlin usa formularios: avisar).
