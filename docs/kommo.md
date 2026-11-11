# De los bots de Kommo al asistente

Mindlin pasó el relevamiento de sus automatizaciones de Kommo («Reglas de seguimiento y flujos de bots», 10/11/2026). Este documento dice qué hace hoy cada una, cómo queda en el asistente y **dónde se configura**. Todo lo comercial se cambia sin tocar código: desde el panel del asistente (`/panel`) o desde el hub, por la API ([`api-hub.md`](api-hub.md)).

## El mapa

| Lo que hace Kommo | En el asistente | Dónde se configura |
| --- | --- | --- |
| **Clasificar** la consulta por palabras clave y derivarla al proyecto. Si no encuentra, manda un menú. | Cada ficha tiene sus «palabras para reconocerlo». La IA entiende de qué proyecto hablan aunque lo escriban distinto; si no queda claro, pregunta. Nunca mezcla datos de dos proyectos. | Fichas → Palabras para reconocerlo. |
| **Primer contacto:** la presentación del proyecto en varios mensajes fijos (qué es, unidades, precios, financiación, brochure). | La ficha tiene una **Presentación**: es lo primero que cuenta, adaptado a lo que le preguntaron. El resto de la ficha (precios, financiación, links) lo usa para responder. | Fichas → Presentación y los demás campos. |
| **Seguimiento a las 24 h** sin respuesta, con un mensaje por proyecto. | Reglas de seguimiento por etapa, paso, días y proyecto, con versiones para comparar mensajes. De 9 a 20 y con tope. | Seguimientos. |
| Segundas 24 h sin respuesta: despedir y mandar a «Trash» (no estaba automatizado en todos). | Se puede cargar un 2.º paso con el mensaje de despedida. Si no responde a ningún seguimiento, pasa a «En pausa». | Seguimientos → paso 2, y Etapas automáticas. |
| **Cuando el lead responde, el bot se calla** y sigue Tade o alguien del equipo. | Dos modos. **Presenta y pasa** (como Kommo): cuando la persona responde después de la presentación, la conversación pasa al equipo con una nota. **Conversa** (por defecto): el asistente sigue la charla, responde dudas con la ficha, anota lo que busca y pasa la conversación cuando corresponde. | Tono → Modo «presenta y pasa», y «Cuándo pasar la conversación al equipo». |
| **Calificación** a criterio de quien atiende: para qué quiere la unidad, hace cuánto busca, de dónde es, qué necesita. | El asistente lo pregunta de a una cosa por mensaje y lo anota: para qué, ambientes, presupuesto, forma de pago, plazo, **de dónde es** y **hace cuánto busca**. Queda en el CRM y en la conversación. | Tono → Criterios comerciales (qué preguntar primero, qué evitar). |
| **Alquiler:** responde que solo venden. | Está en los criterios comerciales. | Tono → Criterios comerciales. |
| **Mover el lead de etapa** (sin respuesta, respondió). | **Etapas automáticas:** mueve al lead según lo que pasa (primer contacto, respondió, seguimiento enviado, respondió a un seguimiento, sin respuesta, quiere visita, señal de compra, no le interesa, pasó al equipo) y lo anota como «Cambio de etapa». Nunca toca Reserva ni Vendido, ni retrocede. | Hub → Comercial → Asistente de WhatsApp → Etapas automáticas (o `/panel/etapas`). |
| **Bot para lotes** (dueños de terrenos: ciudad, superficie, frente, qué quieren hacer). | No está. La propuesta de la primera versión deja «terrenos» afuera. | — |
| **Correos VIA 53** (a las 24 h, a los 7 y a los 14 días). | No está. El email quedó previsto para más adelante (`arquitectura.md`, sección 9). | — |

## El otro documento: la base comercial

Mindlin pasó también un documento con la información de la empresa (Mindlin Developers y Borok Construcciones), los proyectos, preguntas frecuentes, objeciones, perfiles de leads, señales de compra y descarte, y qué no decir. Quedó cargado (migración 8) como **«Sobre la empresa»** y **«Objeciones, perfiles y señales»**, dos textos que el asistente lee siempre y que se editan en el hub (Inteligencia comercial) o en `/panel/tono`.

Algunos datos de ese documento no coinciden con el de los bots (VIA 53: precios, entrega y forma de pago; Torre Cuatro Vientos: el semipiso). No se pisó nada: quedó anotado en las notas internas de cada ficha para que Mindlin confirme cuál vale.

## Lo que ya quedó cargado (como borrador)

La migración `202611110007_borradores_de_kommo.sql` cargó lo que traía el relevamiento, para no tipearlo de nuevo:

- **Lerma 439** (el piloto, activo): se completó lo que estaba vacío (presentación, ubicación, avance de obra, unidades, precios, financiación y el brochure).
- **Güemes, 17 y 43, Ramblas del Plata, VIA 53 y Torre Cuatro Vientos:** fichas nuevas, **apagadas**. El asistente no las ofrece hasta que alguien las active.
- **Un seguimiento por proyecto** (a las 24 h, con el mensaje que mandaba Kommo), **archivado**. No sale ninguno hasta pasarlo a «Activa».
- El criterio de **alquiler** en el tono.

Solo se cargó lo que estaba completo. Lo que venía cortado en el relevamiento (algunas listas de unidades y precios) quedó vacío: el asistente no lo dice y ofrece que lo confirme el equipo. Cada ficha dice en sus notas internas qué le falta.

## Lo que tiene que hacer Mindlin

1. **Revisar cada ficha** (precios, disponibilidad, avance de obra: son datos que cambian) y completar lo que falta. En Lerma 439, mirar sobre todo «terminando la losa del quinto piso».
2. **Activar** los proyectos que quieran que atienda el asistente.
3. **Decidir el modo:** «presenta y pasa» (como Kommo) o que el asistente siga la conversación.
4. **Pasar a «Activa»** los seguimientos que quieran usar, y cargar el 2.º paso si quieren la despedida.
5. **Probarlo** en `/panel/probar` (o desde el hub) antes de abrir la línea.

## Diferencias a favor, para que no sorprendan

- El asistente **no manda la tanda entera de mensajes aunque la persona ya haya respondido** (el relevamiento marca que en Kommo eso no estaba verificado). Contesta lo que le preguntaron.
- **No clasifica mal por coincidencias sueltas** («53», «1», «terminada»): entiende el mensaje completo.
- Si un dato no está en la ficha, **no lo inventa**: dice que lo confirma el equipo.
- Los seguimientos **frenan solos** si la persona responde o si alguien del equipo toma la conversación.
