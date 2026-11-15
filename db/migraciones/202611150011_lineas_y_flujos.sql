-- Varias líneas de WhatsApp y flujos como los bots de Kommo (docs/lineas.md y docs/flujos.md).
--
-- * lineas: cada número de WhatsApp es una bandeja de Chatwoot. Una fila por línea, con para qué es
--   (leads entrantes, outreach frío o la línea del equipo), su bandeja, si el asistente responde ahí,
--   el modo «presenta y pasa», instrucciones propias y qué proyectos atiende. Vienen las cuatro que
--   pidió Mindlin (15/11). La 3 es la que ya andaba: la bandeja 1 «WhatsApp Lerma 439» de Easypanel
--   (docs/estado-paneles.md, 13/11), y hereda el modo que tenía el tono.
-- * conversaciones.linea: de qué línea es cada conversación. Las que ya había son de la línea 3.
-- * reglas_seguimiento.linea: una regla puede valer para una sola línea (vacío: para todas).
-- * flujos: la secuencia de pasos de una línea (mensajes, pausas, esperar respuesta, mover de etapa,
--   pasar al equipo…), general o para un proyecto. Uno activo por línea y proyecto.
-- * flujo_corridas: cada vez que un flujo arranca con una persona. Guarda una copia de los pasos (si
--   alguien edita el flujo, las conversaciones que ya iban siguen con el que empezaron), por dónde va
--   y hasta cuándo espera la respuesta.
-- * archivos: fotos, audios y PDF que mandan los flujos (subidos desde el hub, hasta 2,5 MB).
-- * registro: un tipo nuevo, «flujo».
-- * tono.pasar_al_responder: desde ahora se usa el de cada línea (lineas.pasar_al_responder).
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

create table if not exists public.lineas (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  orden smallint not null unique check (orden between 1 and 20),
  nombre text not null check (length(nombre) between 1 and 80),
  tipo text not null check (tipo in ('entrada', 'outreach_frio', 'equipo')),
  descripcion text not null default '' check (length(descripcion) <= 1000),
  telefono text not null default '' check (length(telefono) <= 40),
  bandeja bigint unique check (bandeja is null or bandeja > 0),
  por_defecto boolean not null default false,
  pausada boolean not null default false,
  pasar_al_responder boolean not null default false,
  instrucciones text not null default '' check (length(instrucciones) <= 8000),
  proyectos text[] not null default '{}',
  actualizado timestamptz not null default now(),
  actualizado_por text
);
comment on column public.lineas.tipo is 'entrada: leads que escriben (atiende el asistente); outreach_frio: escribe primero a contactos nuevos; equipo: facturas, bot de Telegram y outreach cálido.';
comment on column public.lineas.bandeja is 'El id de la bandeja (inbox) de Chatwoot de esta línea. Vacío: la línea todavía no está conectada.';
comment on column public.lineas.por_defecto is 'La línea de los avisos que no traen bandeja (no debería pasar con Chatwoot 4.19).';
comment on column public.lineas.proyectos is 'Qué proyectos atiende el asistente en esta línea. Vacío: todos los activos.';
comment on column public.lineas.instrucciones is 'Lo que el asistente tiene que saber de esta línea, además del tono (por ejemplo, de qué campaña vienen).';
create unique index if not exists lineas_una_por_defecto on public.lineas (por_defecto) where por_defecto;
alter table public.lineas enable row level security;

insert into public.lineas (id, orden, nombre, tipo, descripcion, bandeja, por_defecto, pasar_al_responder) values
  ('linea-1', 1, 'Outreach frío', 'outreach_frio',
   'Le escribe primero a contactos nuevos (prospección). Su panel se suma más adelante: mientras tanto, si alguien responde, atiende el equipo.', null, false, false),
  ('linea-2', 2, 'Equipo: facturas y outreach cálido', 'equipo',
   'Para el equipo: recibir facturas, recibos y presupuestos y todo lo que hoy hace el bot de Telegram, más el outreach a contactos que ya conocen a Mindlin. Se suma al final.', null, false, false),
  ('linea-3', 3, 'Leads entrantes', 'entrada',
   'Responde las consultas de los interesados que escriben (la línea que ya atiende el asistente).', 1, true,
   coalesce((select pasar_al_responder from public.tono where id = 1), false)),
  ('linea-4', 4, 'Leads entrantes 2', 'entrada',
   'Otra línea para consultas de interesados (por ejemplo, otra campaña o zona). Se configura igual que la 3.', null, false, false)
