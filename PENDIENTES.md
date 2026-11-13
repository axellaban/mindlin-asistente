# Pendientes

El alcance es el de la **propuesta de Mindlin para la primera versión** (cinco puntos: conversación por WhatsApp con su forma de hablar, contexto por proyecto, conexión con su CRM, seguimientos y que el equipo pueda intervenir). Lo que la propuesta deja para después está al final, en «Fuera de esta versión».

Dueños:
- **Claude:** el código.
- **Panel:** la IA con computer use, o Axel. Sus tareas están en [`IA_DE_PANELES.md`](IA_DE_PANELES.md) y anota los resultados en [`docs/estado-paneles.md`](docs/estado-paneles.md).
- **Axel.**
- **Mindlin:** el cliente.

Al terminar una tarea: marcarla `[x]`, con la fecha y lo que el siguiente necesita saber (sin claves).

## Lo próximo, en orden (para atender consultas reales)

Estado el 13/11, después de reinstalar el servidor con Easypanel (detalle en [`docs/estado-paneles.md`](docs/estado-paneles.md), «Reinstalación con Easypanel»):

- **Servidor:** Chatwoot 4.19.1 en `chat.mindlindevelopers.com` y WAHA 2026.10.1 en `waha.mindlindevelopers.com`, los cinco contenedores en verde, swap y respaldo nocturno.
- **Línea:** vinculada (sesión `WORKING`), bandeja 1 «WhatsApp Lerma 439», cuenta 1 «Mindlin Developers». Los mensajes entrantes llegan.
- **Asistente:** el Agent Bot «Asistente Mindlin» está asignado a la bandeja, las cuatro variables de Chatwoot están en Vercel (Production) y el despliegue `daee11f` quedó Ready. El webhook devuelve 200. **Falta ver una respuesta de punta a punta.** La conversación 2 quedó abierta (la atiende el equipo): para probar hay que ponerla «Pendiente» o escribir desde otro número.
- **Vercel:** el proyecto pasó a la cuenta `mindlindevelopers.ia` (plan Hobby). Por eso el cron de seguimientos corre una vez por día ([#17](https://github.com/axellaban/mindlin-asistente/pull/17)) y el repo es público. Las dos cosas se revierten si vuelve a un plan Pro.
- **Hub:** conectado (`apiDelHub: true`). Todo se configura desde HQ → Comercial → Asistente de WhatsApp.

1. **Axel (o Mati o Tadeo, en el hub):** mergear y publicar los PR del 13/11, uno en cada repo. En el asistente: «Conexiones», el horario del equipo configurable y el margen de los seguimientos. En el hub: esas mismas pantallas.
2. **Panel:** la prueba de punta a punta (tarea 10 de [`IA_DE_PANELES.md`](IA_DE_PANELES.md)). Empieza por **Conexiones** en el panel, que dice qué pieza no anda si algo falla.
3. **Axel:** decidir con qué IA responde (ver «Decisiones abiertas»). Se cambia con `ASISTENTE_PROVEEDOR` (`anthropic` u `openai`) en Vercel y volviendo a publicar ([`docs/asistente.md`](docs/asistente.md)).
4. **Mindlin:** revisar los borradores que se cargaron desde Kommo ([`docs/kommo.md`](docs/kommo.md)): la ficha de Lerma 439 y las cinco apagadas, el modo («presenta y pasa» o conversar), el horario del equipo, los seguimientos archivados y las etapas automáticas. Probarlo desde el hub (pestaña Probar) antes de abrir la línea.
5. **Claude con Axel:** con la prueba hecha, revisar las respuestas con la IA de verdad y las etapas con la planilla real; ajustar el tono con el material de Mindlin.

## Decisiones abiertas

- [ ] Correo para Chatwoot (invitaciones a agentes y avisos; también hace falta para el email más adelante). Opciones: Zoho (donde están los correos de Mindlin), Google Workspace o un servicio como Brevo. — Axel
- [x] ~~Los contactos que da de alta el asistente, ¿entran en «Nuevo» o en «Contacto inicial»?~~ Desde el 11/11 entran en **«Contacto inicial»**, la etapa del evento «El asistente le respondió por primera vez», así no disparan la alarma «nuevo sin contactar en 2 h». Si Mindlin prefiere que entren en «Nuevo», se cambia ese evento a «No mover» en Etapas automáticas. — Claude, 13/11
- [ ] Seguimientos: quedaron cargados y **archivados** los de Kommo (uno por proyecto, a las 24 h). Falta que Mindlin los revise, los pase a «Activa» y decida si suma más pasos. Sin reglas activas no sale ninguno. — Mindlin
- [ ] Modo de atención: ¿«presenta y pasa» (como Kommo: cuando la persona responde, sigue el equipo) o que el asistente siga la conversación (como está hoy)? Se cambia en Tono. — Mindlin
- [ ] Etapas automáticas: revisar las de fábrica (Comercial → Asistente de WhatsApp → Etapas automáticas). Por ejemplo, ¿«señal de compra» tiene que mover a Negociación? Hoy no mueve. — Mindlin
- [ ] VIA 53 y Torre Cuatro Vientos: los dos documentos de Mindlin tienen datos distintos (precios, entrega, forma de pago, el semipiso). Confirmar cuáles valen antes de activarlos (está en las notas internas de cada ficha). — Mindlin
- [ ] Con qué IA responde. Acá quedó decidido Claude (10/11), pero en producción quedó prendido OpenAI (`gpt-6.1-sol`, cargado por Panel el 10/11 para la prueba de la línea). Los dos andan; hay que elegir uno y dejarlo en Vercel. — Axel
- [ ] Horario del equipo comercial: hoy es de lunes a viernes de 9 a 20 (fuera de eso, si pasa la conversación avisa que le escriben apenas vuelvan). ¿Es así? Desde el 13/11 se cambia en el hub: Inteligencia comercial → Horario del equipo comercial (o en el panel, Tono). — Mindlin
- [ ] Plan de Vercel: seguir en Hobby (seguimientos una vez por día y repo público) o pasar a Pro (vuelven los seguimientos cada 15 minutos y el repo puede volver a privado). Con Hobby anda: los seguimientos tienen un margen para que «1 día» sea «mañana a las 10». — Axel
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
- [ ] Probar con Claude de verdad (en las pruebas se usó uno simulado) y ajustar. — Claude con Axel
- [x] Prueba por la línea real: el mensaje entró a la bandeja y la respuesta del Agent Bot llegó a WhatsApp (después del arreglo del #12). — Panel y Axel, 10/11
- [ ] Con la línea real, confirmar que los mensajes del bot no vuelven a entrar como si los hubiera escrito una persona (el webhook ya descarta ese eco). Está en la tarea 10, paso 3. — Panel

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
- [ ] Probar las etapas con la planilla real y la línea de prueba (tarea 10, pasos 4 y 5). — Panel
- [x] Busca por el ID anotado además del teléfono (sin eso, un contacto sin número se repetía en cada mensaje) y lee para qué busca, presupuesto y próximo paso. — Claude, 11/11
- [x] Planilla compartida con la cuenta de servicio y `CRM_SHEET_ID` en Vercel. — Panel, 09/11
- [x] El acuerdo de integración: qué lee y escribe, y qué tiene que cuidar Mindlin ([`docs/integracion-crm.md`](docs/integracion-crm.md)). — Claude, 10/11
- [x] Decidido: el CRM es una planilla de Google, que es lo que el asistente ya usa. Mindlin no tiene que construir nada para la integración. — Axel, 10/11
- [ ] Confirmar si es la planilla del CRM del hub (la que ya está en `CRM_SHEET_ID`) u otra. Si es otra: mismas pestañas y columnas, compartirla con la cuenta de servicio y cambiar `CRM_SHEET_ID` (`docs/integracion-crm.md`). — Axel
- [ ] Avisarle a Mindlin que no cambien el orden ni los nombres de las columnas sin avisar. — Axel
- [ ] Si en el hub cargan `CRM_CONTACTOS_SHEET_ID` (planilla comercial aparte, nueva desde el 11/11), poner el mismo ID en `CRM_SHEET_ID` de este proyecto. Si no, el asistente escribe en una planilla que el hub no lee. — Axel
- [ ] Probar el CRM con la planilla real (con la línea de prueba; tarea 10, paso 4). — Panel

## 4. Seguimientos

- [x] Reglas «si queda en tal etapa y pasan tantos días sin respuesta, mandar este mensaje», con la etapa del CRM. Frenan si la persona responde o si el equipo toma la conversación. De 9 a 20 y con tope (`docs/seguimientos.md`). — Claude, 10/11
- [x] Cargarlas desde el panel (`/panel/seguimientos`), con versiones para comparar mensajes. — Claude, 10/11
- [x] Email previsto: qué haría falta, sin código todavía (`docs/arquitectura.md`, sección 9). — Claude, 10/11
- [x] `CRON_SECRET` en Vercel (solo Production); el cron rechaza pedidos sin autorización. Falta ver salir un seguimiento con un contacto de prueba. — Panel, 10/11
- [x] El cron pasó de cada 15 minutos a una vez por día, a las 10 (plan Hobby; [#17](https://github.com/axellaban/mindlin-asistente/pull/17)). Se revierte si el proyecto vuelve a Pro. — Claude, 13/11
- [x] Con una corrida por día, cada regla vence medio día antes: «1 día» quiere decir «en la corrida de mañana a las 10» y no a los dos días. El panel y el hub dicen cada cuánto salen, y una prueba controla que coincida con `vercel.json` ([`docs/seguimientos.md`](docs/seguimientos.md)). — Claude, 13/11
- [ ] Cargar las primeras reglas (ver decisiones abiertas). — Mindlin

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
- [x] **Conexiones:** probar de verdad cada pieza (Chatwoot con el token del bot, la base, la planilla y sus columnas, la IA) y ver lo último que pasó, sin mandar nada. En el panel (`/panel/chequeo`) y en el hub (Resumen → «Probar las conexiones»). `/api/salud` solo mira que las variables existan, y el 13/11 eso no alcanzó para ver que las claves eran del Chatwoot anterior. — Claude, 13/11
- [x] La línea de prueba con el QR (tarea 5): escaneado desde Chatwoot, WAHA en `WORKING`. — Axel y Panel, 10/11
- [ ] Hostinger: delegar el acceso Admin a la cuenta de Axel y rotar las claves iniciales del servidor. — Axel

## Piloto

- [ ] Pruebas internas con el equipo. — Todos
- [ ] Consultas reales en la línea de Lerma 439. — Mindlin

## Fuera de esta versión

Lo deja la propuesta para después (lo construye Mindlin o se presupuesta aparte): scoring, afinar etapas, mensajes y reglas comerciales, agenda automática, clasificación de proveedores y postulantes, terrenos (el «bot para lotes» de Kommo), email (previsto; incluye los correos de VIA 53 de Kommo), avisos al responsable por el hub y la conexión del hub con Chatwoot.
