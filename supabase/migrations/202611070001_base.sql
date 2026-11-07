-- Base del asistente comercial de Mindlin.
--
-- Cómo se aplica: Supabase → SQL Editor → New query → pegar todo este archivo → Run.
-- Se puede correr más de una vez sin romper nada (crea solo lo que falta).
--
-- Qué guarda:
-- * proyectos: la ficha de cada desarrollo. El agente solo dice lo que está acá: si un dato
--   no está, no lo inventa y ofrece que lo contacte una persona.
-- * tono y ejemplos: cómo habla Mindlin y conversaciones de ejemplo (sin datos personales).
-- * reglas_seguimiento: «si queda en tal etapa y pasan tantos días sin respuesta, mandar este
--   mensaje», con versiones para comparar cuál funciona mejor.
-- * conversaciones: lo que el bot sabe de cada conversación de Chatwoot (proyecto, contacto
--   del CRM, seguimientos). Los mensajes quedan en Chatwoot: acá no se copian.
-- * mensajes_respondidos: para no contestar dos veces el mismo mensaje si Chatwoot reintenta.
-- * registro: lo que hizo el bot, para revisarlo y medir.
--
-- Solo el servidor del asistente (service_role) lee y escribe: todas las tablas tienen RLS
-- activado y ninguna política, así que con la clave pública no se puede leer nada.

begin;

create table if not exists public.proyectos (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  nombre text not null check (length(nombre) between 1 and 120),
  activo boolean not null default true,
  palabras_clave text[] not null default '{}',
  descripcion text not null default '',
  ubicacion text not null default '',
  etapa_obra text not null default '',
  entrega text not null default '',
  tipologias text not null default '',
  precios text not null default '',
  financiacion text not null default '',
  disponibilidad text not null default '',
  amenities text not null default '',
  preguntas_frecuentes text not null default '',
  links text not null default '',
  notas_internas text not null default '',
  actualizado timestamptz not null default now(),
  actualizado_por text
);
comment on column public.proyectos.palabras_clave is 'Palabras para reconocer el proyecto en un mensaje (calle, barrio, nombre).';
comment on column public.proyectos.notas_internas is 'Para el equipo: el agente no las lee.';

create table if not exists public.tono (
  id smallint primary key default 1 check (id = 1),
  instrucciones text not null default '',
  criterios_comerciales text not null default '',
  cuando_pasar_a_persona text not null default '',
  actualizado timestamptz not null default now(),
  actualizado_por text
);

create table if not exists public.ejemplos (
  id bigint generated always as identity primary key,
  titulo text not null check (length(titulo) between 1 and 200),
  conversacion text not null check (length(conversacion) <= 20000),
  activo boolean not null default true,
  creado timestamptz not null default now()
);

create table if not exists public.reglas_seguimiento (
  id bigint generated always as identity primary key,
  etapa text not null,
  paso smallint not null default 1 check (paso between 1 and 5),
  dias_sin_respuesta integer not null check (dias_sin_respuesta between 1 and 90),
  version smallint not null default 1 check (version >= 1),
  estado text not null default 'activa' check (estado in ('activa', 'a_prueba', 'archivada')),
  proyecto text references public.proyectos(id) on delete cascade,
  mensaje text not null check (length(mensaje) between 1 and 2000),
  notas text not null default '',
  creado timestamptz not null default now(),
  editado timestamptz
);
comment on column public.reglas_seguimiento.etapa is 'Etapa del CRM del hub: Nuevo, Contactado, Interesado, Propuesta enviada.';
comment on column public.reglas_seguimiento.proyecto is 'Vacío: vale para todos los proyectos.';
comment on column public.reglas_seguimiento.mensaje is 'Variables: {{nombre}} y {{proyecto}}.';
create index if not exists reglas_seguimiento_vigentes on public.reglas_seguimiento (etapa, paso) where estado <> 'archivada';

create table if not exists public.conversaciones (
  chatwoot_id bigint primary key,
  bandeja bigint,
  telefono text,
  nombre text,
  proyecto text references public.proyectos(id) on delete set null,
  crm_contacto_id text,
  ultimo_mensaje_interesado timestamptz,
  ultimo_mensaje_bot timestamptz,
  paso_seguimiento smallint not null default 0,
  ultimo_seguimiento timestamptz,
  regla_seguimiento bigint references public.reglas_seguimiento(id) on delete set null,
  sin_seguimientos boolean not null default false,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);
create index if not exists conversaciones_telefono on public.conversaciones (telefono);
create index if not exists conversaciones_para_seguimiento on public.conversaciones (ultimo_mensaje_interesado) where not sin_seguimientos;

create table if not exists public.mensajes_respondidos (
  mensaje_id bigint primary key,
  conversacion bigint not null,
  fecha timestamptz not null default now()
);

create table if not exists public.registro (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  conversacion bigint,
  tipo text not null check (tipo in ('respuesta', 'paso_a_persona', 'la_tomo_una_persona', 'seguimiento', 'crm', 'error')),
  detalle text not null default '' check (length(detalle) <= 4000),
  datos jsonb
);
create index if not exists registro_reciente on public.registro (fecha desc);
create index if not exists registro_conversacion on public.registro (conversacion, fecha desc);

alter table public.proyectos enable row level security;
alter table public.tono enable row level security;
alter table public.ejemplos enable row level security;
alter table public.reglas_seguimiento enable row level security;
alter table public.conversaciones enable row level security;
alter table public.mensajes_respondidos enable row level security;
alter table public.registro enable row level security;

-- Lo mínimo para arrancar el piloto. Mindlin completa la ficha y el tono (ver PENDIENTES.md).
insert into public.proyectos (id, nombre, palabras_clave)
values ('lerma-439', 'Lerma 439', array['lerma', 'lerma 439'])
on conflict (id) do nothing;

insert into public.tono (id, instrucciones, criterios_comerciales, cuando_pasar_a_persona)
values (
  1,
  'Sos parte del equipo comercial de Mindlin Developers. Escribís como una persona por WhatsApp: en castellano rioplatense, con voseo, cálido y profesional, en mensajes cortos. Sin listas largas ni formato de folleto. Una pregunta por vez.',
  'Entendé qué busca la persona (ambientes, para vivir o invertir, presupuesto, forma de pago, plazo) antes de ofrecer. Si lo que pide no está, ofrecé la alternativa más cercana que sí esté en la ficha. Nunca inventes precios, disponibilidad, plazos ni condiciones: si no está en la ficha, decí que lo confirmás con el equipo.',
  'Cuando pida hablar con una persona, quiera visitar el proyecto o reservar, haga una consulta que no está en la ficha, negocie el precio, o se enoje o se queje.'
)
on conflict (id) do nothing;

commit;
