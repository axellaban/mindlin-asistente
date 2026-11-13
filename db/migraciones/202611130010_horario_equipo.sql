-- El horario del equipo comercial, configurable desde el hub y el panel (antes estaba fijo en el
-- código, lib/agente/contexto.ts). Fuera de ese horario el asistente sigue atendiendo; si pasa la
-- conversación a una persona, avisa que le escriben apenas vuelvan.
--
-- Días: 0 es domingo, 1 lunes … 6 sábado. Horas de Buenos Aires: desde (incluida) hasta (sin incluir).
-- Queda como estaba: de lunes a viernes de 9 a 20.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

alter table public.tono add column if not exists horario_equipo jsonb not null default '{"dias": [1, 2, 3, 4, 5], "desde": 9, "hasta": 20}'::jsonb;
comment on column public.tono.horario_equipo is 'Cuándo trabaja el equipo comercial: {"dias": [1..5], "desde": 9, "hasta": 20} (0 es domingo; hora de Buenos Aires).';

commit;
