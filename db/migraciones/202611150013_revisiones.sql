-- Revisar respuestas reales del asistente (mejora 7 de Axel, 15/11; docs/revisar.md).
--
-- * revisiones: una por respuesta del asistente que alguien revisó en el hub. «buena» (y, si se
--   guardó como ejemplo, cuál) o «mala», con la nota de qué corregir en el tono o en la ficha.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

create table if not exists public.revisiones (
  mensaje bigint primary key,
  conversacion bigint not null,
  veredicto text not null check (veredicto in ('buena', 'mala')),
  nota text not null default '' check (length(nota) <= 2000),
  ejemplo bigint references public.ejemplos(id) on delete set null,
  creado timestamptz not null default now(),
  creado_por text
);
comment on column public.revisiones.mensaje is 'El mensaje del asistente que se revisó (mensajes.id).';
comment on column public.revisiones.nota is 'En las malas: qué corregir (en el tono, en la ficha…).';
create index if not exists revisiones_creado on public.revisiones (creado desc);
alter table public.revisiones enable row level security;

commit;
