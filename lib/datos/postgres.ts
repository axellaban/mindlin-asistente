import pg from "pg";
import type { MensajeHistorial } from "../chatwoot/evento";
import type { Almacen, Conversacion, Ejemplo, Proyecto, Tono } from "./tipos";

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
