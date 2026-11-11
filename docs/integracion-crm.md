# Integración con el CRM de Mindlin

La propuesta de Mindlin pide que el asistente **registre** los datos del interesado, lo que busca y un resumen, y que **consulte** la etapa, el responsable y lo que ya saben de esa persona. También pide acordar qué hace falta de su lado. Este documento es ese acuerdo.

**Decidido (Axel, 10/11): el CRM es una planilla de Google.** El asistente ya lee y escribe ahí, así que la integración está hecha; falta probarla con la línea real.

## La planilla del CRM

El CRM guarda en una planilla de Google, con las pestañas **«CRM Contactos»** y **«CRM Actividad»**. El asistente entra con su propia cuenta de servicio, como **Editor** (`mindlin-asistente@mindlin-developers.iam.gserviceaccount.com`), y la planilla se indica con `CRM_SHEET_ID` en Vercel.

### Qué lee

En «CRM Contactos» busca a la persona primero por el **ID** que ya quedó anotado en la conversación (WhatsApp a veces no pasa el número) y si no, por **teléfono** (compara los últimos 10 dígitos, así «+54 9 11 5555-0000» y «11 5555 0000» son el mismo). De ese contacto usa:

| Dato | Para qué |
| --- | --- |
| Etapa | Se la dice a la IA, elige con ella las reglas de seguimiento y decide si corresponde moverla (etapas automáticas). |
| Responsable | Se la dice a la IA y la pone en la nota cuando pasa la conversación al equipo. |
| Notas | Para que la IA sepa lo que el equipo ya sabe de la persona (los primeros 600 caracteres). |
| Para, ambientes, presupuesto, forma de pago, plazo | Para que la IA no vuelva a preguntar lo que el equipo ya sabe. |
| Próximo paso y su fecha | Para que la IA no contradiga lo que acordó el equipo. |
| Último contacto, proyectos | Contexto para la IA. |

Las etapas que entiende son las del hub de noviembre de 2026: Nuevo, Contacto inicial, Seguimiento, Visita / reunión, Negociación, Reserva, Vendido, Descartado y En pausa. Las de antes (Contactado, Interesado…) las lee como las de ahora.

### Qué escribe

**Nunca borra ni cambia los datos que cargó una persona.** Agrega filas y, de un contacto que ya existe, lo único que cambia es la **etapa** (ver abajo).

- **Un contacto nuevo** en «CRM Contactos», si la persona no estaba: ID, proyecto, nombre (o «WhatsApp +54…» si no lo dijo), teléfono, tipo «Beneficiario al costo», origen **WhatsApp**, etapa **Contacto inicial** (la del «primer contacto» en las etapas automáticas; sin reglas, **Nuevo**), presupuesto, forma de pago, plazo, para qué busca, ambientes, notas («Entró por WhatsApp (asistente).» y el resumen), responsable (`CRM_RESPONSABLE`, si está) y las fechas. Las opciones son las mismas listas del hub: si la IA entiende algo que no es una opción, deja la celda vacía.
- **Actividad** en «CRM Actividad», tipo WhatsApp y usuario «Asistente WhatsApp»:
  - el alta («Alta por WhatsApp…»);
  - cada dato nuevo que cuenta la persona, si ya era contacto (solo lo que cambió: lo que ya estaba anotado no se repite);
  - cuando pasa la conversación al equipo, con el motivo y el resumen;
  - cada seguimiento automático.
- **Cambio de etapa** (etapas automáticas, pedido de Mindlin del 11/11/2026): según lo que pasa en la conversación, mueve al lead de etapa. En la fila cambia solo «Etapa», «Entró a la etapa» y «Actualizado» (y, si lo descarta, «Motivo de pérdida» y el próximo paso, como el hub). En «CRM Actividad» lo anota como **«Cambio de etapa»** («Contacto inicial → Seguimiento. Automático: …»), igual que cuando lo mueve alguien desde el hub.
  - Qué evento mueve a qué etapa se configura en el hub (Comercial → Asistente de WhatsApp → Etapas automáticas) o en `/panel/etapas`. El detalle y los cuidados están en `lib/etapas/reglas.ts`.
  - Cuidados fijos: no toca **Reserva** ni **Vendido**; dentro del embudo solo avanza; a En pausa o Descartado solo desde Nuevo, Contacto inicial o Seguimiento; si alguien en pausa o descartado vuelve a escribir, lo reactiva. Antes de mover vuelve a leer la fila, por si alguien la cambió recién.

### Lo que tiene que cuidar Mindlin

- No cambiar el orden ni el nombre de las columnas de esas pestañas sin avisar: el asistente las lee por posición, como el hub.
- Si el hub cambia las etapas, las opciones o las columnas, hay que actualizar `lib/crm/planilla.ts` en este repo.

### Si se usa otra planilla

Hoy `CRM_SHEET_ID` apunta a la planilla del CRM del hub. Si Mindlin quiere que el asistente use otra planilla de Google, hace falta:

1. Que tenga las pestañas **«CRM Contactos»** y **«CRM Actividad»**, con las mismas columnas y en el mismo orden (están en `lib/crm/planilla.ts`: `COLUMNAS_CONTACTOS` y `COLUMNAS_ACTIVIDAD`), con los títulos en la primera fila.
2. Compartirla con la cuenta de servicio del asistente como **Editor**.
3. Cambiar `CRM_SHEET_ID` en Vercel por el ID de esa planilla y volver a publicar.

Si quieren otras columnas u otras etapas, se cambia `lib/crm/planilla.ts` (y sus pruebas): es un cambio chico.

### Límites de una planilla

- Google permite una cantidad de pedidos por minuto. El asistente usa su propia cuenta de servicio y hace una o dos lecturas por mensaje y una por corrida de seguimientos: para el volumen de un piloto sobra.
- El asistente agrega filas y mueve de etapa (con los cuidados de arriba). Asignar responsable, corregir datos, pasar a Reserva o a Vendido lo hace el equipo, a mano o desde el hub.
- Si el hub pasa su CRM a la base de datos (`DATABASE_URL` en su proyecto), deja de leer esta planilla: el asistente tendría que escribir en el hub y no acá. Hoy el CRM del hub está en la planilla.

## Lo que queda en Chatwoot

Si más adelante Mindlin conecta el hub a Chatwoot, ahí va a encontrar cada conversación completa (con lo que escribió el asistente y el equipo), el nombre y el teléfono del contacto, y las **notas internas** que deja el asistente al pasar una conversación (motivo, resumen y responsable). El asistente no necesita cambiar nada para eso.
