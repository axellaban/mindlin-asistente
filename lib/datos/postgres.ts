import pg from "pg";
import type { MensajeHistorial } from "../chatwoot/evento";
import type { Almacen, CandidatoSeguimiento, Conversacion, Ejemplo, Proyecto, ReglaSeguimiento, Tono } from "./tipos";

/**
 * La base del asistente: Postgres en Neon, creado desde Vercel (que carga DATABASE_URL solo).
 * Las tablas están en db/migraciones/ y se aplican en cada publicación (scripts/migrar.mjs).
 */
export function almacenPostgres(env: Record<string, string | undefined> = process.env): Almacen | null {
  const url = env.DATABASE_URL || env.POSTGRES_URL;
  if (!url) return null;
  return crearAlmacen(pool(url));
}

// Un pool por proceso: en Vercel, las invocaciones de una misma instancia lo reutilizan.
const pools = new Map<string, pg.Pool>();
function pool(url: string): pg.Pool {
  let p = pools.get(url);
  if (!p) {
    p = new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000 });
    pools.set(url, p);
  }
  return p;
}

const COLUMNAS_PROYECTO =
  "id, nombre, palabras_clave, descripcion, ubicacion, etapa_obra, entrega, tipologias, precios, financiacion, disponibilidad, amenities, preguntas_frecuentes, links";

interface FilaMensaje {
  id: string;
  conversacion: string;
  rol: MensajeHistorial["rol"];
  texto: string;
  fecha: Date;
}

/** Los ids de Chatwoot son bigint: pg los devuelve como texto, acá vuelven a número. */
const mensajeDeFila = (f: FilaMensaje): MensajeHistorial => ({
  id: Number(f.id),
  conversacion: Number(f.conversacion),
  rol: f.rol,
  texto: f.texto,
  fecha: new Date(f.fecha).toISOString(),
});

const CAMPOS_CONVERSACION = ["proyecto", "crm_contacto_id", "telefono", "nombre"] as const;

export function crearAlmacen(db: Pick<pg.Pool, "query">): Almacen {
  return {
    async guardarMensaje(m) {
      await db.query("insert into mensajes (id, conversacion, rol, texto, fecha) values ($1, $2, $3, $4, $5) on conflict (id) do nothing", [
        m.id,
        m.conversacion,
        m.rol,
        m.texto.slice(0, 8000),
        m.fecha,
      ]);
    },
    async historial(conversacion, limite) {
      const { rows } = await db.query<FilaMensaje>(
        "select * from (select id, conversacion, rol, texto, fecha from mensajes where conversacion = $1 order by fecha desc, id desc limit $2) m order by fecha, id",
        [conversacion, limite],
      );
      return rows.map(mensajeDeFila);
    },
    async reclamarMensaje(mensaje, conversacion) {
      const { rowCount } = await db.query("insert into mensajes_respondidos (mensaje_id, conversacion) values ($1, $2) on conflict do nothing", [mensaje, conversacion]);
      return rowCount === 1;
    },
    async conversacion(id) {
      const { rows } = await db.query("select chatwoot_id, proyecto, crm_contacto_id, telefono, nombre from conversaciones where chatwoot_id = $1", [id]);
      return rows[0] ? ({ ...rows[0], chatwoot_id: Number(rows[0].chatwoot_id) } as Conversacion) : null;
    },
    async guardarConversacion(c) {
      // Solo se actualizan los campos que vienen: lo demás queda como estaba.
      const campos = CAMPOS_CONVERSACION.filter((k) => k in c);
      const columnas = ["chatwoot_id", ...campos].join(", ");
      const marcadores = ["$1", ...campos.map((_, i) => `$${i + 2}`)].join(", ");
      const cambios = [...campos.map((k) => `${k} = excluded.${k}`), "actualizada = now()"].join(", ");
      await db.query(`insert into conversaciones (${columnas}) values (${marcadores}) on conflict (chatwoot_id) do update set ${cambios}`, [
        c.chatwoot_id,
        ...campos.map((k) => c[k] ?? null),
      ]);
    },
    async proyectosActivos() {
      const { rows } = await db.query(`select ${COLUMNAS_PROYECTO} from proyectos where activo order by nombre`);
      return rows as Proyecto[];
    },
    async tono() {
      const { rows } = await db.query("select instrucciones, criterios_comerciales, cuando_pasar_a_persona from tono where id = 1");
      return (rows[0] as Tono | undefined) ?? { instrucciones: "", criterios_comerciales: "", cuando_pasar_a_persona: "" };
    },
    async ejemplos() {
      const { rows } = await db.query("select titulo, conversacion from ejemplos where activo order by id");
      return rows as Ejemplo[];
    },
    async permitirSeguimientos(conversacion, permitido) {
      await db.query(
        "insert into conversaciones (chatwoot_id, sin_seguimientos) values ($1, $2) on conflict (chatwoot_id) do update set sin_seguimientos = excluded.sin_seguimientos, actualizada = now() where conversaciones.sin_seguimientos is distinct from excluded.sin_seguimientos",
        [conversacion, !permitido],
      );
    },
    async reglasSeguimiento() {
      const { rows } = await db.query(
        "select id, etapa, paso, dias_sin_respuesta, version, estado, proyecto, mensaje from reglas_seguimiento where estado <> 'archivada' order by etapa, paso, id",
      );
      return rows.map((r) => ({ ...r, id: Number(r.id) }) as ReglaSeguimiento);
    },
    async candidatosSeguimiento(hasta) {
      // Mira los últimos 90 días: más atrás no tiene sentido escribirle a nadie.
      const { rows } = await db.query(
        `with ult as (
           select conversacion,
             max(fecha) as ultimo,
             max(fecha) filter (where rol = 'interesado') as ultimo_interesado,
             (array_agg(rol order by fecha desc, id desc))[1] as ultimo_rol,
             bool_or(rol = 'persona') as hubo_persona
           from mensajes
           where fecha > now() - interval '90 days'
           group by conversacion
         )
         select c.chatwoot_id, c.nombre, c.telefono, c.proyecto, u.ultimo,
           case when c.ultimo_seguimiento is null or u.ultimo_interesado > c.ultimo_seguimiento then 0 else c.paso_seguimiento end as paso
         from conversaciones c
         join ult u on u.conversacion = c.chatwoot_id
         where not c.sin_seguimientos
           and u.ultimo_rol = 'bot'
           and not u.hubo_persona
           and u.ultimo_interesado is not null
           and u.ultimo <= $1
         order by u.ultimo`,
        [hasta.toISOString()],
      );
      return rows.map(
        (r): CandidatoSeguimiento => ({
          chatwoot_id: Number(r.chatwoot_id),
          nombre: r.nombre,
          telefono: r.telefono,
          proyecto: r.proyecto,
          paso: Number(r.paso),
          ultimo_mensaje: new Date(r.ultimo).toISOString(),
        }),
      );
    },
    async anotarSeguimiento(conversacion, paso, regla, fecha) {
      await db.query(
        "update conversaciones set paso_seguimiento = $2, regla_seguimiento = $3, ultimo_seguimiento = $4, actualizada = now() where chatwoot_id = $1",
        [conversacion, paso, regla, fecha],
      );
    },
    async registrar(r) {
      await db.query("insert into registro (tipo, conversacion, detalle, datos) values ($1, $2, $3, $4)", [
        r.tipo,
        r.conversacion,
        r.detalle.slice(0, 4000),
        r.datos === undefined ? null : JSON.stringify(r.datos),
      ]);
    },
  };
}
