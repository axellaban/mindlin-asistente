/**
 * El outreach frío en la base del asistente (docs/outreach.md): las bases cargadas, la cola, la
 * toma de 10 minutos, los envíos y los cuidados de la línea. Los cuidados los hace cumplir esto,
 * no la pantalla: en cada toma se bloquea la fila de la línea (`outreach_estado ... for update`),
 * así dos pestañas, o una persona y un agente a la vez, no pasan el tope ni la pausa.
 *
 * Probado contra un Postgres de verdad (lib/outreach/datos.test.ts).
 */

import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { ContactoCRM } from "../crm/planilla";
import { claveSinTelefono, leerBase, revisarBase, contarFilas, type LoQueSeSabe, type FilaRevisada, type BaseLeida, type EstadoFila } from "./importar";
import {
  CONFIG_OUTREACH_DE_FABRICA,
  enBuenosAires,
  masDiasHabiles,
  puedeTomar,
  siguienteDesde,
  textoDelPaso,
  textoEspera,
  topeVigente,
  validarConfigOutreach,
  type ConfigOutreach,
  type EstadoLinea,
  type Modo,
  type MotivoEspera,
} from "./reglas";
import { normalizarTelefono, telefonoParaComparar } from "./telefono";
import { aprendizajes, puntuar, type Aprendizaje, type Parte } from "./puntaje";

type Db = Pick<pg.Pool, "query" | "connect">;
type Cliente = Pick<pg.PoolClient, "query">;

/** Cuánto dura la toma de un contacto. */
export const TOMA_MINUTOS = 10;
/** Cuánto se corre un contacto salteado. */
export const SALTAR_HORAS = 4;
/** Hace cuánto tiene que haber escrito a una línea de leads para que no le escribamos en frío. */
export const DIAS_EN_CHARLA = 30;

export type EtapaOutreach = "por_revisar" | "por_contactar" | "saludado" | "respondio" | "interesado" | "cerrado" | "invalido" | "baja" | "excluido";
export type Ejecutor = "persona" | "bot";
export type Falla = "no_salio" | "sin_whatsapp" | "numero_incorrecto";

export interface LoteOutreach {
  id: number;
  nombre: string;
  creado: string;
  creado_por: string | null;
  pausado: boolean;
  incluye_descartados: boolean;
  /** Cuántos hay en cada etapa. */
  etapas: Partial<Record<EtapaOutreach, number>>;
}

export interface ContactoOutreach {
  id: number;
  lote: number;
  nombre: string;
  telefono: string | null;
  telefono_original: string;
  proyecto: string | null;
  proyecto_texto: string;
  fecha_consulta: string | null;
  origen: string;
  notas: string;
  etapa: EtapaOutreach;
  motivo: string;
  mensajes: number;
  proxima_accion: string | null;
  tiene_whatsapp: boolean | null;
  tomado_por: string | null;
  tomado_hasta: string | null;
  ultimo_envio: string | null;
  respondio: string | null;
  /** De 0 a 100 (lib/outreach/puntaje.ts), con lo que sumó cada cosa. */
  puntaje: number;
  puntaje_detalle: Parte[];
  /** La etapa que tenía en el CRM cuando se cargó la base. */
  crm_etapa: string | null;
}

/** Lo que necesita quien manda (o el agente): a quién, qué texto y la clave para confirmar. */
export interface Tarjeta {
  contacto: ContactoOutreach;
  /** 0 es el saludo; 1 y 2, los seguimientos. */
  paso: number;
  texto: string;
  version: number;
  clave: string;
  /** Hasta cuándo dura la toma. */
  hasta: string;
  /** El link para abrir el chat con el texto (WhatsApp Web en la computadora). */
  whatsapp_web: string;
  whatsapp_celular: string;
}

export interface EstadoOutreach extends EstadoLinea {
  linea: string;
  config: ConfigOutreach;
  /** Si ahora se puede tomar el siguiente, por modo. */
  puede: Record<Modo, { ok: true } | (MotivoEspera & { texto: string })>;
  fallas_seguidas: number;
  /** Cuántos esperan en la cola ahora (sin contar los que esperan su seguimiento). */
  en_cola: number;
  etapas: Partial<Record<EtapaOutreach, number>>;
}

const COLUMNAS = `c.id, c.lote, c.nombre, c.telefono, c.telefono_original, c.proyecto, c.proyecto_texto, c.fecha_consulta, c.origen, c.notas,
  c.etapa, c.motivo, c.mensajes, c.proxima_accion, c.tiene_whatsapp, c.tomado_por, c.tomado_hasta, c.ultimo_envio, c.respondio,
  c.puntaje, c.puntaje_detalle, c.crm_etapa`;

const iso = (x: unknown) => (x == null ? null : x instanceof Date ? x.toISOString() : String(x));
const fecha = (x: unknown) => (x == null ? null : x instanceof Date ? x.toISOString().slice(0, 10) : String(x).slice(0, 10));

function contactoDeFila(r: Record<string, unknown>): ContactoOutreach {
  return {
    id: Number(r.id),
    lote: Number(r.lote),
    nombre: String(r.nombre ?? ""),
    telefono: (r.telefono as string | null) ?? null,
    telefono_original: String(r.telefono_original ?? ""),
    proyecto: (r.proyecto as string | null) ?? null,
    proyecto_texto: String(r.proyecto_texto ?? ""),
    fecha_consulta: fecha(r.fecha_consulta),
    origen: String(r.origen ?? ""),
    notas: String(r.notas ?? ""),
    etapa: r.etapa as EtapaOutreach,
    motivo: String(r.motivo ?? ""),
    mensajes: Number(r.mensajes ?? 0),
    proxima_accion: iso(r.proxima_accion),
    tiene_whatsapp: (r.tiene_whatsapp as boolean | null) ?? null,
    tomado_por: (r.tomado_por as string | null) ?? null,
    tomado_hasta: iso(r.tomado_hasta),
    ultimo_envio: iso(r.ultimo_envio),
    respondio: iso(r.respondio),
    puntaje: Number(r.puntaje ?? 0),
    puntaje_detalle: (r.puntaje_detalle as Parte[] | null) ?? [],
    crm_etapa: (r.crm_etapa as string | null) ?? null,
  };
}

