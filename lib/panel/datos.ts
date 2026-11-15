/**
 * Lo que lee y escribe el panel en la base del asistente (Postgres en Neon). Recibe la conexión
 * de afuera: en las pruebas, un Postgres de verdad (lib/panel/datos.test.ts).
 */

import type pg from "pg";
import type { MensajeHistorial } from "../chatwoot/evento";
import { TIPOS_DEL_EQUIPO, type Anotado, type Ejemplo, type ReglaSeguimiento, type Tono, type TipoRegistro } from "../datos/tipos";
import { HORARIO_EQUIPO_DE_FABRICA, horarioValido, type HorarioEquipo } from "../agente/horario";
import { EVENTOS, type Evento } from "../etapas/reglas";
import { COLUMNAS_LINEA, lineaDeFila } from "../datos/postgres";
import type { Linea } from "../lineas";
import { archivosDe, describirPosicion, type Paso } from "../flujos/modelo";
import { claveTelefono } from "../crm/planilla";
import type { FichaEditable, LineaEditable, ReglaNueva } from "./validar";

type Db = Pick<pg.Pool, "query">;

export interface EjemploPanel extends Ejemplo {
  id: number;
  activo: boolean;
}

export interface ReglaPanel extends ReglaSeguimiento {
  enviados: number;
  respondieron: number;
}

export interface ConversacionPanel {
  chatwoot_id: number;
  nombre: string | null;
  telefono: string | null;
  proyecto: string | null;
  ultimo: string | null;
  ultimo_texto: string | null;
  ultimo_rol: MensajeHistorial["rol"] | null;
  paso_seguimiento: number;
  sin_seguimientos: boolean;
}

export interface DetalleConversacion {
  chatwoot_id: number;
  nombre: string | null;
  telefono: string | null;
  proyecto: string | null;
  crm_contacto_id: string | null;
  interesado: Anotado;
  paso_seguimiento: number;
  sin_seguimientos: boolean;
  ultimo_seguimiento: string | null;
}

/** El flujo de una conversación (la corrida más nueva): por dónde va o cómo terminó. */
export interface FlujoDeConversacion {
  nombre: string;
  estado: "en_curso" | "esperando" | "terminado";
  resultado: string | null;
  /** «Paso 12 › Si no responde › paso 2: Mensaje». */
  paso: string;
  /** Hasta cuándo espera la respuesta (si está esperando). */
  vence: string | null;
  inicio: string;
}

/** Una conversación como la ve el hub (Conversaciones y el CRM). */
export interface ConversacionHub {
  chatwoot_id: number;
  linea: string | null;
  nombre: string | null;
  telefono: string | null;
  proyecto: string | null;
  crm_contacto_id: string | null;
  ultimo: string | null;
  ultimo_texto: string | null;
  ultimo_rol: MensajeHistorial["rol"] | null;
  mensajes: number;
  /** Quién la tiene, según lo último que pasó entre el asistente y el equipo (el registro). */
  atiende: "asistente" | "equipo";
  flujo: FlujoDeConversacion | null;
}

/** Para buscar conversaciones: de una línea, o de un contacto del CRM (por su ID o su teléfono). */
export interface FiltroConversaciones {
  linea?: string | null;
  contacto?: { id?: string | null; telefono?: string | null } | null;
  /** Una sola conversación (su id de Chatwoot). */
  conversacion?: number | null;
  limite?: number;
}

export interface ReglaEtapaPanel {
  evento: Evento;
  titulo: string;
  /** Null: ese evento no mueve a nadie. */
  etapa: string | null;
  actualizado: string | null;
  actualizado_por: string | null;
  /** Cuántos leads movió esta regla en los últimos 30 días. */
  movidos_30_dias: number;
}

export interface LineaPanel extends Linea {
  actualizado: string | null;
  actualizado_por: string | null;
  /** Personas que escribieron por esta línea en los últimos 7 días. */
  conversaciones_7_dias: number;
}

export interface FlujoPanel {
  id: number;
  linea: string;
  nombre: string;
  /** Null: el flujo general de la línea. */
  proyecto: string | null;
  activo: boolean;
  pasos: Paso[];
  actualizado: string | null;
  actualizado_por: string | null;
  /** Con cuántas personas arrancó, cuántas respondieron, cuántas esperan ahora y cuántas pasaron al equipo. */
  corridas: number;
  respondieron: number;
  esperando: number;
  al_equipo: number;
}

