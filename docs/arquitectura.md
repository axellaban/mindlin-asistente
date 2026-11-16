# Arquitectura

Acordada con Axel el 07/11/2026. Si cambia algo, se actualiza acá en el mismo PR.

```
Interesado ──WhatsApp──► WAHA ──► Chatwoot ◄──── Equipo comercial (web y app del celular)
                     (Hostinger) (Hostinger)
                                     │ Agent Bot: un aviso por cada mensaje
                                     ▼
                         Asistente (Vercel, este repo) ──► Claude (OpenAI, opcional)
                            │                 │
                     Neon (Postgres)    CRM del hub (Google Sheets)
              (fichas, tono, reglas,    (contacto, etapa, responsable,
               seguimientos)             resumen de cada conversación)
```

## 1. WhatsApp: WAHA para el piloto

- WAHA conecta un número común de WhatsApp como un dispositivo vinculado. Desde la versión 2026.6 es gratis con todo incluido (varias líneas, audios, la integración con Chatwoot).
- **Riesgo:** no es oficial, y WhatsApp puede bloquear el número. Sube con los envíos masivos o a quien no escribió. Por eso los seguimientos van solo a quien consultó, en horario y con tope.
- **Salida:** la API oficial de Meta (sin riesgo de bloqueo, con plantillas pagas para escribir después de 24 h). Chatwoot la soporta directo: cambiar de una a otra es configuración, no rehacer el asistente.

## 2. Chatwoot: la bandeja central

El equipo necesita responder y ver todas las conversaciones en un solo lugar.

- Todas las líneas juntas, en la web y en la app del celular (iOS y Android).
- Asignar conversaciones, notas internas, etiquetas, el historial de cada contacto. El email se suma después como otra bandeja.
- WAHA le pasa los mensajes con su integración propia (sin código). Lo que alguien mande desde el celular de la línea también aparece, **como mensaje y no como nota interna** (así el bot sabe que lo tomó una persona).
- Una conversación por chat, como en WhatsApp. WAHA crea además una conversación «Integración de WhatsApp» para avisos y el QR: el bot la ignora.
- Corre en **Easypanel** (desde el 13/11, decisión de Axel: se maneja desde un panel web, sin consola), con [`infra/easypanel/docker-compose.yml`](../infra/easypanel/docker-compose.yml). `infra/servidor.sh` conecta la línea y el bot, verifica y respalda. Guía en [`easypanel.md`](easypanel.md). Antes estaba instalado directo sobre Ubuntu con `servidor.sh` (ver `infra/README.md`).
- **Necesita unos 4 GB de RAM** (Chatwoot con su Postgres y Redis, más WAHA). El VPS de DonWeb que tenía Mindlin (1 GB) no alcanzaba: el 07/11 Axel eligió un Hostinger KVM 1 (1 vCPU, 4 GB, 50 GB), con swap y menos hilos en Chatwoot (ver `infra/README.md`). Si queda corto, el KVM 2.

## 3. El bot es un Agent Bot de Chatwoot

- Cada conversación nueva entra como **pendiente**: la atiende el bot.
- Cuando el bot necesita a una persona, o alguien del equipo la toma o escribe (desde Chatwoot o desde el celular), pasa a **abierta** y el bot se calla.
- Chatwoot le sigue avisando al bot aunque la conversación esté abierta: el bot mira el estado antes de contestar. Lógica en `lib/chatwoot/evento.ts`.
- Los avisos vienen firmados con la clave del bot y el asistente verifica la firma.
- Si el asistente no responde, Chatwoot pasa la conversación a abierta: atiende el equipo.
- Detalle de lo que se confirmó probando en [`chatwoot.md`](chatwoot.md); el recorrido de un mensaje, en [`asistente.md`](asistente.md).

## 4. El asistente: una app aparte, en Vercel

- Se publica sola: si el bot falla o tiene carga, no afecta al hub. Tampoco depende de la cuenta de GitHub suspendida.
- **Dónde está (13/11):** en el equipo de Vercel `mindlin-developers-ia` (cuenta `mindlindevelopers.ia`), que es **plan Hobby**. Eso trajo dos cambios: el cron de seguimientos pasó a una vez por día (sección 8) y el repo se hizo público, porque en Hobby con repo privado Vercel solo publica los commits del dueño de la cuenta. Los dos se revierten si el proyecto vuelve a un plan Pro.
- **Saber si anda de verdad:** «Conexiones» en el panel o «Probar las conexiones» en el hub prueban cada pieza (Chatwoot con el token del bot, la base, la planilla, la IA) sin mandar nada (`lib/chequeo.ts`). `/api/salud` solo dice si las variables existen.
- Mismo stack y convenciones que el hub, para poder sumarlo como módulo más adelante si lo quieren adentro.
- Su panel (`/panel`, con clave): conversaciones del bot, líneas, fichas de proyecto, tono y ejemplos, reglas de seguimiento. Ver [`panel.md`](panel.md).

