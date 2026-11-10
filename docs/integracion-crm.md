# Integración con el CRM de Mindlin

La propuesta de Mindlin pide que el asistente **registre** los datos del interesado, lo que busca y un resumen, y que **consulte** la etapa, el responsable y lo que ya saben de esa persona. También pide acordar qué hace falta de su lado. Este documento es ese acuerdo: qué hace hoy y qué necesitaría el día que su CRM deje la planilla.

## Hoy: la planilla del CRM

El CRM del hub guarda en una planilla de Google, con las pestañas **«CRM Contactos»** y **«CRM Actividad»**. El asistente entra con su propia cuenta de servicio, como **Editor** (`mindlin-asistente@mindlin-developers.iam.gserviceaccount.com`), y la planilla se indica con `CRM_SHEET_ID` en Vercel.

### Qué lee

En «CRM Contactos» busca a la persona primero por el **ID** que ya quedó anotado en la conversación (WhatsApp a veces no pasa el número) y si no, por **teléfono** (compara los últimos 10 dígitos, así «+54 9 11 5555-0000» y «11 5555 0000» son el mismo). De ese contacto usa:

| Dato | Para qué |
| --- | --- |
| Etapa | Se la dice a la IA y elige con ella las reglas de seguimiento. |
| Responsable | Se la dice a la IA y la pone en la nota cuando pasa la conversación al equipo. |
| Notas | Para que la IA sepa lo que el equipo ya sabe de la persona (los primeros 600 caracteres). |
| Para, ambientes, presupuesto, forma de pago, plazo | Para que la IA no vuelva a preguntar lo que el equipo ya sabe. |
| Próximo paso y su fecha | Para que la IA no contradiga lo que acordó el equipo. |
| Último contacto, proyectos | Contexto para la IA. |

Las etapas que entiende son las del hub de noviembre de 2026: Nuevo, Contacto inicial, Seguimiento, Visita / reunión, Negociación, Reserva, Vendido, Descartado y En pausa. Las de antes (Contactado, Interesado…) las lee como las de ahora.

### Qué escribe

**Solo agrega filas: nunca cambia ni borra una fila que cargó una persona.**

- **Un contacto nuevo** en «CRM Contactos», si la persona no estaba: ID, proyecto, nombre (o «WhatsApp +54…» si no lo dijo), teléfono, tipo «Beneficiario al costo», origen **WhatsApp**, etapa **Nuevo**, presupuesto, forma de pago, plazo, para qué busca, ambientes, notas («Entró por WhatsApp (asistente).» y el resumen), responsable (`CRM_RESPONSABLE`, si está) y las fechas. Las opciones son las mismas listas del hub: si la IA entiende algo que no es una opción, deja la celda vacía.
- **Actividad** en «CRM Actividad», tipo WhatsApp y usuario «Asistente WhatsApp»:
  - el alta («Alta por WhatsApp…»);
  - cada dato nuevo que cuenta la persona, si ya era contacto (solo lo que cambió: lo que ya estaba anotado no se repite);
  - cuando pasa la conversación al equipo, con el motivo y el resumen;
  - cada seguimiento automático.

### Lo que tiene que cuidar Mindlin

- No cambiar el orden ni el nombre de las columnas de esas pestañas sin avisar: el asistente las lee por posición, como el hub.
- Si el hub cambia las etapas, las opciones o las columnas, hay que actualizar `lib/crm/planilla.ts` en este repo.

## Cuando el CRM deje la planilla

El hub ya puede guardar el CRM en su propia base de datos. Cuando lo activen, lo que el asistente escriba en la planilla **dejaría de verse** en el hub. Para ese momento, el asistente necesita que el hub ofrezca **cuatro operaciones**, protegidas con una clave compartida (en Vercel, en los dos proyectos):

| Operación | Qué recibe | Qué devuelve |
| --- | --- | --- |
| Buscar un contacto | el id (si ya se conoce) o el teléfono | id, nombre, teléfono, etapa, responsable, proyectos, último contacto, notas, para, ambientes, presupuesto, forma de pago, plazo y próximo paso; o «no está» |
| La etapa de varios contactos | una lista de teléfonos o ids (para los seguimientos, cada 15 minutos) | id, teléfono y etapa de cada uno |
| Dar de alta un contacto | los mismos datos que hoy van a la fila nueva | el id |
| Sumar actividad | id del contacto, tipo («WhatsApp»), detalle y fecha | — |

Del lado del asistente, el cambio es chico: todo pasa por cuatro funciones (`buscar`, `contactos`, `crearContacto` y `anotarActividad` en `lib/crm/planilla.ts`), así que se cambia cómo se conectan sin tocar el resto.

## Lo que queda en Chatwoot

Si más adelante Mindlin conecta el hub a Chatwoot, ahí va a encontrar cada conversación completa (con lo que escribió el asistente y el equipo), el nombre y el teléfono del contacto, y las **notas internas** que deja el asistente al pasar una conversación (motivo, resumen y responsable). El asistente no necesita cambiar nada para eso.
