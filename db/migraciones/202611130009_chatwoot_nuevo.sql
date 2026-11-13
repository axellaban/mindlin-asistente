-- Chatwoot nuevo (reinstalado sobre Easypanel, 13/11/2026; ver docs/easypanel.md).
--
-- El asistente guarda conversaciones y mensajes con el número que les da Chatwoot. Un Chatwoot
-- nuevo vuelve a numerar desde 1: si quedaran las pruebas del Chatwoot anterior, un mensaje nuevo
-- con el número de uno viejo se tomaría como «ya respondido» y no se contestaría, y se mezclarían
-- historiales y datos anotados. Hasta acá solo hubo pruebas (Axel, 13/11), así que se borran.
--
-- No se toca la configuración: fichas, tono, ejemplos, reglas de seguimiento, etapas automáticas
-- ni la pausa. Del registro se borra solo lo que es de una conversación (las pausas quedan).
-- Las filas que esas pruebas crearon en la planilla del CRM no se tocan desde acá.
begin;

delete from public.seguimientos_enviados;
delete from public.mensajes_respondidos;
delete from public.mensajes;
delete from public.registro where conversacion is not null;
delete from public.conversaciones;

commit;