## 5. CRM: el del hub

El cliente pidió conectarse con «el CRM que vamos construyendo nosotros», que está en el hub (Comercial → CRM) y guarda en Google Sheets.

| Opción | A favor | En contra |
| --- | --- | --- |
| **CRM del hub, como está (elegida)** | Ya existe, el equipo lo usa, Mati y Tadeo lo siguen construyendo | Sheets tiene límite de pedidos por minuto; no sirve para guardar cada mensaje |
| CRM del hub pasado a Postgres | Mismas pantallas, sin límites | Tocar un módulo que cambian todos los días; necesita el repo del hub |
| CRM nuevo en Supabase | A medida | Dos CRM, contra lo que pidió el cliente |
| CRM comercial (Kommo, HubSpot) | WhatsApp y bots incluidos | Pago por usuario, datos afuera, el cliente eligió el suyo |

Cómo se usa:

- Al CRM va solo lo que el equipo mira: el alta del contacto, la etapa, el responsable y un resumen por conversación (pestañas «CRM Contactos» y «CRM Actividad»).
- El asistente usa **su propia cuenta de servicio de Google**, para tener su propio límite de pedidos y no comerle cuota al hub.
- **Decidido (Axel, 10/11): el CRM es una planilla de Google.** El asistente escribe directo en la planilla, con las mismas columnas que el hub. No hace falta que Mindlin construya nada de su lado.
- Las etapas, las columnas y los orígenes son los del hub de noviembre de 2026 (etapas Nuevo → Contacto inicial → Seguimiento → Visita / reunión → Negociación → Reserva → Vendido, más Descartado y En pausa; columna Tags; origen WhatsApp). Revisado el 10/11 contra `lib/crm/modelo.ts` del hub.
- Qué lee y escribe, qué tiene que cuidar Mindlin y cómo apuntarlo a otra planilla: [`integracion-crm.md`](integracion-crm.md).

## 6. Base del asistente: Postgres en Neon (creado desde Vercel)

Primero iba a ser Supabase, pero el plan gratis de Axel estaba lleno (dos proyectos). El 07/11 se cambió a Neon, que es Postgres puro y también se crea desde Vercel, gratis. La app se conecta con `DATABASE_URL` (`lib/datos/postgres.ts`). Las tablas están en `db/migraciones/` y se aplican solas antes de cada publicación (`scripts/migrar.mjs`).

Fichas de cada proyecto, tono y ejemplos, reglas de seguimiento con sus versiones, el estado de cada seguimiento y el registro de lo que hizo el bot.

También guarda el historial de mensajes (solo el texto). El token del Agent Bot no puede leer el historial de Chatwoot, así que el asistente lo arma con los avisos.

## 7. El agente: OpenAI o Claude, con herramientas

- Responde la IA que elija `ASISTENTE_PROVEEDOR` en Vercel: Claude (Opus 5.5) u OpenAI (GPT-6.1 Sol, por la API «Responses»). Están cargadas las dos claves; en la última lectura de `/api/salud` (13/11) respondía OpenAI. Elegir una es una decisión abierta de Axel (`PENDIENTES.md`). Cambiar de una a otra no toca código: el agente arma los pedidos siempre igual y un adaptador los traduce (ver `asistente.md`).
- Instrucciones de tono y ejemplos, más la ficha del proyecto de la conversación. Van primero, para aprovechar el caché del proveedor. Si no sabe de qué proyecto se trata, pregunta.
- El contacto del CRM se busca antes de responder: por el ID anotado en la conversación y, si no, por teléfono.
- Herramientas:
  - registrar al interesado y lo que busca;
  - elegir el proyecto, si hay más de uno;
  - pasar la conversación a una persona.
- Espera 6 segundos antes de contestar, por si la persona sigue escribiendo.
- Audios: Claude no los escucha. Con `OPENAI_API_KEY` (más adelante) se transcriben con OpenAI y responde por escrito; mientras tanto, pide que lo escriban.
- El equipo interviene con los estados de Chatwoot: tomar una conversación, devolvérsela al asistente o pausarlo entero desde el panel (ver `asistente.md`, «Cuando interviene el equipo»).