export interface FlujoNuevo {
  linea: string;
  nombre: string;
  proyecto: string | null;
  pasos: Paso[];
}

export interface ArchivoPanel {
  id: number;
  nombre: string;
  tipo: string;
  tamano: number;
  creado: string | null;
  creado_por: string | null;
  /** En qué flujos se usa (no se puede borrar mientras se use). */
  en_uso: number[];
}

export interface RegistroPanel {
  fecha: string;
  conversacion: number | null;
  tipo: TipoRegistro;
  detalle: string;
}

const iso = (f: Date | string | null) => (f ? new Date(f).toISOString() : null);

const COLUMNAS_FICHA =
  "id, nombre, activo, palabras_clave, presentacion, descripcion, ubicacion, etapa_obra, entrega, tipologias, precios, financiacion, disponibilidad, amenities, preguntas_frecuentes, links, notas_internas";

export function datosPanel(db: Db) {
  return {
    async proyectos(): Promise<FichaEditable[]> {
      const { rows } = await db.query(`select ${COLUMNAS_FICHA} from proyectos order by activo desc, nombre`);
      return rows as FichaEditable[];
    },

    async proyecto(id: string): Promise<FichaEditable | null> {
      const { rows } = await db.query(`select ${COLUMNAS_FICHA} from proyectos where id = $1`, [id]);
      return (rows[0] as FichaEditable | undefined) ?? null;
    },

    /** Alta o cambio de una ficha. */
    async guardarProyecto(p: FichaEditable, por: string): Promise<void> {
      await db.query(
        `insert into proyectos (${COLUMNAS_FICHA}, actualizado, actualizado_por)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now(), $18)
         on conflict (id) do update set
           nombre = excluded.nombre, activo = excluded.activo, palabras_clave = excluded.palabras_clave,
           presentacion = excluded.presentacion, descripcion = excluded.descripcion, ubicacion = excluded.ubicacion, etapa_obra = excluded.etapa_obra,
           entrega = excluded.entrega, tipologias = excluded.tipologias, precios = excluded.precios,
           financiacion = excluded.financiacion, disponibilidad = excluded.disponibilidad, amenities = excluded.amenities,
           preguntas_frecuentes = excluded.preguntas_frecuentes, links = excluded.links, notas_internas = excluded.notas_internas,
           actualizado = now(), actualizado_por = excluded.actualizado_por`,
        [
          p.id,
          p.nombre,
          p.activo,
          p.palabras_clave,
          p.presentacion,
          p.descripcion,
          p.ubicacion,
          p.etapa_obra,
          p.entrega,
          p.tipologias,
          p.precios,
          p.financiacion,
          p.disponibilidad,
          p.amenities,
          p.preguntas_frecuentes,
          p.links,
          p.notas_internas,
          por,
        ],
      );
    },

    async tono(): Promise<Tono & { horario_equipo: HorarioEquipo; actualizado: string | null; actualizado_por: string | null }> {
      const { rows } = await db.query(
        "select instrucciones, criterios_comerciales, cuando_pasar_a_persona, pasar_al_responder, sobre_la_empresa, objeciones, horario_equipo, actualizado, actualizado_por from tono where id = 1",
      );
      const t = rows[0];
      return t
        ? { ...t, horario_equipo: horarioValido(t.horario_equipo) ?? HORARIO_EQUIPO_DE_FABRICA, actualizado: iso(t.actualizado) }
        : {
            instrucciones: "",
            criterios_comerciales: "",
            cuando_pasar_a_persona: "",
            pasar_al_responder: false,
            sobre_la_empresa: "",
            objeciones: "",
            horario_equipo: HORARIO_EQUIPO_DE_FABRICA,
            actualizado: null,
            actualizado_por: null,
          };
    },

    async guardarTono(t: Tono, por: string): Promise<void> {
      await db.query(
        `insert into tono (id, instrucciones, criterios_comerciales, cuando_pasar_a_persona, pasar_al_responder, sobre_la_empresa, objeciones, horario_equipo, actualizado, actualizado_por)
         values (1, $1, $2, $3, $4, $5, $6, $7, now(), $8)
         on conflict (id) do update set instrucciones = excluded.instrucciones, criterios_comerciales = excluded.criterios_comerciales,
           cuando_pasar_a_persona = excluded.cuando_pasar_a_persona, pasar_al_responder = excluded.pasar_al_responder,
           sobre_la_empresa = excluded.sobre_la_empresa, objeciones = excluded.objeciones, horario_equipo = excluded.horario_equipo,
           actualizado = now(), actualizado_por = excluded.actualizado_por`,
        [
          t.instrucciones,
          t.criterios_comerciales,
          t.cuando_pasar_a_persona,
          t.pasar_al_responder === true,
          t.sobre_la_empresa ?? "",
          t.objeciones ?? "",
          // jsonb: va como texto JSON.
          JSON.stringify(horarioValido(t.horario_equipo) ?? HORARIO_EQUIPO_DE_FABRICA),
          por,
        ],
      );
    },

    async ejemplos(): Promise<EjemploPanel[]> {
      const { rows } = await db.query("select id, titulo, conversacion, activo from ejemplos order by id");
      return rows.map((r) => ({ ...r, id: Number(r.id) }));
    },

    async agregarEjemplo(e: { titulo: string; conversacion: string }): Promise<void> {
      await db.query("insert into ejemplos (titulo, conversacion) values ($1, $2)", [e.titulo, e.conversacion]);
    },

    async activarEjemplo(id: number, activo: boolean): Promise<void> {
      await db.query("update ejemplos set activo = $2 where id = $1", [id, activo]);
    },

    async borrarEjemplo(id: number): Promise<void> {
      await db.query("delete from ejemplos where id = $1", [id]);
    },

    /** Las reglas de etapas: una por evento, en el orden de EVENTOS, con cuántas veces movió a alguien. */
    async etapas(): Promise<ReglaEtapaPanel[]> {
      const [{ rows }, { rows: usos }] = await Promise.all([
        db.query("select evento, etapa, actualizado, actualizado_por from reglas_etapa"),
        db.query("select datos->>'evento' as evento, count(*)::int as n from registro where tipo = 'etapa' and fecha > now() - interval '30 days' group by 1"),
      ]);
      const guardadas = new Map(rows.map((r) => [r.evento as string, r]));
      const movidos = new Map(usos.map((u) => [u.evento as string, u.n as number]));
      return EVENTOS.map(([evento, titulo]) => {
        const g = guardadas.get(evento);
        return { evento, titulo, etapa: g?.etapa ?? null, actualizado: iso(g?.actualizado ?? null), actualizado_por: g?.actualizado_por ?? null, movidos_30_dias: movidos.get(evento) ?? 0 };
      });
    },

    async guardarEtapa(evento: Evento, etapa: string | null, por: string): Promise<void> {
      await db.query(
        `insert into reglas_etapa (evento, etapa, actualizado, actualizado_por) values ($1, $2, now(), $3)
         on conflict (evento) do update set etapa = excluded.etapa, actualizado = now(), actualizado_por = excluded.actualizado_por`,
        [evento, etapa, por],
      );
    },

    /** Las reglas con cuántos seguimientos salieron y cuántos respondieron. */
    async reglas(): Promise<ReglaPanel[]> {
      const { rows } = await db.query(
        `select r.id, r.etapa, r.paso, r.dias_sin_respuesta, r.version, r.estado, r.proyecto, r.mensaje, r.linea,
                count(s.id)::int as enviados, count(s.respondio)::int as respondieron
         from reglas_seguimiento r left join seguimientos_enviados s on s.regla = r.id
         group by r.id
         order by (r.estado = 'archivada'), r.etapa, r.paso, r.linea nulls first, r.proyecto nulls first, r.version`,
      );
      return rows.map((r) => ({ ...r, id: Number(r.id) }));
    },

    /** Una regla nueva. La versión es la siguiente a las que ya hay para esa etapa, paso y proyecto. */
    async agregarRegla(r: ReglaNueva): Promise<number> {
      const { rows } = await db.query(
        `insert into reglas_seguimiento (etapa, paso, dias_sin_respuesta, proyecto, mensaje, estado, linea, version)
         select $1, $2, $3, $4, $5, $6, $7, coalesce(max(version), 0) + 1
         from reglas_seguimiento where etapa = $1 and paso = $2 and proyecto is not distinct from $4 and linea is not distinct from $7
         returning id`,
        [r.etapa, r.paso, r.dias_sin_respuesta, r.proyecto, r.mensaje, r.estado, r.linea ?? null],
      );
      return Number(rows[0].id);
    },

    async cambiarEstadoRegla(id: number, estado: ReglaSeguimiento["estado"]): Promise<void> {
      await db.query("update reglas_seguimiento set estado = $2, editado = now() where id = $1", [id, estado]);
    },

    /** Solo se borran las que nunca se mandaron (si no, se pierde la medición): las demás se archivan. */
    async borrarRegla(id: number): Promise<boolean> {
      const { rowCount } = await db.query("delete from reglas_seguimiento r where id = $1 and not exists (select 1 from seguimientos_enviados s where s.regla = r.id)", [id]);
      return rowCount === 1;
    },

    async lineas(): Promise<LineaPanel[]> {
      const { rows } = await db.query(
        `select ${COLUMNAS_LINEA.split(", ").map((c) => `l.${c}`).join(", ")}, l.actualizado, l.actualizado_por,
                (select count(distinct m.conversacion)::int from mensajes m join conversaciones c on c.chatwoot_id = m.conversacion
                 where c.linea = l.id and m.rol = 'interesado' and m.fecha > now() - interval '7 days') as conversaciones_7_dias
         from lineas l order by l.orden`,
      );
      return rows.map((r) => ({ ...lineaDeFila(r), actualizado: iso(r.actualizado), actualizado_por: r.actualizado_por ?? null, conversaciones_7_dias: Number(r.conversaciones_7_dias ?? 0) }));
    },

    async linea(id: string): Promise<LineaPanel | null> {
      return (await this.lineas()).find((l) => l.id === id) ?? null;
    },

    /**
     * Cambia lo que se configura de una línea (no su tipo ni su número de orden). Si la bandeja ya es
     * de otra línea, falla con «23505» (la base no deja dos líneas en la misma bandeja).
     */
    async guardarLinea(id: string, l: LineaEditable, por: string): Promise<void> {
      await db.query(
        `update lineas set nombre = $2, descripcion = $3, telefono = $4, bandeja = $5, pausada = $6, pasar_al_responder = $7, instrucciones = $8, proyectos = $9,
                actualizado = now(), actualizado_por = $10
         where id = $1`,
        [id, l.nombre, l.descripcion, l.telefono, l.bandeja, l.pausada, l.pasar_al_responder, l.instrucciones, l.proyectos, por],
      );
    },

    async flujos(linea?: string | null): Promise<FlujoPanel[]> {
      const { rows } = await db.query(
        `select f.id, f.linea, f.nombre, f.proyecto, f.activo, f.pasos, f.actualizado, f.actualizado_por,
                count(c.id)::int as corridas, count(c.respondio)::int as respondieron,
                count(c.id) filter (where c.estado = 'esperando')::int as esperando,
                count(c.id) filter (where c.resultado = 'equipo')::int as al_equipo
         from flujos f left join flujo_corridas c on c.flujo = f.id
         where ($1::text is null or f.linea = $1)
         group by f.id
         order by f.linea, f.activo desc, f.proyecto nulls first, f.nombre`,
        [linea ?? null],
      );
      return rows.map((r) => ({ ...r, id: Number(r.id), proyecto: r.proyecto ?? null, actualizado: iso(r.actualizado) }));
    },

    async flujo(id: number): Promise<FlujoPanel | null> {
      return (await this.flujos()).find((f) => f.id === id) ?? null;
    },

    /** Un flujo nuevo (apagado: se prende aparte, para revisarlo antes). Devuelve su id. */
    async agregarFlujo(f: FlujoNuevo, por: string): Promise<number> {
      const { rows } = await db.query("insert into flujos (linea, nombre, proyecto, pasos, actualizado_por) values ($1, $2, $3, $4, $5) returning id", [
        f.linea,
        f.nombre,
        f.proyecto,
        JSON.stringify(f.pasos),
        por,
      ]);
      return Number(rows[0].id);
    },

    /** Cambia un flujo. Las conversaciones que ya lo empezaron siguen con los pasos que tenía. */
    async guardarFlujo(id: number, f: Omit<FlujoNuevo, "linea">, por: string): Promise<boolean> {
      const { rowCount } = await db.query("update flujos set nombre = $2, proyecto = $3, pasos = $4, actualizado = now(), actualizado_por = $5 where id = $1", [
        id,
        f.nombre,
        f.proyecto,
        JSON.stringify(f.pasos),
        por,
      ]);
      return rowCount === 1;
    },

    /**
     * Prende o apaga un flujo. Al prenderlo se apaga el que estaba activo para lo mismo (la misma
     * línea y el mismo proyecto, o el general): hay uno solo activo por vez.
     */
    async activarFlujo(id: number, activo: boolean, por: string): Promise<boolean> {
      if (activo) {
        await db.query(
          `update flujos o set activo = false, actualizado = now(), actualizado_por = $2
           from flujos f where f.id = $1 and o.id <> f.id and o.activo and o.linea = f.linea and coalesce(o.proyecto, '') = coalesce(f.proyecto, '')`,
          [id, por],
        );
      }
      const { rowCount } = await db.query("update flujos set activo = $2, actualizado = now(), actualizado_por = $3 where id = $1", [id, activo, por]);
      return rowCount === 1;
    },

    async borrarFlujo(id: number): Promise<boolean> {
      const { rowCount } = await db.query("delete from flujos where id = $1", [id]);
      return rowCount === 1;
    },

    async archivos(): Promise<ArchivoPanel[]> {
      const [{ rows }, flujos] = await Promise.all([db.query("select id, nombre, tipo, tamano, creado, creado_por from archivos order by id desc"), db.query("select id, pasos from flujos")]);
      return rows.map((r) => ({
        id: Number(r.id),
        nombre: r.nombre,
        tipo: r.tipo,
        tamano: Number(r.tamano),
        creado: iso(r.creado),
        creado_por: r.creado_por ?? null,
        en_uso: flujos.rows.filter((f) => archivosDe(f.pasos ?? []).includes(Number(r.id))).map((f) => Number(f.id)),
      }));
    },

    /** El archivo con su contenido en base64 (para escucharlo o verlo en el hub). */
    async archivoConDatos(id: number): Promise<(Omit<ArchivoPanel, "en_uso"> & { datos: string }) | null> {
      const { rows } = await db.query("select id, nombre, tipo, tamano, creado, creado_por, encode(datos, 'base64') as datos from archivos where id = $1", [id]);
      const r = rows[0];
      return r ? { id: Number(r.id), nombre: r.nombre, tipo: r.tipo, tamano: Number(r.tamano), creado: iso(r.creado), creado_por: r.creado_por ?? null, datos: r.datos.replace(/\s+/g, "") } : null;
    },

    async subirArchivo(a: { nombre: string; tipo: string; datos: Uint8Array }, por: string): Promise<number> {
      const { rows } = await db.query("insert into archivos (nombre, tipo, tamano, datos, creado_por) values ($1, $2, $3, $4, $5) returning id", [
        a.nombre,
        a.tipo,
        a.datos.byteLength,
        Buffer.from(a.datos),
        por,
      ]);
      return Number(rows[0].id);
    },

    /** Solo si ningún flujo lo usa. */
    async borrarArchivo(id: number): Promise<boolean> {
      if ((await this.archivos()).find((a) => a.id === id)?.en_uso.length) return false;
      const { rowCount } = await db.query("delete from archivos where id = $1", [id]);
      return rowCount === 1;
    },

    async conversaciones(limite = 100): Promise<ConversacionPanel[]> {
      const { rows } = await db.query(
        `select c.chatwoot_id, c.nombre, c.telefono, c.proyecto, c.paso_seguimiento, c.sin_seguimientos, m.fecha as ultimo, m.texto as ultimo_texto, m.rol as ultimo_rol
         from conversaciones c
         left join lateral (select fecha, texto, rol from mensajes where conversacion = c.chatwoot_id order by fecha desc, id desc limit 1) m on true
         order by coalesce(m.fecha, c.actualizada) desc
         limit $1`,
        [limite],
      );
      return rows.map((r) => ({ ...r, chatwoot_id: Number(r.chatwoot_id), ultimo: iso(r.ultimo) }));
    },

    /**
     * Las conversaciones para el hub, la más reciente primero: con su línea, el último mensaje,
     * cuántos hay, quién la atiende y el flujo. Una consulta, sin pasar por Chatwoot.
     */
    async conversacionesHub({ linea = null, contacto = null, conversacion = null, limite = 200 }: FiltroConversaciones = {}): Promise<ConversacionHub[]> {
      const id = contacto?.id?.trim() || null;
      // Por teléfono: los últimos 10 números, como compara el CRM (claveTelefono).
      const tel = contacto?.telefono ? claveTelefono(contacto.telefono) : "";
      const telefono = tel.length >= 8 ? tel : null;
      if (contacto && !id && !telefono) return [];
      const { rows } = await db.query(
        `select c.chatwoot_id, c.linea, c.nombre, c.telefono, c.proyecto, c.crm_contacto_id,
                m.fecha as ultimo, m.texto as ultimo_texto, m.rol as ultimo_rol,
                (select count(*) from mensajes x where x.conversacion = c.chatwoot_id) as cantidad,
                e.tipo as equipo,
                f.nombre as flujo_nombre, f.estado as flujo_estado, f.resultado as flujo_resultado, f.posicion as flujo_posicion,
                f.pasos as flujo_pasos, f.vence as flujo_vence, f.inicio as flujo_inicio
         from conversaciones c
         left join lateral (select fecha, texto, rol from mensajes where conversacion = c.chatwoot_id order by fecha desc, id desc limit 1) m on true
         left join lateral (select tipo from registro where conversacion = c.chatwoot_id and tipo = any($5::text[]) order by fecha desc, id desc limit 1) e on true
         left join lateral (select nombre, estado, resultado, posicion, pasos, vence, inicio from flujo_corridas where conversacion = c.chatwoot_id order by inicio desc, id desc limit 1) f on true
         where ($2::text is null or c.linea = $2)
           and ($3::text is null and $4::text is null
                or c.crm_contacto_id = $3
                or ($4::text is not null and right(regexp_replace(coalesce(c.telefono, ''), '[^0-9]', '', 'g'), 10) = $4))
           and ($6::bigint is null or c.chatwoot_id = $6)
         order by coalesce(m.fecha, c.actualizada) desc
         limit $1`,
        [Math.min(Math.max(limite, 1), 500), linea, id, telefono, TIPOS_DEL_EQUIPO, conversacion],
      );
      return rows.map((r) => ({
        chatwoot_id: Number(r.chatwoot_id),
        linea: r.linea ?? null,
        nombre: r.nombre ?? null,
        telefono: r.telefono ?? null,
        proyecto: r.proyecto ?? null,
        crm_contacto_id: r.crm_contacto_id ?? null,
        ultimo: iso(r.ultimo),
        ultimo_texto: r.ultimo_texto ?? null,
        ultimo_rol: r.ultimo_rol ?? null,
        mensajes: Number(r.cantidad ?? 0),
        atiende: r.equipo === "paso_a_persona" || r.equipo === "la_tomo_una_persona" ? "equipo" : "asistente",
        flujo: r.flujo_nombre
          ? {
              nombre: r.flujo_nombre,
              estado: r.flujo_estado,
              resultado: r.flujo_resultado ?? null,
              paso: r.flujo_estado === "terminado" ? "Terminó" : describirPosicion(r.flujo_pasos ?? [], r.flujo_posicion),
              vence: r.flujo_estado === "esperando" ? iso(r.flujo_vence) : null,
              inicio: iso(r.flujo_inicio)!,
            }
          : null,
      }));
    },

    async conversacion(id: number): Promise<DetalleConversacion | null> {
      const { rows } = await db.query(
        "select chatwoot_id, nombre, telefono, proyecto, crm_contacto_id, interesado, paso_seguimiento, sin_seguimientos, ultimo_seguimiento from conversaciones where chatwoot_id = $1",
        [id],
      );
      const r = rows[0];
      return r ? { ...r, chatwoot_id: Number(r.chatwoot_id), interesado: r.interesado ?? {}, ultimo_seguimiento: iso(r.ultimo_seguimiento) } : null;
    },

    async mensajes(conversacion: number, limite = 300): Promise<MensajeHistorial[]> {
      const { rows } = await db.query(
        "select * from (select id, conversacion, rol, texto, fecha from mensajes where conversacion = $1 order by fecha desc, id desc limit $2) m order by fecha, id",
        [conversacion, limite],
      );
      return rows.map((r) => ({ id: Number(r.id), conversacion: Number(r.conversacion), rol: r.rol, texto: r.texto, fecha: iso(r.fecha)! }));
    },

    /** Lo que hizo el asistente, lo último primero. Con `linea`, solo lo de las conversaciones de esa línea. */
    async registro({ conversacion, limite = 100, linea }: { conversacion?: number; limite?: number; linea?: string | null } = {}): Promise<RegistroPanel[]> {
      const { rows } = await db.query(
        `select r.fecha, r.conversacion, r.tipo, r.detalle from registro r
         where ($1::bigint is null or r.conversacion = $1)
           and ($3::text is null or exists (select 1 from conversaciones c where c.chatwoot_id = r.conversacion and c.linea = $3))
         order by r.fecha desc, r.id desc limit $2`,
        [conversacion ?? null, limite, linea ?? null],
      );
      return rows.map((r) => ({ ...r, fecha: iso(r.fecha)!, conversacion: r.conversacion == null ? null : Number(r.conversacion) }));
    },

    async estado(): Promise<{ pausado: boolean; cambiado: string | null; cambiado_por: string | null }> {
      const { rows } = await db.query("select pausado, cambiado, cambiado_por from asistente_estado where id = 1");
      const e = rows[0];
      return e ? { pausado: e.pausado, cambiado: iso(e.cambiado), cambiado_por: e.cambiado_por } : { pausado: false, cambiado: null, cambiado_por: null };
    },

    /** Pausa o reactiva el asistente entero, y lo deja en el registro. */
    async pausar(pausado: boolean, por: string): Promise<void> {
      await db.query(
        `insert into asistente_estado (id, pausado, cambiado, cambiado_por) values (1, $1, now(), $2)
         on conflict (id) do update set pausado = excluded.pausado, cambiado = now(), cambiado_por = excluded.cambiado_por`,
        [pausado, por],
      );
      await db.query("insert into registro (tipo, detalle) values ('pausa', $1)", [pausado ? `${por} pausó el asistente.` : `${por} reactivó el asistente.`]);
    },

    /** Lo último que pasó: el último mensaje de un interesado, la última respuesta y el último error (para el chequeo de conexiones). */
    async ultimaActividad(): Promise<{ ultimo_mensaje: { fecha: string; conversacion: number } | null; ultima_respuesta: RegistroPanel | null; ultimo_error: RegistroPanel | null }> {
      const mensaje = await db.query("select fecha, conversacion from mensajes where rol = 'interesado' order by fecha desc, id desc limit 1");
      const ultimo = async (tipo: TipoRegistro) => {
        const { rows } = await db.query("select fecha, conversacion, tipo, detalle from registro where tipo = $1 order by fecha desc, id desc limit 1", [tipo]);
        const r = rows[0];
        return r ? ({ ...r, fecha: iso(r.fecha)!, conversacion: r.conversacion == null ? null : Number(r.conversacion) } as RegistroPanel) : null;
      };
      const m = mensaje.rows[0];
      return {
        ultimo_mensaje: m ? { fecha: iso(m.fecha)!, conversacion: Number(m.conversacion) } : null,
        ultima_respuesta: await ultimo("respuesta"),
        ultimo_error: await ultimo("error"),
      };
    },

    /** Lo que hizo el bot en los últimos días, por tipo. */
    async resumen(dias = 7, linea: string | null = null): Promise<Record<TipoRegistro, number> & { conversaciones: number }> {
      const { rows } = await db.query(
        `select r.tipo, count(*)::int as n from registro r
         where r.fecha > now() - make_interval(days => $1)
           and ($2::text is null or exists (select 1 from conversaciones c where c.chatwoot_id = r.conversacion and c.linea = $2))
         group by r.tipo
         union all
         select 'conversaciones', count(distinct m.conversacion)::int from mensajes m
         where m.fecha > now() - make_interval(days => $1) and m.rol = 'interesado'
           and ($2::text is null or exists (select 1 from conversaciones c where c.chatwoot_id = m.conversacion and c.linea = $2))`,
        [dias, linea],
      );
      const base = { respuesta: 0, paso_a_persona: 0, la_tomo_una_persona: 0, volvio_al_bot: 0, seguimiento: 0, crm: 0, etapa: 0, pausa: 0, flujo: 0, error: 0, conversaciones: 0 };
      for (const r of rows) base[r.tipo as keyof typeof base] = r.n;
      return base;
    },
  };
}

export type DatosPanel = ReturnType<typeof datosPanel>;
