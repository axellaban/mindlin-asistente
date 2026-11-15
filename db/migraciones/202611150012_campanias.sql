-- De qué campaña viene cada lead (mejora 2 de Axel, 15/11; docs/campanias.md).
--
-- * campanias: las campañas que Mindlin quiere distinguir, con las frases que las reconocen en el
--   primer mensaje (el texto que arma el anuncio de Meta, u otras palabras). Una campaña puede ser
--   de una sola línea o de todas (linea vacía).
-- * lineas.campania: la campaña de la línea, para cuando el primer mensaje no coincide con ninguna
--   frase (por ejemplo, «la línea 4 es la de la campaña de Mar del Plata»).
-- * conversaciones.campania: la campaña que se le asignó a esa conversación con su primer mensaje,
--   y por qué (`frase` o `linea`). No cambia después.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

create table if not exists public.campanias (
  id bigint generated always as identity primary key,
  nombre text not null check (length(nombre) between 1 and 30),
  linea text references public.lineas(id) on delete cascade,
  frases text[] not null default '{}',
  activa boolean not null default true,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  actualizado_por text
);
comment on column public.campanias.linea is 'Vacío: vale para todas las líneas.';
comment on column public.campanias.frases is 'Si el primer mensaje contiene una de estas frases (sin importar mayúsculas ni acentos), viene de esta campaña.';
alter table public.campanias enable row level security;

alter table public.lineas add column if not exists campania text not null default '' check (length(campania) <= 30);
comment on column public.lineas.campania is 'La campaña de la línea, si el primer mensaje no coincide con ninguna frase. Vacío: ninguna.';

alter table public.conversaciones add column if not exists campania text;
alter table public.conversaciones add column if not exists campania_por text check (campania_por is null or campania_por in ('frase', 'linea'));
create index if not exists conversaciones_campania on public.conversaciones (campania) where campania is not null;

commit;