## 8. Seguimientos

- Reglas del tipo «si queda en tal etapa y pasan tantos días sin respuesta, mandar este mensaje», con versiones para comparar cuál convierte mejor.
- Solo a quien ya escribió, de 9 a 20, con tope de intentos. Frenan si el interesado responde o si una persona tomó la conversación.
- Salen por Chatwoot, así quedan a la vista en la bandeja.
- Corren una vez por día con el cron de Vercel, a las 10 de la mañana de Buenos Aires (13:00 UTC). Era cada 15 minutos; pasó a diario el 13/11, cuando el proyecto quedó en una cuenta con plan Hobby, que no admite crons más seguidos. Para que una regla de «1 día» no salga a los dos días, cada regla vence medio día antes (margen de media corrida). La etapa sale del CRM del hub. Detalle en [`seguimientos.md`](seguimientos.md).

## 9. Email (previsto, no hecho)

La propuesta pide empezar por WhatsApp y dejar prevista la incorporación del email. Así quedó:

- En Chatwoot, el email es **otra bandeja**: se conecta una casilla (por ejemplo, de Zoho, donde están los correos de Mindlin) y los mails entran como conversaciones, igual que los WhatsApp.
- El asistente ya recibe los avisos de cualquier bandeja que tenga el Agent Bot. Para sumar email faltaría: que el tono permita mensajes más largos y con saludo cuando la bandeja es de mail; buscar el contacto del CRM por mail además de por teléfono; y que los seguimientos salgan por la misma bandeja de la conversación (ya salen por Chatwoot, así que esto viene solo).
- Antes hace falta el correo de salida de Chatwoot (la decisión abierta en `PENDIENTES.md`).

## 10. El hub: configurar el asistente y, más adelante, Chatwoot

Mindlin construye el hub (pantallas y funciones). **Todo lo comercial del asistente se configura sin tocar código** (fichas, presentación, tono, criterios, modo de atención, horario del equipo, ejemplos, reglas de seguimiento, etapas automáticas, pausa, líneas y flujos), por dos caminos que usan los mismos datos:

- el panel del asistente (`/panel`), que ya funciona;
- la API para el hub ([`api-hub.md`](api-hub.md)), con una clave compartida (`HUB_CLAVE`). Las pantallas del hub están en HQ → Comercial → Asistente de WhatsApp (repo `mindlinhub`). El asistente es el dueño de esa configuración (está en su base); el hub la lee y la cambia. Así no hay dos copias que se desfasen.

Qué hacían los bots de Kommo y cómo quedó cada cosa: [`kommo.md`](kommo.md).

**Etapas automáticas** (11/11): el asistente mueve al lead de etapa en la planilla del CRM según lo que pasa en la conversación. Es la única celda que cambia de un contacto existente, con cuidados fijos (no toca Reserva ni Vendido, no retrocede). Ver [`integracion-crm.md`](integracion-crm.md).

Si más adelante lo conectan a Chatwoot, el asistente no cambia: sigue atendiendo por Chatwoot, y el hub encuentra ahí las conversaciones y las notas del asistente (ver [`integracion-crm.md`](integracion-crm.md)).

## 11. Varias líneas y flujos (15/11)

Mindlin pidió cuatro líneas de WhatsApp: 1 outreach frío, 2 la del equipo (facturas, lo del bot de Telegram y outreach cálido), 3 y 4 leads entrantes. También pidió que las reglas, la lógica, los caminos y el paso a una persona se configuren como sus bots de Kommo.

