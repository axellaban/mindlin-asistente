# «No me escriban más»

Idea traída de DeskcommCRM (15/11): **una sola regla de baja que vale para todo**. Si alguien pide que no le escriban, no le sale nada automático más: ni seguimientos ni flujos, en ningún lado. Es respeto y, como WhatsApp por WAHA no es oficial, también cuida el número: que alguien que pidió la baja reciba otro mensaje es la manera más rápida de que lo denuncien y lo bloqueen.

## Cuándo cuenta como baja

- **Lo que escribe la persona** (`lib/baja.ts`, `pidioNoEscribir`): pedidos claros, con o sin tildes ni mayúsculas. Por ejemplo, «no me escriban más», «no me manden nada más», «dejen de escribirme», «dame de baja», «borrame de la lista», «no quiero recibir más mensajes», «no quiero que me escriban», «basta de mensajes», «no molesten», o un «STOP» o «Baja» solos.
  - Es estricta a propósito: «no me mandaste más fotos» (un reclamo), «no me interesa el de 2 ambientes», «no me molestás» o «no quiero que me llamen, prefiero WhatsApp» no cuentan.
- **Lo que marca la IA:** la señal «no le interesa» (`marcar_senal`), que es «dijo que no le interesa o pidió que no le escriban más». Un «no me interesa» suelto lo decide la IA, no la regla.

## Qué pasa

- **No le salen más seguimientos ni flujos** en esa conversación. Si había un flujo esperando su respuesta, se corta: no sigue por «Si responde» ni por «Si no responde». Si la baja la marcó la IA en medio de un flujo, el flujo termina lo que estaba mandando y el cron ya no lo retoma.
- **La IA le contesta una vez, corto:** que no le van a escribir más y que, si algún día quiere información, puede escribir por acá. No ofrece nada ni pregunta nada. Si en realidad pedía otra cosa (que lo llamen, que le escriban por mail), responde a eso.
- **Etapa:** pedir la baja no lo hace avanzar de etapa. Si la IA marca «no le interesa», pasa a **Descartado** (etapas automáticas, ver [`integracion-crm.md`](integracion-crm.md)).
- **Queda anotado:** en el CRM, en la actividad del lead («Pidió que no le escriban más por WhatsApp…»); en el registro del asistente («Pidió que no le escriban», se ve en el panel); y en la conversación (`pidio_baja`, la fecha), que el hub recibe en sus conversaciones.

## Y después

- **Si vuelve a escribir**, el asistente le contesta como siempre: lo que se frena es lo que sale solo. Pero la baja sigue: no vuelven los seguimientos.
- **Si el equipo le devuelve la conversación al asistente** (la pone «Pendiente» en Chatwoot), el asistente vuelve a contestar, pero tampoco vuelven los seguimientos.
- **El equipo puede escribirle a mano** cuando quiera (desde Chatwoot o desde el hub). La decisión de volver a escribirle es de una persona, no del asistente.

## Antes de este cambio

La señal «no le interesa» frenaba los seguimientos con la misma marca que se usa cuando una persona del equipo toma la conversación (`sin_seguimientos`). Si la persona volvía a escribir, el asistente lo tomaba como «el equipo me la devolvió»: anotaba eso (sin que nadie lo hubiera hecho) y los seguimientos volvían. Además, los flujos no miraban esa marca. Ahora la baja tiene su propia marca (`conversaciones.pidio_baja`, migración `202611150014_baja.sql`), que no se borra sola.

## Código

- `lib/baja.ts`: la regla, la consigna para la IA y la nota. Pruebas en `lib/baja.test.ts`.
- `lib/agente/servicio.ts` (`atender`): la mira antes del flujo y de la IA.
- `lib/agente/charla.ts` (`marcarSenal`): la señal de la IA.
- `lib/flujos/servicio.ts` (`retomarFlujos`): el cron corta los flujos de quien pidió la baja.
- `lib/datos/postgres.ts`: `pidioBaja`; `volvioAlBot` y `candidatosSeguimiento` la respetan.
- Pruebas de punta a punta: `lib/flujos/servicio.test.ts` y `lib/agente/servicio.test.ts`.
