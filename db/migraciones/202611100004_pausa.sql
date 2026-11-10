-- Pausar el asistente entero y volver a darle una conversación.
--
-- * asistente_estado: una sola fila. Si está pausado, cada conversación nueva pasa al equipo con
--   una nota y no salen seguimientos. Se cambia desde el panel.
-- * registro: dos tipos nuevos, «volvio_al_bot» (el equipo le devolvió la conversación) y «pausa»
--   (alguien pausó o reactivó el asistente).
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

create table if not exists public.asistente_estado (
  id smallint primary key default 1 check (id = 1),
  pausado boolean not null default false,
  cambiado timestamptz,
  cambiado_por text
);
insert into public.asistente_estado (id) values (1) on conflict (id) do nothing;
alter table public.asistente_estado enable row level security;

alter table public.registro drop constraint if exists registro_tipo_check;
alter table public.registro add constraint registro_tipo_check
  check (tipo in ('respuesta', 'paso_a_persona', 'la_tomo_una_persona', 'volvio_al_bot', 'seguimiento', 'crm', 'pausa', 'error'));

commit;
