-- Seguimientos: lo que hace falta para mandarlos y medir cuál versión de cada mensaje funciona.
--
-- * seguimientos_enviados: cada seguimiento que salió, con su regla y su versión, y cuándo
--   respondió la persona (si respondió). Con eso el panel compara las versiones.
-- * conversaciones: ya tenía las columnas (último mensaje del interesado y del bot, paso, si no
--   lleva seguimientos). Desde ahora se completan con cada mensaje; acá se llenan con el historial
--   que ya había.
-- * Las etapas del CRM del hub cambiaron en noviembre: se actualiza la explicación de la columna.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

create table if not exists public.seguimientos_enviados (
  id bigint generated always as identity primary key,
  conversacion bigint not null,
  regla bigint references public.reglas_seguimiento(id) on delete set null,
  etapa text not null,
  paso smallint not null,
  version smallint not null,
  texto text not null check (length(texto) <= 4000),
  mensaje_id bigint,
  enviado timestamptz not null default now(),
  respondio timestamptz
);
comment on column public.seguimientos_enviados.respondio is 'Cuándo escribió la persona después de este seguimiento (vacío: no respondió).';
create index if not exists seguimientos_enviados_regla on public.seguimientos_enviados (regla);
create index if not exists seguimientos_enviados_sin_respuesta on public.seguimientos_enviados (conversacion) where respondio is null;

alter table public.seguimientos_enviados enable row level security;

comment on column public.reglas_seguimiento.etapa is 'Etapa del CRM del hub (desde noviembre 2026): Nuevo, Contacto inicial, Seguimiento, Visita / reunión, Negociación, Reserva o En pausa.';

-- Lo que ya había en el historial.
insert into public.conversaciones (chatwoot_id)
select distinct conversacion from public.mensajes
on conflict (chatwoot_id) do nothing;

update public.conversaciones c
set ultimo_mensaje_interesado = m.ultimo
from (select conversacion, max(fecha) as ultimo from public.mensajes where rol = 'interesado' group by conversacion) m
where m.conversacion = c.chatwoot_id and c.ultimo_mensaje_interesado is null;

update public.conversaciones c
set ultimo_mensaje_bot = m.ultimo
from (select conversacion, max(fecha) as ultimo from public.mensajes where rol <> 'interesado' group by conversacion) m
where m.conversacion = c.chatwoot_id and c.ultimo_mensaje_bot is null;

-- Las que ya tomó una persona no llevan seguimientos automáticos.
update public.conversaciones c
set sin_seguimientos = true
where not c.sin_seguimientos
  and (
    exists (select 1 from public.mensajes m where m.conversacion = c.chatwoot_id and m.rol = 'persona')
    or exists (select 1 from public.registro r where r.conversacion = c.chatwoot_id and r.tipo in ('paso_a_persona', 'la_tomo_una_persona'))
  );

commit;
