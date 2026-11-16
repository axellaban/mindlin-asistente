-- Outreach frío en la línea 1 (docs/outreach.md, 16/11): la base de leads viejos que carga Mindlin,
-- la cola, lo que pasó con cada envío y los cuidados de la línea.
--
-- * outreach_lotes: cada carga de la base (pegada desde una planilla o un CSV).
-- * outreach_contactos: una fila por persona y línea. El teléfono va normalizado (549…); si no se
--   pudo leer con seguridad queda en null y la etapa en «por_revisar» (no entra a la cola).
-- * outreach_eventos: lo que pasó; solo se agrega. Sin datos personales (el contacto va por id).
--   `clave` evita contar dos veces el mismo envío (un reintento o un doble toque).
-- * outreach_config: los cuidados, la secuencia y los textos de cada línea (jsonb, lo valida
--   lib/outreach/reglas.ts).
-- * outreach_estado: lo que cambia con cada envío: desde cuándo puede salir el siguiente, el freno,
--   «Mandar igual» del día y el tope vigente (sube de a poco).
-- * bajas: los teléfonos que pidieron que no les escriban más. Vale para todas las líneas.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

create table if not exists public.outreach_lotes (
  id bigserial primary key,
  linea text not null references public.lineas(id) on delete cascade,
  nombre text not null check (length(nombre) between 1 and 80),
  creado timestamptz not null default now(),
  creado_por text,
  pausado boolean not null default false,
  incluye_descartados boolean not null default false
);

create table if not exists public.outreach_contactos (
  id bigserial primary key,
  lote bigint not null references public.outreach_lotes(id) on delete cascade,
  linea text not null references public.lineas(id) on delete cascade,
  nombre text not null default '' check (length(nombre) <= 120),
  telefono text check (telefono is null or telefono ~ '^[0-9]{8,15}$'),
  telefono_original text not null default '' check (length(telefono_original) <= 60),
  proyecto text references public.proyectos(id) on delete set null,
  proyecto_texto text not null default '' check (length(proyecto_texto) <= 120),
  fecha_consulta date,
  origen text not null default '' check (length(origen) <= 120),
  notas text not null default '' check (length(notas) <= 2000),
  etapa text not null default 'por_contactar'
    check (etapa in ('por_revisar', 'por_contactar', 'saludado', 'respondio', 'interesado', 'cerrado', 'invalido', 'baja', 'excluido')),
  motivo text not null default '' check (length(motivo) <= 300),
  mensajes smallint not null default 0 check (mensajes between 0 and 3),
  proxima_accion timestamptz,
  tiene_whatsapp boolean,
  tomado_por text,
  tomado_hasta timestamptz,
  toma_clave text,
  ultimo_envio timestamptz,
  respondio timestamptz,
  crm_contacto_id text,
  conversacion bigint,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create unique index if not exists outreach_contactos_telefono on public.outreach_contactos (linea, telefono) where telefono is not null;
create index if not exists outreach_contactos_cola on public.outreach_contactos (linea, etapa, proxima_accion);
create index if not exists outreach_contactos_lote on public.outreach_contactos (lote);

create table if not exists public.outreach_eventos (
  id bigserial primary key,
  linea text not null references public.lineas(id) on delete cascade,
  contacto bigint references public.outreach_contactos(id) on delete set null,
  lote bigint,
  tipo text not null check (tipo in ('envio', 'no_salio', 'sin_whatsapp', 'numero_incorrecto', 'respuesta', 'baja', 'verificacion', 'freno', 'reanudar', 'forzar', 'saltar', 'tope')),
  paso smallint,
  version smallint,
  modo text check (modo is null or modo in ('waha', 'computer_use', 'a_mano')),
  ejecutor text check (ejecutor is null or ejecutor in ('persona', 'bot')),
  por text,
  clave text unique,
  detalle text not null default '' check (length(detalle) <= 500),
  creado timestamptz not null default now()
);
create index if not exists outreach_eventos_linea on public.outreach_eventos (linea, tipo, creado desc);
create index if not exists outreach_eventos_contacto on public.outreach_eventos (contacto);

create table if not exists public.outreach_config (
  linea text primary key references public.lineas(id) on delete cascade,
  config jsonb not null,
  actualizado timestamptz not null default now(),
  actualizado_por text
);

create table if not exists public.outreach_estado (
  linea text primary key references public.lineas(id) on delete cascade,
  siguiente_desde timestamptz,
  fallas_seguidas smallint not null default 0,
  frenado text,
  frenado_desde timestamptz,
  forzar_dia date,
  tope smallint,
  tope_desde date
);

create table if not exists public.bajas (
  telefono text primary key check (telefono ~ '^[0-9]{8,15}$'),
  cuando timestamptz not null default now(),
  linea text,
  origen text not null default ''
);

alter table public.outreach_lotes enable row level security;
alter table public.outreach_contactos enable row level security;
alter table public.outreach_eventos enable row level security;
alter table public.outreach_config enable row level security;
alter table public.outreach_estado enable row level security;
alter table public.bajas enable row level security;

commit;