- **Una línea es una bandeja de Chatwoot** (una sesión de WAHA). El asistente sabe de qué línea es cada mensaje por la bandeja del aviso (tabla `lineas`). El asistente de ventas solo contesta en las líneas de leads; en las otras, y en una bandeja que no es de ninguna línea, pasa al equipo con una nota. Así, conectar un número antes de configurarlo nunca hace que el bot de ventas le conteste a quien no corresponde. Detalle en [`lineas.md`](lineas.md).
- **Compartido y por línea.** Lo que sabe Mindlin es uno solo: las fichas, la empresa, las objeciones, los ejemplos, el horario y las etapas, porque el embudo del CRM es uno. Cómo atiende cada línea es suyo: la pausa, el modo, sus instrucciones, qué proyectos atiende, sus flujos y sus seguimientos. Copiar toda la configuración por línea habría obligado a editar la empresa cuatro veces.
- **Flujos como lista de pasos con caminos, no como un dibujo libre** ([`flujos.md`](flujos.md)). «Esperar respuesta» abre dos caminos (responde / no responde) y cada camino es otra lista. Se descartó un lienzo de nodos y flechas: con una lista no se pueden armar vueltas infinitas, se valida entero antes de guardar y lo entiende alguien que no es técnico. Alcanza para todos los bots del documento de Kommo. El editor del hub deja arrastrar los pasos para reordenarlos.
- **Cada corrida guarda una copia de los pasos** y por dónde va. Editar un flujo no cambia las conversaciones que ya lo empezaron, y la base deja una sola corrida viva por conversación.
- **Las esperas largas las retoma el cron** (con Hobby, una vez por día). Las pausas cortas corren en la misma función (hasta 120 segundos por tramo).
- **El bot de Telegram (línea 2) va al final y el outreach frío (línea 1) espera lo que pase Mindlin.** La línea existe para que el ruteo ya sea el correcto.

## 12. Ver las conversaciones desde el hub (decidido el 15/11; la API está desde el 15/11, ver `api-hub.md`)

Axel pidió ver en el hub las conversaciones de cada línea con cada persona, sin cargar Vercel.

**Se leen de la base del asistente, solo cuando alguien las abre. Para lo que no está ahí, se abre Chatwoot.**

- **El asistente ya tiene el texto.** Cada aviso de Chatwoot guarda el mensaje en `mensajes`: lo que escribe la persona, el asistente y el equipo (desde Chatwoot o desde el celular de la línea), en el momento. Así hace con todas las bandejas que tienen el Agent Bot. No hay que copiar nada más ni consultar a Chatwoot para leerlo.
- **Lectura a pedido.** El hub lo pide cuando se abre la pantalla o la conversación: un pedido al asistente y una consulta a la base, de milisegundos. No hay sincronización, cron ni consultas cada tantos segundos. Con Fluid compute, Vercel cobra el tiempo de trabajo, no la espera. Neon se apaga solo cuando nadie consulta.
- **Dónde se ve:**
  - En el **CRM**: la ficha del lead → Chat, y la bandeja Comercial → CRM → Chats. Esas pantallas ya existen (`docs/crm.md` del hub, «Chat del lead y bandeja») y esperan «la integración de WhatsApp». El asistente tiene anotado de cada conversación el contacto del CRM (`crm_contacto_id`) y el teléfono: se cruzan por ahí, y los mensajes de WhatsApp se suman a los que ya anota el CRM, marcados con su línea.
  - En **Asistente de WhatsApp**, una solapa «Conversaciones» por línea, para supervisar al asistente: qué dijo, en qué paso del flujo va y quién la atiende.
- **Lo que no está en la base:** las fotos, los audios y los archivos en sí (en la base quedan como «[foto]» y los audios transcriptos), las notas internas y lo anterior a que la bandeja tuviera el bot. Para eso, «Abrir en Chatwoot», con un link directo a la conversación.
- **Verlos adentro del hub (fase 2, hecha el 15/11):** se le piden a Chatwoot en el momento, solo de la conversación abierta (`GET /api/hub/adjuntos/{id}`), con el token de un usuario «Hub» de Chatwoot (`CHATWOOT_HUB_TOKEN`), porque el del Agent Bot no puede leer el historial. El hub muestra cada foto, audio o archivo con el link de Chatwoot: se ven directo desde el VPS, sin pasar por Vercel. Solo se aceptan links de ese mismo Chatwoot. Sin el token, todo sigue con «📷 Foto» y «Abrir en Chatwoot».
- **Las cuatro líneas:** para que entren todas, se asigna el Agent Bot a todas las bandejas. En outreach y en la del equipo no contesta (pasa al equipo), pero guarda los mensajes.
- **Responder desde el hub (fase 3, hecha el 15/11):** el asistente se corre (la conversación pasa a abierta, sin seguimientos ni flujo) y después manda el mensaje por Chatwoot **con el token del Agent Bot**, con una nota interna que dice quién lo escribió. En la base queda como del equipo. Así no hace falta un token de usuario de Chatwoot en Vercel; el costo es que en Chatwoot el mensaje figura del bot (la nota lo aclara). Si más adelante se suma el usuario «Hub» (fase 2), puede mandar con ese. Solo texto: los archivos, desde Chatwoot.

