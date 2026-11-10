-- Lo que el asistente ya anotó de cada persona (nombre, para qué busca, ambientes, presupuesto,
-- forma de pago, plazo y el último resumen). Con esto:
-- * en cada mensaje lo tiene a mano aunque la charla sea larga y no vuelve a preguntarlo;
-- * no repite en el CRM lo que ya estaba anotado.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

alter table public.conversaciones add column if not exists interesado jsonb not null default '{}'::jsonb;
comment on column public.conversaciones.interesado is 'Lo que el asistente ya anotó de la persona (lo mismo que manda al CRM).';

commit;
