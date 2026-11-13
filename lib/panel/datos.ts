/**
 * Lo que lee y escribe el panel en la base del asistente (Postgres en Neon). Recibe la conexión
 * de afuera: en las pruebas, un Postgres de verdad (lib/panel/datos.test.ts).
 */

import type pg from "pg";
import type { MensajeHistorial } from "../chatwoot/evento";
import type { Anotado, Ejemplo, ReglaSeguimiento, Tono, TipoRegistro } from "../datos/tipos";
import { HORARIO_EQUIPO_DE_FABRICA, horarioValido, type HorarioEquipo } from "../agente/horario";
import { EVENTOS, type Evento } from "../etapas/reglas";
import type { FichaEditable, ReglaNueva } from "./validar";

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
        `select r.id, r.etapa, r.paso, r.dias_sin_respuesta, r.version, r.estado, r.proyecto, r.mensaje,
                count(s.id)::int as enviados, count(s.respondio)::int as respondieron
         from reglas_seguimiento r left join seguimientos_enviados s on s.regla = r.id
         group by r.id
         order by (r.estado = 'archivada'), r.etapa, r.paso, r.proyecto nulls first, r.version`,
      );
      return rows.map((r) => ({ ...r, id: Number(r.id) }));
    },

    /** Una regla nueva. La versión es la siguiente a las que ya hay para esa etapa, paso y proyecto. */
    async agregarRegla(r: ReglaNueva): Promise<number> {
      const { rows } = await db.query(
        `insert into reglas_seguimiento (etapa, paso, dias_sin_respuesta, proyecto, mensaje, estado, version)
         select $1, $2, $3, $4, $5, $6, coalesce(max(version), 0) + 1
         from reglas_seguimiento where etapa = $1 and paso = $2 and proyecto is not distinct from $4
         returning id`,
        [r.etapa, r.paso, r.dias_sin_respuesta, r.proyecto, r.mensaje, r.estado],
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

    async registro({ conversacion, limite = 100 }: { conversacion?: number; limite?: number } = {}): Promise<RegistroPanel[]> {
      const { rows } = await db.query(
        `select fecha, conversacion, tipo, detalle from registro where ($1::bigint is null or conversacion = $1) order by fecha desc, id desc limit $2`,
        [conversacion ?? null, limite],
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
    async resumen(dias = 7): Promise<Record<TipoRegistro, number> & { conversaciones: number }> {
      const { rows } = await db.query(
        `select tipo, count(*)::int as n from registro where fecha > now() - make_interval(days => $1) group by tipo
         union all
         select 'conversaciones', count(distinct conversacion)::int from mensajes where fecha > now() - make_interval(days => $1) and rol = 'interesado'`,
        [dias],
      );
      const base = { respuesta: 0, paso_a_persona: 0, la_tomo_una_persona: 0, volvio_al_bot: 0, seguimiento: 0, crm: 0, etapa: 0, pausa: 0, error: 0, conversaciones: 0 };
      for (const r of rows) base[r.tipo as keyof typeof base] = r.n;
      return base;
    },
  };
}

export type DatosPanel = ReturnType<typeof datosPanel>;