¿Por qué no consultar a Chatwoot cada vez que se abre una conversación?

- Obliga a guardar en Vercel un token de usuario con acceso a todo Chatwoot.
- Chatwoot devuelve de a 20 mensajes, así que hacen falta varios pedidos por conversación.
- Depende de que el servidor esté arriba y es más lento.

Queda como complemento para los adjuntos.

## 13. De qué campaña viene cada lead (15/11)

Pedido de Axel (mejora 2). **Se decide con el primer mensaje y no cambia**: por las frases de cada campaña (el texto que arma el anuncio de Meta) y, si ninguna coincide, por la campaña de la línea. Queda en la conversación y, en el CRM, como etiqueta «Campaña: …» del lead nuevo (al que ya estaba solo se le anota en la actividad). Detalle en [`campanias.md`](campanias.md).

¿Por qué por texto y no por el dato del anuncio? Meta manda de qué anuncio viene un mensaje («referral») solo por la API oficial de WhatsApp; por WAHA y Chatwoot no llega. Si algún día se pasa a la API oficial, se suma esa vía.

## 14. «No me escriban más» (15/11)

Idea traída de DeskcommCRM: una sola regla de baja para todo. Si la persona lo pide (o la IA marca «no le interesa»), no le sale nada automático más en esa conversación: ni seguimientos ni flujos, aunque vuelva a escribir o el equipo le devuelva la conversación al asistente. La IA le contesta una vez, corto, y el equipo puede seguir escribiéndole a mano. Tiene su propia marca (`conversaciones.pidio_baja`), separada de la de «la tiene el equipo». Detalle en [`baja.md`](baja.md).

## 15. Outreach frío en la línea 1 (decidido el 16/11, falta hacerlo)

Mindlin va a cargar sus bases de leads viejas para escribirles desde la línea 1. Para WhatsApp son contactos nuevos, así que Axel autorizó la excepción a la regla de «no escribirle a quien no escribió», solo en esa línea y con cuidados configurables: chip propio, tope diario con subida gradual, tandas, pausas, franjas, variantes de cada texto, 3 mensajes sin respuesta como máximo y baja para siempre. Los cuidados los hace cumplir el servidor en cada envío, no la pantalla, para que dos pestañas o una persona y un agente a la vez no pasen los límites. La baja pasa a guardarse también por teléfono (hoy es por conversación).

- **Dos modos de envío:** WAHA nativo (sale del servidor, sin abrir WhatsApp) y computer use (un agente en WhatsApp Web, con una pantalla «Enviar» pensada para él). Se pueden usar los dos.
- **Con el plan Hobby:** la tanda con pausas la maneja la pantalla del hub mientras está abierta. Si hace falta que salga sola, después se suma un proceso en el servidor de Easypanel.
- **Datos:** en la base del asistente (tablas `outreach_*`). Al CRM entra solo quien responde con interés.
- **Respuestas:** llegan en el momento por el webhook de Chatwoot, no con una lectura diaria como en Turnia.

Se toma la lógica del panel de prospección de Chapa Labs (Turnia y habita.), rehecha acá. Detalle y orden de trabajo en [`outreach.md`](outreach.md).

## Lo que se reutiliza de otros proyectos de Axel

Se adapta, no se copia a ciegas:

- **Turnia** (`axellaban/turniasalud`): límites por chat contra bucles con otros bots (`src/lib/chat-guard.ts`, `chat-limits.ts`), seguimientos en horario y con tope (`src/lib/followups.ts`), transcripción de audios, el diseño del agente con herramientas, y el trato con WAHA si hace falta hablarle directo (`src/lib/waha.ts`).
- **habita.** (`axellaban/amoblaia`): mensajes de seguimiento por etapa con versiones y la medición de cuál convierte (`docs/FOLLOWUP.md`), y el historial de conversaciones del asistente.
- **Chapa Labs** (`facundogregorini-lab/chapa-labs`, el que se publica; no `axellaban/chapa-labs`): el panel de prospección. Es la base del outreach frío (sección 15).

## Fuera del MVP

Lo que la propuesta deja para después (lo construye Mindlin o se presupuesta aparte): scoring, afinar etapas, mensajes y reglas comerciales, agenda automática, clasificación de proveedores y postulantes, terrenos y email (previsto, ver sección 9). La línea de outreach ya existe (sección 11), y su panel está diseñado (sección 15).
