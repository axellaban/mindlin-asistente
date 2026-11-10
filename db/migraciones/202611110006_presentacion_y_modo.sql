-- Lo que faltaba para cubrir cómo trabajan hoy los bots de Kommo (docs/kommo.md):
--
-- * proyectos.presentacion: cómo presentar el proyecto la primera vez (lo que Kommo manda en
--   varios mensajes fijos). El asistente la usa como base de su primera respuesta.
-- * tono.pasar_al_responder: el modo «presenta y pasa». Si está prendido, el asistente presenta
--   el proyecto y, cuando la persona responde, pasa la conversación al equipo (como en Kommo,
--   donde sigue Tade). Apagado (por defecto), el asistente sigue la charla.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

alter table public.proyectos add column if not exists presentacion text not null default '';
comment on column public.proyectos.presentacion is 'Cómo presentar el proyecto la primera vez que se habla de él.';

alter table public.tono add column if not exists pasar_al_responder boolean not null default false;
comment on column public.tono.pasar_al_responder is 'Modo «presenta y pasa»: cuando la persona responde después de la presentación, sigue el equipo.';

commit;
