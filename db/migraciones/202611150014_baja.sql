-- «No me escriban más» (docs/baja.md, idea traída de DeskcommCRM, 15/11).
--
-- * conversaciones.pidio_baja: cuándo la persona pidió que no le escriban (o dijo que no le
--   interesa). Frena los seguimientos y los flujos automáticos de esa conversación. A diferencia
--   de sin_seguimientos, no se borra cuando la persona vuelve a escribir ni cuando el equipo le
--   devuelve la conversación al asistente.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

alter table public.conversaciones add column if not exists pidio_baja timestamptz;

commit;
