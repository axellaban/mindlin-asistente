-- Historial de mensajes de cada conversación que atiende el asistente.
--
-- El token del Agent Bot de Chatwoot no puede leer el historial por la API, así que el asistente
-- guarda cada mensaje que le avisa Chatwoot (del interesado, del bot y de las personas del equipo)
-- y con eso le da contexto a Claude. Se guarda solo el texto: los audios y las fotos quedan como
-- [audio] o [foto].
--
-- Cómo se aplica: igual que la anterior (SQL Editor → pegar → Run). Idempotente.

begin;

create table if not exists public.mensajes (
  id bigint primary key,
  conversacion bigint not null,
  rol text not null check (rol in ('interesado', 'bot', 'persona')),
  texto text not null check (length(texto) <= 8000),
  fecha timestamptz not null
);
comment on column public.mensajes.id is 'El id del mensaje en Chatwoot.';
create index if not exists mensajes_conversacion on public.mensajes (conversacion, fecha desc);

alter table public.mensajes enable row level security;

commit;
