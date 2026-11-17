import { telefonoParaComparar } from "../outreach/telefono";
import pg from "pg";
import { limiteCandidatos, MARGEN_MS, MAX_PASOS } from "../seguimientos/reglas";
import { esTipoLinea, type Linea } from "../lineas";
import { HORARIO_EQUIPO_DE_FABRICA, horarioValido } from "../agente/horario";
import type { MensajeHistorial } from "../chatwoot/evento";
import type { ReglasEtapa } from "../etapas/reglas";
import { TIPOS_DEL_EQUIPO, type Almacen, type CandidatoSeguimiento, type Conversacion, type Corrida, type Ejemplo, type Proyecto, type ReglaSeguimiento, type Tono } from "./tipos";

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

const CAMPOS_CONVERSACION = ["proyecto", "crm_contacto_id", "telefono", "nombre", "interesado", "linea", "bandeja", "campania", "campania_por"] as const;

const iso = (f: Date | string | null | undefined) => (f ? new Date(f).toISOString() : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = Record<string, any>;

/** Una fila de lineas como la usa el asistente. */
export const lineaDeFila = (r: Fila): Linea => ({
  id: r.id,
  orden: Number(r.orden),
  nombre: r.nombre,
  tipo: esTipoLinea(r.tipo) ? r.tipo : "entrada",
  descripcion: r.descripcion ?? "",
  telefono: r.telefono ?? "",
  bandeja: r.bandeja == null ? null : Number(r.bandeja),
  por_defecto: r.por_defecto === true,
  pausada: r.pausada === true,
  pasar_al_responder: r.pasar_al_responder === true,
  instrucciones: r.instrucciones ?? "",
  proyectos: r.proyectos ?? [],
  campania: r.campania ?? "",
});

export const COLUMNAS_LINEA = "id, orden, nombre, tipo, descripcion, telefono, bandeja, por_defecto, pausada, pasar_al_responder, instrucciones, proyectos, campania";

export const corridaDeFila = (r: Fila): Corrida => ({
  id: Number(r.id),
  conversacion: Number(r.conversacion),
  linea: r.linea ?? null,
  flujo: r.flujo == null ? null : Number(r.flujo),
  nombre: r.nombre,
  pasos: r.pasos ?? [],
  posicion: r.posicion,
  estado: r.estado,
  resultado: r.resultado ?? null,
  espera_desde: iso(r.espera_desde),
  vence: iso(r.vence),
  inicio: iso(r.inicio)!,
});

/** Mientras una corrida está en marcha, nadie más la toma. Más que lo que dura una función de Vercel (300 s). */
export const OCUPADA_MS = 6 * 60_000;
export const COLUMNAS_CORRIDA = "id, conversacion, linea, flujo, nombre, pasos, posicion, estado, resultado, espera_desde, vence, inicio";

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
      const { rows } = await db.query("select chatwoot_id, proyecto, crm_contacto_id, telefono, nombre, interesado, ultimo_seguimiento, linea, bandeja, campania, campania_por, pidio_baja from conversaciones where chatwoot_id = $1", [id]);
      const r = rows[0];
      return r
        ? ({ ...r, chatwoot_id: Number(r.chatwoot_id), bandeja: r.bandeja == null ? null : Number(r.bandeja), ultimo_seguimiento: r.ultimo_seguimiento ? new Date(r.ultimo_seguimiento).toISOString() : null, pidio_baja: r.pidio_baja ? new Date(r.pidio_baja).toISOString() : null } as Conversacion)
        : null;
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
      // Un teléfono que ya pidió la baja (en otra línea u otra conversación): esta tampoco lleva nada automático.
      if (c.telefono) await marcarBajaPorTelefono(db, { chatwoot_id: c.chatwoot_id });
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
    async pidioBaja(conversacion, ahora) {
      const { rowCount } = await db.query(
        `insert into conversaciones (chatwoot_id, sin_seguimientos, pidio_baja) values ($1, true, $2::timestamptz)
         on conflict (chatwoot_id) do update set sin_seguimientos = true, pidio_baja = $2::timestamptz, actualizada = now()
         where conversaciones.pidio_baja is null`,
        [conversacion, ahora],
      );
      // La baja vale también por teléfono, para todas las líneas (el outreach no le escribe más; docs/outreach.md).
      const { rows } = await db.query("select telefono, linea from conversaciones where chatwoot_id = $1", [conversacion]);
      const telefono = telefonoParaComparar(rows[0]?.telefono);
      if (telefono) {
        await db.query("insert into bajas (telefono, linea, origen) values ($1, $2, 'pidió por WhatsApp') on conflict (telefono) do nothing", [telefono, rows[0]?.linea ?? null]);
        // Y las otras conversaciones de ese teléfono (otras líneas, chats viejos): nada automático tampoco.
        await marcarBajaPorTelefono(db, { telefono });
        await db.query("update outreach_contactos set etapa = 'baja', motivo = 'pidió que no le escriban más', proxima_accion = null, actualizado = now() where telefono = $1 and etapa <> 'baja'", [telefono]);
      }
      return rowCount === 1;
    },
    async volvioAlBot(conversacion) {
      const { rowCount } = await db.query(
        "update conversaciones set sin_seguimientos = false, paso_seguimiento = 0, actualizada = now() where chatwoot_id = $1 and sin_seguimientos and pidio_baja is null",
        [conversacion],
      );
      return rowCount === 1;
    },
    async laDevolvioElEquipo(conversacion) {
      const { rows } = await db.query(
        "select tipo from registro where conversacion = $1 and tipo = any($2::text[]) order by fecha desc, id desc limit 1",
        [conversacion, TIPOS_DEL_EQUIPO],
      );
      return rows[0]?.tipo === "volvio_al_bot";
    },
    async pausado() {
      const { rows } = await db.query("select pausado from asistente_estado where id = 1");
      return rows[0]?.pausado === true;
    },
    async candidatosSeguimiento(ahora) {
      const { rows } = await db.query(
        `select chatwoot_id, nombre, interesado->>'nombre' as nombre_anotado, telefono, proyecto, crm_contacto_id, paso_seguimiento, ultima_salida, linea
         from (
           select *, greatest(ultimo_mensaje_bot, ultimo_seguimiento) as ultima_salida from conversaciones
           where not sin_seguimientos and pidio_baja is null and ultimo_mensaje_interesado is not null and paso_seguimiento <= $1
         ) c
         where ultima_salida > ultimo_mensaje_interesado
           and ultima_salida < $3::timestamptz
           and ultima_salida > $2::timestamptz - interval '120 days'
           -- Ni las de una línea pausada (o que no es de leads) ni las que lleva un flujo: el flujo tiene sus propias esperas.
           and not exists (select 1 from lineas l where l.id = c.linea and (l.pausada or l.tipo <> 'entrada'))
           and not exists (select 1 from flujo_corridas f where f.conversacion = c.chatwoot_id and (f.estado <> 'terminado' or f.resultado = 'fin'))
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
        "select id, etapa, paso, dias_sin_respuesta, version, estado, proyecto, mensaje, linea from reglas_seguimiento where estado <> 'archivada' order by etapa, paso, version, id",
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
    async lineas() {
      const { rows } = await db.query(`select ${COLUMNAS_LINEA} from lineas order by orden`);
      return rows.map(lineaDeFila);
    },
    async marcarDelEquipo(mensaje) {
      await db.query("update mensajes set rol = 'persona' where id = $1 and rol = 'bot'", [mensaje]);
    },
    async campanias() {
      const { rows } = await db.query("select id, nombre, linea, frases, activa from campanias where activa order by id");
      return rows.map((r) => ({ id: Number(r.id), nombre: r.nombre, linea: r.linea ?? null, frases: r.frases ?? [], activa: r.activa === true }));
    },
    async flujosActivos(linea) {
      const { rows } = await db.query("select id, nombre, proyecto, pasos from flujos where linea = $1 and activo order by proyecto nulls last, id", [linea]);
      return rows.map((r) => ({ id: Number(r.id), nombre: r.nombre, proyecto: r.proyecto ?? null, pasos: r.pasos ?? [] }));
    },
    async archivo(id) {
      const { rows } = await db.query("select id, nombre, tipo, datos from archivos where id = $1", [id]);
      const r = rows[0];
      return r ? { id: Number(r.id), nombre: r.nombre, tipo: r.tipo, datos: new Uint8Array(r.datos) } : null;
    },
    async corridaViva(conversacion) {
      const { rows } = await db.query(`select ${COLUMNAS_CORRIDA} from flujo_corridas where conversacion = $1 and estado <> 'terminado'`, [conversacion]);
      return rows[0] ? corridaDeFila(rows[0]) : null;
    },
    async ultimaCorrida(conversacion) {
      const { rows } = await db.query(`select ${COLUMNAS_CORRIDA} from flujo_corridas where conversacion = $1 order by inicio desc, id desc limit 1`, [conversacion]);
      return rows[0] ? corridaDeFila(rows[0]) : null;
    },
    async iniciarCorrida(c) {
      const { rows } = await db.query(
        `insert into flujo_corridas (conversacion, linea, flujo, nombre, pasos, posicion, estado, inicio, ocupado_hasta, actualizado)
         values ($1, $2, $3, $4, $5, '0', 'en_curso', $6, $6::timestamptz + make_interval(secs => $7), now())
         on conflict (conversacion) where estado <> 'terminado' do nothing
         returning ${COLUMNAS_CORRIDA}`,
        [c.conversacion, c.linea, c.flujo, c.nombre, JSON.stringify(c.pasos), c.ahora, OCUPADA_MS / 1000],
      );
      return rows[0] ? corridaDeFila(rows[0]) : null;
    },
    async reclamarCorrida(id, como, ahora) {
      const { rowCount } = await db.query(
        `update flujo_corridas set estado = 'en_curso', ocupado_hasta = $4::timestamptz + make_interval(secs => $5), actualizado = now()
         where id = $1 and estado = $2 and posicion = $3
           and ($2 = 'esperando' or ocupado_hasta is null or ocupado_hasta < $4::timestamptz)`,
        [id, como.estado, como.posicion, ahora, OCUPADA_MS / 1000],
      );
      return rowCount === 1;
    },
    async guardarCorrida(id, cambios, ahora) {
      const campos = (["posicion", "estado", "resultado", "espera_desde", "vence", "respondio"] as const).filter((k) => k in cambios);
      // La primera respuesta queda: las siguientes no la pisan.
      const sets = campos.map((k, i) => (k === "respondio" ? `respondio = coalesce(respondio, $${i + 3}::timestamptz)` : `${k} = $${i + 3}`));
      // Mientras corre, sigue ocupada; esperando o terminada, la puede tomar otro.
      const libre = cambios.estado === "esperando" || cambios.estado === "terminado";
      sets.push(libre ? "ocupado_hasta = null" : `ocupado_hasta = $2::timestamptz + make_interval(secs => ${OCUPADA_MS / 1000})`);
      sets.push("actualizado = now()");
      // $2 (la hora) va siempre, aunque no se use: así los números de los parámetros no cambian.
      await db.query(`update flujo_corridas set ${sets.join(", ")} where id = $1 and $2::timestamptz is not null`, [id, ahora, ...campos.map((k) => cambios[k] ?? null)]);
    },
    async cancelarCorridas(conversacion, resultado = "cancelado") {
      await db.query("update flujo_corridas set estado = 'terminado', resultado = $2, ocupado_hasta = null, actualizado = now() where conversacion = $1 and estado <> 'terminado'", [
        conversacion,
        resultado,
      ]);
    },
    async corridasParaRetomar(ahora) {
      const { rows } = await db.query(
        `select ${COLUMNAS_CORRIDA.split(", ").map((c) => `f.${c}`).join(", ")} from flujo_corridas f left join lineas l on l.id = f.linea
         where (l.id is null or not l.pausada)
           -- El margen es medio día (MARGEN_MS) o la mitad de la espera, lo que sea menos (margenDeEspera).
           and ((f.estado = 'esperando'
                 and f.vence - least(make_interval(secs => $2), coalesce((f.vence - f.espera_desde) / 2, make_interval(secs => $2))) <= $1::timestamptz)
             or (f.estado = 'en_curso' and f.ocupado_hasta < $1::timestamptz))
         order by coalesce(f.vence, f.actualizado)
         limit 200`,
        [ahora, MARGEN_MS / 1000],
      );
      return rows.map(corridaDeFila);
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

/**
 * La baja vale por teléfono, para todas las líneas y conversaciones (docs/baja.md): marca «pidió la
 * baja» a las conversaciones de un teléfono que está en `bajas`, sea una (`chatwoot_id`) o todas las
 * de ese teléfono. Se compara por los últimos 10 dígitos, como el CRM. Lo que ya estaba marcado no cambia.
 */
export async function marcarBajaPorTelefono(db: Pick<pg.Pool, "query">, cual: { chatwoot_id: number } | { telefono: string }): Promise<void> {
  const porConversacion = "chatwoot_id" in cual;
  await db.query(
    `update conversaciones c set sin_seguimientos = true, pidio_baja = b.cuando, actualizada = now()
     from bajas b
     where c.pidio_baja is null and c.telefono is not null
       and length(regexp_replace(c.telefono, '\\D', '', 'g')) >= 8
       and right(b.telefono, 10) = right(regexp_replace(c.telefono, '\\D', '', 'g'), 10)
       and ${porConversacion ? "c.chatwoot_id = $1" : "b.telefono = $1"}`,
    [porConversacion ? cual.chatwoot_id : cual.telefono],
  );
}
