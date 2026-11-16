-- El puntaje de cada persona de las bases de outreach (lib/outreach/puntaje.ts, docs/outreach.md).
--
-- * outreach_contactos.puntaje (0 a 100) y puntaje_detalle (qué sumó cada variable): la cola sale
--   por puntaje, salvo una parte al azar para medir.
-- * outreach_contactos.crm_etapa: hasta dónde había llegado en el CRM cuando se cargó la base.
-- * outreach_contactos.toma_azar y outreach_eventos.al_azar: si salió por el puntaje o al azar.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

alter table public.outreach_contactos add column if not exists puntaje smallint not null default 0 check (puntaje between 0 and 100);
alter table public.outreach_contactos add column if not exists puntaje_detalle jsonb not null default '[]'::jsonb;
alter table public.outreach_contactos add column if not exists crm_etapa text;
alter table public.outreach_contactos add column if not exists toma_azar boolean not null default false;
alter table public.outreach_eventos add column if not exists al_azar boolean;
create index if not exists outreach_contactos_puntaje on public.outreach_contactos (linea, puntaje desc);

commit;