on conflict (id) do nothing;

comment on column public.tono.pasar_al_responder is 'Ya no se usa (15/11): el modo «presenta y pasa» es de cada línea (lineas.pasar_al_responder).';

alter table public.conversaciones add column if not exists linea text references public.lineas(id) on delete set null;
update public.conversaciones set linea = 'linea-3' where linea is null;
create index if not exists conversaciones_linea on public.conversaciones (linea);

alter table public.reglas_seguimiento add column if not exists linea text references public.lineas(id) on delete cascade;
comment on column public.reglas_seguimiento.linea is 'Vacío: vale para todas las líneas.';

create table if not exists public.archivos (
  id bigint generated always as identity primary key,
  nombre text not null check (length(nombre) between 1 and 200),
  tipo text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'application/pdf', 'video/mp4')),
  tamano integer not null check (tamano between 1 and 2621440),
  datos bytea not null,
  creado timestamptz not null default now(),
  creado_por text
);
alter table public.archivos enable row level security;

create table if not exists public.flujos (
  id bigint generated always as identity primary key,
  linea text not null references public.lineas(id) on delete cascade,
  nombre text not null check (length(nombre) between 1 and 120),
  proyecto text references public.proyectos(id) on delete cascade,
  activo boolean not null default false,
  pasos jsonb not null default '[]'::jsonb check (jsonb_typeof(pasos) = 'array'),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  actualizado_por text
);
comment on column public.flujos.proyecto is 'Vacío: el flujo general de la línea. Con proyecto: arranca cuando el primer mensaje lo nombra (sus palabras clave).';
comment on column public.flujos.pasos is 'La lista de pasos (lib/flujos/modelo.ts). «Esperar respuesta» lleva adentro las dos ramas.';
create unique index if not exists flujos_uno_activo on public.flujos (linea, coalesce(proyecto, '')) where activo;
alter table public.flujos enable row level security;

create table if not exists public.flujo_corridas (
  id bigint generated always as identity primary key,
  conversacion bigint not null,
  linea text references public.lineas(id) on delete set null,
  flujo bigint references public.flujos(id) on delete set null,
  nombre text not null,
  pasos jsonb not null,
  posicion text not null default '0',
  estado text not null default 'en_curso' check (estado in ('en_curso', 'esperando', 'terminado')),
  resultado text check (resultado is null or resultado in ('equipo', 'ia', 'fin', 'cancelado', 'error')),
  espera_desde timestamptz,
  vence timestamptz,
  ocupado_hasta timestamptz,
  respondio timestamptz,
  inicio timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
comment on column public.flujo_corridas.pasos is 'Copia de los pasos al arrancar: editar el flujo no cambia las conversaciones que ya iban.';
comment on column public.flujo_corridas.posicion is 'Por dónde va: «3» es el paso 3; «3.si.0», el primero de «si responde» del paso 3.';
comment on column public.flujo_corridas.ocupado_hasta is 'Mientras alguien la está corriendo (el webhook o el cron): nadie más la toma hasta esa hora.';
create unique index if not exists flujo_corridas_una_viva on public.flujo_corridas (conversacion) where estado <> 'terminado';
create index if not exists flujo_corridas_conversacion on public.flujo_corridas (conversacion, inicio desc);
create index if not exists flujo_corridas_por_vencer on public.flujo_corridas (vence) where estado = 'esperando';
create index if not exists flujo_corridas_flujo on public.flujo_corridas (flujo);
alter table public.flujo_corridas enable row level security;

alter table public.registro drop constraint if exists registro_tipo_check;
alter table public.registro add constraint registro_tipo_check
  check (tipo in ('respuesta', 'paso_a_persona', 'la_tomo_una_persona', 'volvio_al_bot', 'seguimiento', 'crm', 'etapa', 'pausa', 'flujo', 'error'));

commit;
