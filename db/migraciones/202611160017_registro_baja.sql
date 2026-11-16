-- Arreglo (16/11): el registro no aceptaba el tipo «pidio_baja» (docs/baja.md, del 15/11).
--
-- La migración de la baja agregó la marca en conversaciones, pero no el tipo al control de
-- registro.tipo: cuando alguien pedía que no le escriban más, la baja quedaba guardada pero el
-- asistente fallaba al anotarla y no le contestaba. Lo encontró la prueba del outreach.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

alter table public.registro drop constraint if exists registro_tipo_check;
alter table public.registro add constraint registro_tipo_check
  check (tipo in ('respuesta', 'paso_a_persona', 'la_tomo_una_persona', 'volvio_al_bot', 'seguimiento', 'crm', 'etapa', 'pausa', 'flujo', 'pidio_baja', 'error'));

commit;