/** Los links de WhatsApp con el texto (sin el «+»). */
export function enlacesWhatsApp(telefono: string, texto: string) {
  const t = encodeURIComponent(texto);
  return { whatsapp_web: `https://web.whatsapp.com/send?phone=${telefono}&text=${t}`, whatsapp_celular: `https://wa.me/${telefono}?text=${t}` };
}

async function transaccion<T>(db: Db, f: (c: Cliente) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query("begin");
    const r = await f(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** El inicio del día de hoy en Buenos Aires (para contar los envíos del día). */
const inicioDeHoy = (ahora: Date) => new Date(`${enBuenosAires(ahora).fecha}T03:00:00.000Z`);

export function datosOutreach(db: Db, o: { azar?: () => number } = {}) {
  const azar = o.azar ?? Math.random;
  async function config(linea: string, q: Pick<Cliente, "query"> = db): Promise<ConfigOutreach> {
    const { rows } = await q.query("select config from outreach_config where linea = $1", [linea]);
    if (!rows[0]) return CONFIG_OUTREACH_DE_FABRICA;
    const r = validarConfigOutreach(rows[0].config);
    return "config" in r ? r.config : CONFIG_OUTREACH_DE_FABRICA;
  }

  /** Que exista la fila de estado de la línea (para poder bloquearla). */
  const asegurarEstado = (q: Cliente, linea: string) => q.query("insert into outreach_estado (linea) values ($1) on conflict (linea) do nothing", [linea]);

  /** El estado de la línea, leído dentro de la transacción (con la fila ya bloqueada si `bloquear`). */
  async function leerEstado(q: Cliente, linea: string, ahora: Date, bloquear: boolean) {
    await asegurarEstado(q, linea);
    const { rows } = await q.query(
      `select e.*, l.pausada, l.tipo, (select pausado from asistente_estado where id = 1) as pausa_general
       from outreach_estado e join lineas l on l.id = e.linea where e.linea = $1 ${bloquear ? "for update of e" : ""}`,
      [linea],
    );
    const e = rows[0];
    if (!e) throw new Error(`No existe la línea «${linea}».`);
    const c = await config(linea, q);
    const tope = topeVigente({ tope: e.tope == null ? null : Number(e.tope), tope_desde: fecha(e.tope_desde) }, c, ahora, () => false);
    let topeFinal = tope.tope;
    if (tope.guardar) {
      // ¿Hubo frenos desde la última suba? Si los hubo, no sube.
      const desde = fecha(e.tope_desde);
      const freno = desde
        ? (await q.query("select 1 from outreach_eventos where linea = $1 and tipo = 'freno' and creado >= $2::date + interval '3 hours' limit 1", [linea, desde])).rows.length > 0
        : false;
      const t = topeVigente({ tope: e.tope == null ? null : Number(e.tope), tope_desde: desde }, c, ahora, () => freno);
      topeFinal = t.tope;
      if (t.guardar) {
        await q.query("update outreach_estado set tope = $2, tope_desde = $3 where linea = $1", [linea, t.guardar.tope, t.guardar.tope_desde]);
        if (e.tope != null && t.guardar.tope !== Number(e.tope)) {
          await q.query("insert into outreach_eventos (linea, tipo, detalle) values ($1, 'tope', $2)", [linea, `El tope sube a ${t.guardar.tope} por día.`]);
        }
      }
    }
    const enviados = await q.query("select count(*)::int as n from outreach_eventos where linea = $1 and tipo = 'envio' and creado >= $2", [linea, inicioDeHoy(ahora)]);
    const toma = await q.query("select tomado_por, tomado_hasta from outreach_contactos where linea = $1 and tomado_hasta > $2 order by tomado_hasta desc limit 1", [linea, ahora]);
    const estado: EstadoLinea = {
      pausada: e.pausada === true || e.pausa_general === true,
      frenado: e.frenado ?? null,
      forzar_dia: fecha(e.forzar_dia),
      siguiente_desde: iso(e.siguiente_desde),
      enviados_hoy: enviados.rows[0].n,
      tope: topeFinal,
      toma: toma.rows[0] ? { por: toma.rows[0].tomado_por, hasta: iso(toma.rows[0].tomado_hasta)! } : null,
    };
    return { estado, config: c, fallas: Number(e.fallas_seguidas ?? 0), tipo: String(e.tipo) };
  }

  /**
   * El siguiente de la cola: primero los seguimientos que ya tocan, después los nuevos (los de un
   * consultaron más recientemente y, a igual fecha, los de un proyecto con ficha activa, primero). Sin los que
   * pidieron la baja, los excluidos ni los lotes pausados.
   */
  const COLA = `
    from outreach_contactos c
    join outreach_lotes l on l.id = c.lote and not l.pausado
    left join proyectos p on p.id = c.proyecto
    where c.linea = $1 and c.telefono is not null
      and c.etapa in ('por_contactar', 'saludado')
      and c.mensajes < $3
      and (c.proxima_accion is null or c.proxima_accion <= $2)
      and c.tiene_whatsapp is not false
      and not (c.telefono = any($4::text[]))
      and not exists (select 1 from bajas b where b.telefono = c.telefono)`;
  const ORDEN = `order by (c.etapa = 'saludado') desc, c.proxima_accion nulls last, c.puntaje desc, c.fecha_consulta desc nulls last, c.id`;

  /**
   * Vuelve a calcular el puntaje de los que todavía pueden recibir algo (todos los de la línea, o
   * los de `ids`). Se llama al cargar una base, al cambiar los pesos y cuando cambia un dato.
   */
  async function recalcular(q: Pick<Cliente, "query">, linea: string, ahora: Date, ids?: number[]) {
    const cfg = await config(linea, q);
    const activos = new Set<string>((await q.query("select id from proyectos where activo")).rows.map((r) => r.id));
    const { rows } = await q.query(
      `select id, nombre, proyecto, proyecto_texto, fecha_consulta, origen, crm_etapa, tiene_whatsapp from outreach_contactos
       where linea = $1 and etapa in ('por_revisar', 'por_contactar', 'saludado') and ($2::bigint[] is null or id = any($2))`,
      [linea, ids ?? null],
    );
    if (!rows.length) return;
    const hoy = enBuenosAires(ahora).fecha;
    const nuevos = rows.map((r) => {
      const p = puntuar({ ...r, fecha_consulta: fecha(r.fecha_consulta) }, cfg.puntaje, { activos, hoy });
      return { id: Number(r.id), puntaje: p.puntaje, detalle: JSON.stringify(p.detalle) };
    });
    await q.query(
      `update outreach_contactos c set puntaje = x.puntaje, puntaje_detalle = x.detalle::jsonb
       from unnest($1::bigint[], $2::smallint[], $3::text[]) as x(id, puntaje, detalle) where c.id = x.id`,
      [nuevos.map((n) => n.id), nuevos.map((n) => n.puntaje), nuevos.map((n) => n.detalle)],
    );
  }

  async function tarjeta(q: Cliente, c: ContactoOutreach, cfg: ConfigOutreach, clave: string, hasta: string): Promise<Tarjeta> {
    const p = c.proyecto ? (await q.query("select nombre from proyectos where id = $1", [c.proyecto])).rows[0]?.nombre : null;
    const { texto, version } = textoDelPaso(cfg, c.mensajes, { id: c.id, nombre: c.nombre, proyecto_nombre: p ?? null });
    return { contacto: c, paso: c.mensajes, texto, version, clave, hasta, ...enlacesWhatsApp(c.telefono!, texto) };
  }

  /** Suma una falla seguida y, si llega al límite, frena la línea. */
  async function sumarFalla(q: Cliente, linea: string, cfg: ConfigOutreach, por: string) {
    const { rows } = await q.query("update outreach_estado set fallas_seguidas = fallas_seguidas + 1 where linea = $1 returning fallas_seguidas, frenado", [linea]);
    const n = Number(rows[0].fallas_seguidas);
    if (n >= cfg.freno_fallas && !rows[0].frenado) {
      const motivo = `${n} envíos seguidos no salieron o eran números inválidos`;
      await q.query("update outreach_estado set frenado = $2, frenado_desde = now() where linea = $1", [linea, motivo]);
      await q.query("insert into outreach_eventos (linea, tipo, por, detalle) values ($1, 'freno', $2, $3)", [linea, por, motivo]);
    }
  }

  return {
    config: (linea: string) => config(linea),

    async guardarConfig(linea: string, c: ConfigOutreach, por: string | null): Promise<void> {
      await db.query(
        `insert into outreach_config (linea, config, actualizado, actualizado_por) values ($1, $2, now(), $3)
         on conflict (linea) do update set config = excluded.config, actualizado = now(), actualizado_por = excluded.actualizado_por`,
        [linea, JSON.stringify(c), por],
      );
      await recalcular(db, linea, new Date());
    },

    /** Recalcula los puntajes (por ejemplo, después de activar o apagar una ficha). */
    recalcular: (linea: string, ahora: Date) => recalcular(db, linea, ahora),

    /** Lo que hace falta para decidir quién entra a la cola (el CRM viene de afuera: es la planilla). */
    async loQueSeSabe(linea: string, crm: ContactoCRM[] | null): Promise<LoQueSeSabe> {
      const cfg = await config(linea);
      const [cargados, bajas, charlas, proyectos] = await Promise.all([
        db.query("select telefono, nombre, telefono_original from outreach_contactos where linea = $1", [linea]),
        db.query(
          `select telefono from bajas
           union select telefono from conversaciones where pidio_baja is not null and telefono is not null`,
        ),
        // Están hablando con Mindlin: la tiene el equipo, o escribió a una línea de leads hace poco.
        db.query(
          `select c.telefono from conversaciones c left join lineas l on l.id = c.linea
           where c.telefono is not null and (
             (c.sin_seguimientos and c.pidio_baja is null)
             or ((l.tipo is null or l.tipo = 'entrada') and c.ultimo_mensaje_interesado > now() - make_interval(days => $1))
           )`,
          [DIAS_EN_CHARLA],
        ),
        db.query("select id, nombre, palabras_clave from proyectos"),
      ]);
      const set = (rows: { telefono: string }[]) => new Set(rows.map((r) => telefonoParaComparar(r.telefono)).filter((t): t is string => Boolean(t)));
      const etapas = new Map<string, string>();
      for (const c of crm ?? []) {
        const t = telefonoParaComparar(c.telefono);
        if (t) etapas.set(t, c.etapa);
      }
      return {
        yaCargados: set(cargados.rows.filter((r) => r.telefono)),
        yaCargadosSinTelefono: new Set(cargados.rows.filter((r) => !r.telefono).map((r) => claveSinTelefono(r.nombre, r.telefono_original))),
        bajas: set(bajas.rows),
        excluidos: new Set(cfg.excluidos),
        crm: etapas,
        enCharla: set(charlas.rows),
        proyectos: proyectos.rows.map((p) => ({ id: p.id, nombre: p.nombre, palabras_clave: p.palabras_clave ?? [] })),
      };
    },

    /** Lee lo pegado y dice qué pasaría con cada fila, sin guardar nada. */
    async vistaPrevia(linea: string, texto: string, o: { incluir_descartados: boolean }, crm: ContactoCRM[] | null) {
      const base = leerBase(texto);
      if ("error" in base) return base;
      const filas = revisarBase(base.filas, await this.loQueSeSabe(linea, crm), o);
      return { columnas: base.columnas, otras: base.otras, totales: contarFilas(filas), filas };
    },

    /**
     * Guarda una base como lote: entran a la cola los que pasan los cruces y quedan «por revisar»
     * los teléfonos que no se entendieron. Los repetidos y los excluidos no se guardan (se ven en
     * la vista previa).
     */
    async crearLote(
      linea: string,
      nombre: string,
      texto: string,
      o: { incluir_descartados: boolean },
      crm: ContactoCRM[] | null,
      por: string | null,
    ): Promise<{ error: string } | { lote: number; totales: Record<EstadoFila, number>; guardados: number }> {
      const nombreLimpio = nombre.trim().slice(0, 80);
      if (!nombreLimpio) return { error: "Ponele un nombre a la base (por ejemplo, «Leads Kommo 2024»)." };
      const base: BaseLeida | { error: string } = leerBase(texto);
      if ("error" in base) return base;
      const sabe = await this.loQueSeSabe(linea, crm);
      const filas = revisarBase(base.filas, sabe, o);
      const guardar = filas.filter((f) => f.estado === "entra" || f.estado === "por_revisar");
      if (!guardar.length) return { error: "Ninguna fila entra: todas están repetidas o excluidas (mirá la vista previa)." };
      return transaccion(db, async (q) => {
        const { rows } = await q.query("insert into outreach_lotes (linea, nombre, creado_por, incluye_descartados) values ($1, $2, $3, $4) returning id", [
          linea,
          nombreLimpio,
          por,
          o.incluir_descartados,
        ]);
        const lote = Number(rows[0].id);
        let guardados = 0;
        for (const f of guardar) guardados += await insertarFila(q, linea, lote, f);
        await recalcular(q, linea, new Date());
        return { lote, totales: contarFilas(filas), guardados };
      });
    },

    async lotes(linea: string): Promise<LoteOutreach[]> {
      const { rows } = await db.query(
        `select l.id, l.nombre, l.creado, l.creado_por, l.pausado, l.incluye_descartados,
           coalesce((select jsonb_object_agg(etapa, n) from (select etapa, count(*)::int as n from outreach_contactos where lote = l.id group by etapa) x), '{}'::jsonb) as etapas
         from outreach_lotes l where l.linea = $1 order by l.creado desc`,
        [linea],
      );
      return rows.map((r) => ({
        id: Number(r.id),
        nombre: r.nombre,
        creado: iso(r.creado)!,
        creado_por: r.creado_por ?? null,
        pausado: r.pausado,
        incluye_descartados: r.incluye_descartados,
        etapas: r.etapas,
      }));
    },

    async pausarLote(id: number, pausado: boolean): Promise<boolean> {
      const { rowCount } = await db.query("update outreach_lotes set pausado = $2 where id = $1", [id, pausado]);
      return (rowCount ?? 0) > 0;
    },

    /** Borra el lote y sus contactos. En los eventos quedan los totales (sin el contacto). */
    async borrarLote(id: number): Promise<boolean> {
      const { rowCount } = await db.query("delete from outreach_lotes where id = $1", [id]);
      return (rowCount ?? 0) > 0;
    },

    async contactos(linea: string, f: { lote?: number | null; etapa?: EtapaOutreach | null; buscar?: string | null; limite?: number }): Promise<ContactoOutreach[]> {
      const buscar = f.buscar?.trim() ? f.buscar.trim() : null;
      const cifras = buscar?.replace(/\D/g, "") ?? "";
      const { rows } = await db.query(
        `select ${COLUMNAS} from outreach_contactos c
         where c.linea = $1 and ($2::bigint is null or c.lote = $2) and ($3::text is null or c.etapa = $3)
           and ($4::text is null or c.nombre ilike '%' || $4 || '%' or c.proyecto_texto ilike '%' || $4 || '%' or ($5::text <> '' and length($5) >= 3 and c.telefono like '%' || $5 || '%'))
         order by c.actualizado desc, c.id desc limit $6`,
        [linea, f.lote ?? null, f.etapa ?? null, buscar, cifras, Math.min(Math.max(f.limite ?? 200, 1), 1000)],
      );
      return rows.map(contactoDeFila);
    },

    /** Corrige el teléfono de uno «por revisar» (o de cualquiera que todavía no recibió nada). */
    async corregirTelefono(id: number, telefono: string): Promise<{ error: string } | { contacto: ContactoOutreach }> {
      const n = normalizarTelefono(telefono);
      if (!n.telefono) return { error: `Ese teléfono no sirve: ${n.motivo}.` };
      try {
        const { rows } = await db.query(
          `update outreach_contactos c set telefono = $2, etapa = 'por_contactar', motivo = '', tiene_whatsapp = null, actualizado = now()
           where id = $1 and mensajes = 0 and etapa in ('por_revisar', 'por_contactar', 'invalido')
             and not exists (select 1 from bajas b where b.telefono = $2)
           returning ${COLUMNAS}, c.linea`,
          [id, n.telefono],
        );
        if (!rows[0]) return { error: "No se puede cambiar: ya le escribimos, no existe o ese teléfono pidió la baja." };
        await recalcular(db, String(rows[0].linea ?? ""), new Date(), [id]);
        const [c] = (await db.query(`select ${COLUMNAS} from outreach_contactos c where c.id = $1`, [id])).rows;
        return { contacto: contactoDeFila(c) };
      } catch (e) {
        if ((e as { code?: string }).code === "23505") return { error: "Ese teléfono ya está cargado en esta línea." };
        throw e;
      }
    },

    /** El estado de la línea para la pantalla: cuidados, tope, envíos de hoy y si se puede mandar. */
    async estado(linea: string, ahora: Date, quien: string): Promise<EstadoOutreach> {
      return transaccion(db, async (q) => {
        const { estado, config: cfg, fallas } = await leerEstado(q, linea, ahora, false);
        const enCola = await q.query(`select count(*)::int as n ${COLA}`, [linea, ahora, cfg.mensajes_max, cfg.excluidos]);
        const etapas = await q.query("select etapa, count(*)::int as n from outreach_contactos where linea = $1 group by etapa", [linea]);
        const puede = {} as EstadoOutreach["puede"];
        for (const m of ["waha", "computer_use"] as Modo[]) {
          const p = puedeTomar(cfg, estado, m, ahora, quien);
          puede[m] = "ok" in p ? p : { ...p, texto: textoEspera(p) };
        }
        return {
          linea,
          config: cfg,
          ...estado,
          puede,
          fallas_seguidas: fallas,
          en_cola: enCola.rows[0].n,
          etapas: Object.fromEntries(etapas.rows.map((r) => [r.etapa, r.n])),
        };
      });
    },

    /** Los próximos de la cola, para mostrar (no toma a nadie). */
    async cola(linea: string, ahora: Date, limite = 20): Promise<ContactoOutreach[]> {
      const cfg = await config(linea);
      const { rows } = await db.query(`select ${COLUMNAS} ${COLA} ${ORDEN} limit $5`, [linea, ahora, cfg.mensajes_max, cfg.excluidos, Math.min(Math.max(limite, 1), 100)]);
      return rows.map(contactoDeFila);
    },

    /**
     * Toma el siguiente contacto (o uno elegido) por 10 minutos y devuelve el texto. Si quien pide
     * ya tenía uno tomado, devuelve ese mismo (por ejemplo, después de recargar la página).
     */
    async tomar(
      linea: string,
      o: { modo: Modo; por: string; contacto?: number | null },
      ahora: Date,
    ): Promise<{ tarjeta: Tarjeta } | { espera: MotivoEspera & { texto: string } } | { vacia: true }> {
      return transaccion(db, async (q) => {
        const { estado, config: cfg, tipo } = await leerEstado(q, linea, ahora, true);
        if (tipo !== "outreach_frio") throw new Error("Esta línea no es de outreach.");
        const propia = await q.query(`select ${COLUMNAS}, c.toma_clave from outreach_contactos c where c.linea = $1 and c.tomado_por = $2 and c.tomado_hasta > $3 limit 1`, [
          linea,
          o.por,
          ahora,
        ]);
        if (propia.rows[0]) {
          const c = contactoDeFila(propia.rows[0]);
          return { tarjeta: await tarjeta(q, c, cfg, propia.rows[0].toma_clave, c.tomado_hasta!) };
        }
        const p = puedeTomar(cfg, estado, o.modo, ahora, o.por);
        if (!("ok" in p)) return { espera: { ...p, texto: textoEspera(p) } };
        const libre = `and (c.tomado_hasta is null or c.tomado_hasta <= $2)`;
        const params = [linea, ahora, cfg.mensajes_max, cfg.excluidos, o.contacto ?? null];
        let { rows } = await q.query(`select ${COLUMNAS} ${COLA} and ($5::bigint is null or c.id = $5) ${libre} ${ORDEN} limit 1 for update of c skip locked`, params);
        if (!rows[0]) return { vacia: true };
        // Una parte de los nuevos sale al azar, para medir si el puntaje acierta (no los seguimientos ni uno elegido a mano).
        let alAzar = false;
        if (!o.contacto && rows[0].etapa === "por_contactar" && cfg.exploracion > 0 && azar() * 100 < cfg.exploracion) {
          const otro = await q.query(`select ${COLUMNAS} ${COLA} and c.etapa = 'por_contactar' ${libre} order by random() limit 1 for update of c skip locked`, params.slice(0, 4));
          if (otro.rows[0]) {
            rows = otro.rows;
            alAzar = true;
          }
        }
        const clave = randomUUID();
        const hasta = new Date(ahora.getTime() + TOMA_MINUTOS * 60_000);
        await q.query("update outreach_contactos set tomado_por = $2, tomado_hasta = $3, toma_clave = $4, toma_azar = $5 where id = $1", [rows[0].id, o.por, hasta, clave, alAzar]);
        const c = { ...contactoDeFila(rows[0]), tomado_por: o.por, tomado_hasta: hasta.toISOString() };
        return { tarjeta: await tarjeta(q, c, cfg, clave, hasta.toISOString()) };
      });
    },

    /**
     * El mensaje salió. Con la misma clave cuenta una sola vez (un reintento o un doble toque no
     * suman). Agenda el seguimiento, si corresponde, y la pausa hasta el siguiente.
     */
    async confirmar(
      id: number,
      o: { clave: string; modo: Modo | "a_mano"; por: string; ejecutor: Ejecutor },
      ahora: Date,
    ): Promise<{ ok: true; ya_estaba: boolean; contacto: ContactoOutreach } | { error: string }> {
      return transaccion(db, async (q) => {
        const { rows } = await q.query(`select ${COLUMNAS}, c.linea, c.toma_clave, c.toma_azar from outreach_contactos c where c.id = $1 for update`, [id]);
        const r = rows[0];
        if (!r) return { error: "Ese contacto ya no existe." };
        const ya = await q.query("select 1 from outreach_eventos where clave = $1", [o.clave]);
        if (ya.rows.length) return { ok: true as const, ya_estaba: true, contacto: contactoDeFila(r) };
        if (!o.clave || r.toma_clave !== o.clave) return { error: "Ese envío no es el que estaba tomado. Volvé a la cola y tomalo de nuevo." };
        const cfg = await config(r.linea, q);
        const paso = Number(r.mensajes);
        const mensajes = paso + 1;
        const p = r.proyecto ? (await q.query("select nombre from proyectos where id = $1", [r.proyecto])).rows[0]?.nombre : null;
        const { version } = textoDelPaso(cfg, paso, { id, nombre: r.nombre, proyecto_nombre: p ?? null });
        await q.query(
          `insert into outreach_eventos (linea, contacto, lote, tipo, paso, version, modo, ejecutor, por, clave, creado, al_azar)
           values ($1, $2, $3, 'envio', $4, $5, $6, $7, $8, $9, $10, $11)`,
          [r.linea, id, r.lote, paso, version, o.modo, o.ejecutor, o.por, o.clave, ahora, r.toma_azar === true],
        );
        const proxima = mensajes < cfg.mensajes_max ? masDiasHabiles(ahora, cfg.dias_seguimiento, cfg.feriados) : null;
        const act = await q.query(
          `update outreach_contactos c set mensajes = $2, etapa = case when etapa = 'por_contactar' then 'saludado' else etapa end,
             ultimo_envio = $3, proxima_accion = $4, tiene_whatsapp = true, tomado_por = null, tomado_hasta = null, toma_clave = null, toma_azar = false, actualizado = $3
           where id = $1 returning ${COLUMNAS}`,
          [id, mensajes, ahora, proxima],
        );
        const modoPausa: Modo = o.modo === "waha" ? "waha" : "computer_use";
        await asegurarEstado(q, r.linea);
        await q.query("update outreach_estado set siguiente_desde = $2, fallas_seguidas = 0 where linea = $1", [r.linea, siguienteDesde(cfg, modoPausa, ahora)]);
        return { ok: true as const, ya_estaba: false, contacto: contactoDeFila(act.rows[0]) };
      });
    },

    /**
     * No salió: vuelve a la cola el próximo día hábil. Sin WhatsApp o número incorrecto: queda
     * inválido. Las fallas seguidas frenan la línea.
     */
    async fallo(id: number, o: { clave: string; falla: Falla; modo: Modo | "a_mano"; por: string; ejecutor: Ejecutor }, ahora: Date): Promise<{ ok: true; frenada: boolean } | { error: string }> {
      return transaccion(db, async (q) => {
        const { rows } = await q.query("select id, linea, lote, toma_clave from outreach_contactos where id = $1 for update", [id]);
        const r = rows[0];
        if (!r) return { error: "Ese contacto ya no existe." };
        const ya = await q.query("select 1 from outreach_eventos where clave = $1", [o.clave]);
        if (ya.rows.length) return { ok: true as const, frenada: false };
        if (!o.clave || r.toma_clave !== o.clave) return { error: "Ese envío no es el que estaba tomado. Volvé a la cola y tomalo de nuevo." };
        const cfg = await config(r.linea, q);
        await q.query("insert into outreach_eventos (linea, contacto, lote, tipo, modo, ejecutor, por, clave, creado) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
          r.linea,
          id,
          r.lote,
          o.falla,
          o.modo,
          o.ejecutor,
          o.por,
          o.clave,
          ahora,
        ]);
        if (o.falla === "no_salio") {
          await q.query("update outreach_contactos set proxima_accion = $2, tomado_por = null, tomado_hasta = null, toma_clave = null, actualizado = $3 where id = $1", [
            id,
            masDiasHabiles(ahora, 1, cfg.feriados),
            ahora,
          ]);
        } else {
          const motivo = o.falla === "sin_whatsapp" ? "no tiene WhatsApp" : "número incorrecto";
          await q.query(
            `update outreach_contactos set etapa = 'invalido', motivo = $2, tiene_whatsapp = case when $3 then false else tiene_whatsapp end,
               proxima_accion = null, tomado_por = null, tomado_hasta = null, toma_clave = null, actualizado = $4 where id = $1`,
            [id, motivo, o.falla === "sin_whatsapp", ahora],
          );
        }
        await asegurarEstado(q, r.linea);
        await sumarFalla(q, r.linea, cfg, o.por);
        const e = await q.query("select frenado from outreach_estado where linea = $1", [r.linea]);
        return { ok: true as const, frenada: Boolean(e.rows[0]?.frenado) };
      });
    },

    /** Lo suelta sin mandar nada (vuelve a la cola tal como estaba). */
    async soltar(id: number, por: string): Promise<boolean> {
      const { rowCount } = await db.query("update outreach_contactos set tomado_por = null, tomado_hasta = null, toma_clave = null where id = $1 and tomado_por = $2", [id, por]);
      return (rowCount ?? 0) > 0;
    },

    /** Lo deja para más tarde (unas horas) y lo suelta. */
    async saltar(id: number, por: string, ahora: Date): Promise<boolean> {
      const { rows } = await db.query(
        `update outreach_contactos set tomado_por = null, tomado_hasta = null, toma_clave = null, proxima_accion = $3, actualizado = $4
         where id = $1 and (tomado_por = $2 or tomado_hasta is null or tomado_hasta <= $4) returning linea, lote`,
        [id, por, new Date(ahora.getTime() + SALTAR_HORAS * 3_600_000), ahora],
      );
      if (!rows[0]) return false;
      await db.query("insert into outreach_eventos (linea, contacto, lote, tipo, por, creado) values ($1, $2, $3, 'saltar', $4, $5)", [rows[0].linea, id, rows[0].lote, por, ahora]);
      return true;
    },

    /** Saca el freno después de revisar WhatsApp. */
    async seguir(linea: string, por: string): Promise<void> {
      await db.query("update outreach_estado set frenado = null, frenado_desde = null, fallas_seguidas = 0 where linea = $1", [linea]);
      await db.query("insert into outreach_eventos (linea, tipo, por, detalle) values ($1, 'reanudar', $2, 'Sacó el freno')", [linea, por]);
    },

    /** «Mandar igual»: fuera de franja, solo por hoy (el tope y las pausas siguen). */
    async mandarIgualHoy(linea: string, por: string, ahora: Date): Promise<void> {
      await db.query("insert into outreach_estado (linea) values ($1) on conflict (linea) do nothing", [linea]);
      await db.query("update outreach_estado set forzar_dia = $2 where linea = $1", [linea, enBuenosAires(ahora).fecha]);
      await db.query("insert into outreach_eventos (linea, tipo, por, detalle) values ($1, 'forzar', $2, 'Mandar igual fuera de franja, solo hoy')", [linea, por]);
    },

    /**
     * Qué responde mejor: cada variable del puntaje contra cuántos respondieron, de todos los
     * contactados y solo de los que salieron al azar (lo que mide sin el sesgo del orden). Y la
     * respuesta por franja de puntaje: si el puntaje acierta, los de arriba responden más.
     */
    async aprendizajes(linea: string): Promise<{ todos: Aprendizaje[]; al_azar: Aprendizaje[]; por_puntaje: (Omit<Aprendizaje, "variable" | "valor"> & { franja: string })[]; contactados: number }> {
      const { rows } = await db.query(
        `select c.puntaje, c.puntaje_detalle, c.respondio is not null as respondio,
           coalesce((select e.al_azar from outreach_eventos e where e.contacto = c.id and e.tipo = 'envio' and e.paso = 0 order by e.creado limit 1), false) as al_azar
         from outreach_contactos c where c.linea = $1 and c.mensajes > 0`,
        [linea],
      );
      const filas = rows.map((r) => ({ detalle: (r.puntaje_detalle ?? []) as Parte[], respondio: r.respondio === true, al_azar: r.al_azar === true, puntaje: Number(r.puntaje) }));
      const franjas: [string, number, number][] = [["70 a 100", 70, 100], ["40 a 69", 40, 69], ["0 a 39", 0, 39]];
      const por_puntaje = franjas.map(([franja, min, max]) => {
        const f = filas.filter((x) => x.puntaje >= min && x.puntaje <= max);
        const respondieron = f.filter((x) => x.respondio).length;
        return { franja, contactados: f.length, respondieron, tasa: f.length ? respondieron / f.length : null, muestra_chica: f.length < 30 };
      });
      return { todos: aprendizajes(filas), al_azar: aprendizajes(filas.filter((f) => f.al_azar)), por_puntaje, contactados: filas.length };
    },

    /** La persona de la base de esta línea con ese teléfono (cualquier formato), con el nombre de su base. */
    async contactoPorTelefono(linea: string, telefono: string): Promise<(ContactoOutreach & { lote_nombre: string; conversacion: number | null; crm_contacto_id: string | null }) | null> {
      const t = telefonoParaComparar(telefono);
      if (!t) return null;
      const { rows } = await db.query(
        `select ${COLUMNAS}, l.nombre as lote_nombre, c.conversacion, c.crm_contacto_id from outreach_contactos c join outreach_lotes l on l.id = c.lote where c.linea = $1 and c.telefono = $2`,
        [linea, t],
      );
      return rows[0] ? { ...contactoDeFila(rows[0]), lote_nombre: rows[0].lote_nombre, conversacion: rows[0].conversacion == null ? null : Number(rows[0].conversacion), crm_contacto_id: rows[0].crm_contacto_id ?? null } : null;
    },

    /**
     * Escribió alguien de la base. Una respuesta automática se anota pero no cuenta; un «no» o un
     * número equivocado lo cierran; una respuesta de verdad lo pasa a «respondió» y corta la
     * secuencia. `primera`: si es la primera respuesta de verdad (para dar de alta en el CRM y avisar una sola vez).
     */
    async anotarRespuesta(
      id: number,
      o: { clasificacion: "automatica" | "no" | "equivocado" | "respuesta"; conversacion: number; mensaje: number | null },
      ahora: Date,
    ): Promise<{ primera: boolean }> {
      return transaccion(db, async (q) => {
        const { rows } = await q.query("select linea, lote, etapa, respondio from outreach_contactos where id = $1 for update", [id]);
        const r = rows[0];
        if (!r) return { primera: false };
        // Un reintento de Chatwoot (el mismo mensaje) no se anota dos veces.
        const clave = o.mensaje != null ? `respuesta-${o.mensaje}` : null;
        if (clave && (await q.query("select 1 from outreach_eventos where clave = $1", [clave])).rows.length) return { primera: false };
        await q.query("insert into outreach_eventos (linea, contacto, lote, tipo, clave, detalle, creado) values ($1, $2, $3, 'respuesta', $4, $5, $6)", [
          r.linea,
          id,
          r.lote,
          clave,
          o.clasificacion,
          ahora,
        ]);
        if (o.clasificacion === "automatica") {
          await q.query("update outreach_contactos set conversacion = coalesce(conversacion, $2), actualizado = $3 where id = $1", [id, o.conversacion, ahora]);
          return { primera: false };
        }
        if (o.clasificacion === "no" || o.clasificacion === "equivocado") {
          await q.query(
            `update outreach_contactos set etapa = $2, motivo = $3, proxima_accion = null, conversacion = coalesce(conversacion, $4),
               respondio = coalesce(respondio, $5), actualizado = $5 where id = $1 and etapa not in ('baja')`,
            [id, o.clasificacion === "no" ? "cerrado" : "invalido", o.clasificacion === "no" ? "dijo que no" : "número equivocado", o.conversacion, ahora],
          );
          return { primera: false };
        }
        const primera = r.respondio == null;
        await q.query(
          `update outreach_contactos set etapa = case when etapa in ('por_contactar', 'saludado') then 'respondio' else etapa end,
             respondio = coalesce(respondio, $2), proxima_accion = null, conversacion = coalesce(conversacion, $3), actualizado = $2 where id = $1`,
          [id, ahora, o.conversacion],
        );
        return { primera };
      });
    },

    async anotarCRM(id: number, crm_contacto_id: string): Promise<void> {
      await db.query("update outreach_contactos set crm_contacto_id = $2 where id = $1", [id, crm_contacto_id]);
    },

    /**
     * Salió un mensaje por la línea (desde WhatsApp Web o el celular) y llegó por Chatwoot: si es
     * el que estaba tomado para ese teléfono, se confirma solo (el agente o la persona no tienen que
     * tocar «Salió»). Devuelve si lo confirmó.
     */
    async confirmarPorChat(linea: string, telefono: string, texto: string, ahora: Date): Promise<boolean> {
      const t = telefonoParaComparar(telefono);
      if (!t) return false;
      const { rows } = await db.query(
        `select c.id, c.toma_clave, c.tomado_por, c.mensajes, c.nombre, c.proyecto, p.nombre as proyecto_nombre
         from outreach_contactos c left join proyectos p on p.id = c.proyecto
         where c.linea = $1 and c.telefono = $2 and c.tomado_hasta > $3 and c.toma_clave is not null`,
        [linea, t, new Date(ahora.getTime() - TOMA_MINUTOS * 60_000)],
      );
      const r = rows[0];
      if (!r) return false;
      const cfg = await config(linea);
      const esperado = textoDelPaso(cfg, Number(r.mensajes), { id: Number(r.id), nombre: r.nombre, proyecto_nombre: r.proyecto_nombre ?? null }).texto;
      const igual = (a: string) => a.replace(/\s+/g, " ").trim();
      if (igual(esperado) !== igual(texto)) return false;
      const c = await this.confirmar(Number(r.id), { clave: r.toma_clave, modo: "computer_use", por: r.tomado_por ?? "WhatsApp", ejecutor: "persona" }, ahora);
      return "ok" in c;
    },

    /** La bandeja «Responder»: quienes respondieron, con su último mensaje. */
    async respuestas(linea: string, limite = 100): Promise<(ContactoOutreach & { lote_nombre: string; conversacion: number | null; ultimo_mensaje: string | null; ultimo_mensaje_fecha: string | null })[]> {
      const { rows } = await db.query(
        `select ${COLUMNAS}, l.nombre as lote_nombre, c.conversacion, m.texto as ultimo_mensaje, m.fecha as ultimo_mensaje_fecha
         from outreach_contactos c join outreach_lotes l on l.id = c.lote
         left join lateral (select texto, fecha from mensajes where conversacion = c.conversacion and rol = 'interesado' order by fecha desc limit 1) m on true
         where c.linea = $1 and c.etapa in ('respondio', 'interesado')
         order by coalesce(m.fecha, c.respondio) desc nulls last limit $2`,
        [linea, Math.min(Math.max(limite, 1), 500)],
      );
      return rows.map((r) => ({
        ...contactoDeFila(r),
        lote_nombre: r.lote_nombre,
        conversacion: r.conversacion == null ? null : Number(r.conversacion),
        ultimo_mensaje: r.ultimo_mensaje ?? null,
        ultimo_mensaje_fecha: iso(r.ultimo_mensaje_fecha),
      }));
    },

    /** El equipo marca cómo siguió: interesado o cerrado (no le interesa). */
    async marcar(id: number, etapa: "interesado" | "cerrado", por: string, ahora: Date): Promise<boolean> {
      const { rows } = await db.query(
        `update outreach_contactos set etapa = $2, motivo = case when $2 = 'cerrado' then 'lo cerró ' || $3 else motivo end, proxima_accion = null, actualizado = $4
         where id = $1 and etapa in ('respondio', 'interesado', 'cerrado') returning linea, lote`,
        [id, etapa, por, ahora],
      );
      return Boolean(rows[0]);
    },

    /** Pidió la baja (por teléfono, para todas las líneas). Lo usa el webhook (paso 3) y el hub. */
    async baja(telefono: string, o: { linea: string | null; origen: string }): Promise<void> {
      const t = telefonoParaComparar(telefono);
      if (!t) return;
      await db.query("insert into bajas (telefono, linea, origen) values ($1, $2, $3) on conflict (telefono) do nothing", [t, o.linea, o.origen]);
      await db.query("update outreach_contactos set etapa = 'baja', motivo = 'pidió que no le escriban más', proxima_accion = null, actualizado = now() where telefono = $1", [t]);
    },
  };
}

async function insertarFila(q: Cliente, linea: string, lote: number, f: FilaRevisada): Promise<number> {
  const { rowCount } = await q.query(
    `insert into outreach_contactos (lote, linea, nombre, telefono, telefono_original, proyecto, proyecto_texto, fecha_consulta, origen, notas, etapa, motivo, crm_etapa)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     on conflict (linea, telefono) where telefono is not null do nothing`,
    [
      lote,
      linea,
      f.nombre,
      f.telefono,
      f.telefono_original,
      f.proyecto,
      f.proyecto_texto,
      f.fecha_consulta,
      f.origen,
      f.notas,
      f.estado === "entra" ? "por_contactar" : "por_revisar",
      f.motivo,
      f.crm_etapa,
    ],
  );
  return rowCount ?? 0;
}

export type DatosOutreach = ReturnType<typeof datosOutreach>;
