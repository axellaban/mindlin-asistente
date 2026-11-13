import pg from "pg";
import { limiteCandidatos, MAX_PASOS } from "../seguimientos/reglas";
import { HORARIO_EQUIPO_DE_FABRICA, horarioValido } from "../agente/horario";
import type { MensajeHistorial } from "../chatwoot/evento";
import type { ReglasEtapa } from "../etapas/reglas";
import type { Almacen, CandidatoSeguimiento, Conversacion, Ejemplo, Proyecto, ReglaSeguimiento, Tono } from "./tipos";

/**
 * La base del asistente: Postgres en Neon, creado desde Vercel (que carga DATABASE_URL solo).
 * Las tablas están en db/migraciones/ y se aplican en cada publicación (scripts/migrar.mjs).
 */
export function almacenPostgres(env: Record<string, string | undefined> = process.env): Almacen | null {
  const db = poolDesdeEnv(env);
  return db ? crearAlmacen(db) : null;
}

/** La conexión a la base (la usa también el panel), o null si falta DATABASE_URL. */
export function poolDesdeEnv(env: Record<string, string | undefined> = process.env): pg.Pool | null {
  const url = env.DATABASE_URL || env.POSTGRES_URL;
  return url ? pool(url) : null;
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
  "id, nombre, palabras_clave, presentacion, descripcion, ubicacion, etapa_obra, entrega, tipologias, precios, financiacion, disponibilidad, amenities, preguntas_frecuentes, links";

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

const CAMPOS_CONVERSACION = ["proyecto", "crm_contacto_id", "telefono", "nombre", "interesado"] as const;

export function crearAlmacen(db: Pick<pg.Pool, "query">): Almacen {
  return {
    async guardarMensaje(m) {
      const { rowCount } = await db.query("insert into mensajes (id, conversacion, rol, texto, fecha) values ($1, $2, $3, $4, $5) on conflict (id) do nothing", [
        m.id,
        m.conversacion,
        m.rol,
        m.texto.slice(0, 8000),
        m.fecha,
      ]);
      if (rowCount !== 1) return;
      // Para los seguimientos: cuándo escribió cada uno. Si escribe el interesado, los seguimientos
      // vuelven a empezar; si escribe una persona del equipo, se terminan.
      const interesado = m.rol === "interesado";
      await db.query(
        `insert into conversaciones (chatwoot_id, ultimo_mensaje_interesado, ultimo_mensaje_bot, sin_seguimientos)
         values ($1, $2, $3, $4)
         on conflict (chatwoot_id) do update set
           ultimo_mensaje_interesado = greatest(conversaciones.ultimo_mensaje_interesado, excluded.ultimo_mensaje_interesado),
           ultimo_mensaje_bot = greatest(conversaciones.ultimo_mensaje_bot, excluded.ultimo_mensaje_bot),
           paso_seguimiento = case when $5 then 0 else conversaciones.paso_seguimiento end,
           sin_seguimientos = conversaciones.sin_seguimientos or excluded.sin_seguimientos,
           actualizada = now()`,
        [m.conversacion, interesado ? m.fecha : null, interesado ? null : m.fecha, m.rol === "persona", interesado],
      );
      if (interesado) {
        await db.query("update seguimientos_enviados set respondio = $2 where conversacion = $1 and respondio is null and enviado <= $2", [m.conversacion, m.fecha]);
      }
    },
    async actualizarTextoMensaje(id, texto) {
      await db.query("update mensajes set texto = $2 where id = $1", [id, texto.slice(0, 8000)]);
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
      const { rows } = await db.query("select chatwoot_id, proyecto, crm_contacto_id, telefono, nombre, interesado, ultimo_seguimiento from conversaciones where chatwoot_id = $1", [id]);
      const r = rows[0];
      return r ? ({ ...r, chatwoot_id: Number(r.chatwoot_id), ultimo_seguimiento: r.ultimo_seguimiento ? new Date(r.ultimo_seguimiento).toISOString() : null } as Conversacion) : null;
    },
    async guardarConversacion(c) {
      // Solo se actualizan los campos que vienen: lo demás queda como estaba.
      const campos = CAMPOS_CONVERSACION.filter((k) => k in c);
      const columnas = ["chatwoot_id", ...campos].join(", ");
      const marcadores = ["$1", ...campos.map((_, i) => `$${i + 2}`)].join(", ");
      const cambios = [...campos.map((k) => `${k} = excluded.${k}`), "actualizada = now()"].join(", ");
      await db.query(`insert into conversaciones (${columnas}) values (${marcadores}) on conflict (chatwoot_id) do update set ${cambios}`, [
        c.chatwoot_id,
        // interesado es jsonb: va como texto JSON.
        ...campos.map((k) => (k === "interesado" ? JSON.stringify(c.interesado ?? {}) : (c[k] ?? null))),
      ]);
    },
    async proyectosActivos() {
      const { rows } = await db.query(`select ${COLUMNAS_PROYECTO} from proyectos where activo order by nombre`);
      return rows as Proyecto[];
    },
    async tono() {
      const { rows } = await db.query("select instrucciones, criterios_comerciales, cuando_pasar_a_persona, pasar_al_responder, sobre_la_empresa, objeciones, horario_equipo from tono where id = 1");
      const t = rows[0] as (Tono & { horario_equipo: unknown }) | undefined;
      if (!t) return { instrucciones: "", criterios_comerciales: "", cuando_pasar_a_persona: "", pasar_al_responder: false, sobre_la_empresa: "", objeciones: "", horario_equipo: HORARIO_EQUIPO_DE_FABRICA };
      return { ...t, horario_equipo: horarioValido(t.horario_equipo) ?? HORARIO_EQUIPO_DE_FABRICA };
    },
    async ejemplos() {
      const { rows } = await db.query("select titulo, conversacion from ejemplos where activo order by id");
      return rows as Ejemplo[];
    },
    async sinSeguimientos(conversacion) {
      await db.query(
        "insert into conversaciones (chatwoot_id, sin_seguimientos) values ($1, true) on conflict (chatwoot_id) do update set sin_seguimientos = true, actualizada = now()",
        [conversacion],
      );
    },
    async volvioAlBot(conversacion) {
      const { rowCount } = await db.query("update conversaciones set sin_seguimientos = false, paso_seguimiento = 0, actualizada = now() where chatwoot_id = $1 and sin_seguimientos", [
        conversacion,
      ]);
      return rowCount === 1;
    },
    async pausado() {
      const { rows } = await db.query("select pausado from asistente_estado where id = 1");
      return rows[0]?.pausado === true;
    },
    async candidatosSeguimiento(ahora) {
      const { rows } = await db.query(
        `select chatwoot_id, nombre, interesado->>'nombre' as nombre_anotado, telefono, proyecto, crm_contacto_id, paso_seguimiento, ultima_salida
         from (
           select *, greatest(ultimo_mensaje_bot, ultimo_seguimiento) as ultima_salida from conversaciones
           where not sin_seguimientos and ultimo_mensaje_interesado is not null and paso_seguimiento <= $1
         ) c
         where ultima_salida > ultimo_mensaje_interesado
           and ultima_salida < $3::timestamptz
           and ultima_salida > $2::timestamptz - interval '120 days'
         order by ultima_salida
         limit 500`,
        [MAX_PASOS, ahora, limiteCandidatos(new Date(ahora))],
      );
      return rows.map((r) => ({
        ...r,
        chatwoot_id: Number(r.chatwoot_id),
        paso_seguimiento: Number(r.paso_seguimiento),
        ultima_salida: new Date(r.ultima_salida).toISOString(),
      })) as CandidatoSeguimiento[];
    },
    async reglasEtapa() {
      const { rows } = await db.query("select evento, etapa from reglas_etapa");
      return Object.fromEntries(rows.map((r) => [r.evento, r.etapa])) as ReglasEtapa;
    },
    async reglasVigentes() {
      const { rows } = await db.query(
        "select id, etapa, paso, dias_sin_respuesta, version, estado, proyecto, mensaje from reglas_seguimiento where estado <> 'archivada' order by etapa, paso, version, id",
      );
      return rows.map((r) => ({ ...r, id: Number(r.id) })) as ReglaSeguimiento[];
    },
    async reclamarSeguimiento({ conversacion, pasoAnterior, regla, ahora }) {
      const { rowCount } = await db.query(
        `update conversaciones set paso_seguimiento = paso_seguimiento + 1, ultimo_seguimiento = $3, regla_seguimiento = $4, actualizada = now()
         where chatwoot_id = $1 and paso_seguimiento = $2 and not sin_seguimientos`,
        [conversacion, pasoAnterior, ahora, regla],
      );
      return rowCount === 1;
    },
    async anotarSeguimiento(x) {
      await db.query(
        "insert into seguimientos_enviados (conversacion, regla, etapa, paso, version, texto, mensaje_id, enviado) values ($1, $2, $3, $4, $5, $6, $7, $8)",
        [x.conversacion, x.regla, x.etapa, x.paso, x.version, x.texto.slice(0, 4000), x.mensaje_id, x.enviado],
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
