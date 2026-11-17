/**
 * Las líneas de WhatsApp de Mindlin. Cada número es una bandeja de Chatwoot; el asistente sabe de
 * qué línea es cada mensaje por la bandeja del aviso. Puro (sin red ni base). Ver docs/lineas.md.
 *
 * - Leads entrantes («entrada»): atiende el asistente de ventas (la IA y los flujos).
 * - Outreach frío y la línea del equipo: tienen su propio trabajo (se suma más adelante). Si alguien
 *   escribe ahí, el asistente de ventas no contesta: la conversación pasa al equipo con una nota.
 */

import type { Proyecto } from "./datos/tipos";

export const TIPOS_LINEA = [
  ["entrada", "Leads entrantes", "Responde las consultas de los interesados que escriben: la IA, los flujos y los seguimientos."],
  ["outreach_frio", "Outreach frío", "Le escribe primero a las bases de leads viejas, de a uno y con tope, pausas y franjas. Quien responde entra al CRM y lo atiende el equipo (o la IA, si se elige en Secuencia)."],
  ["equipo", "Equipo, facturas y outreach cálido", "Para el equipo: facturas, recibos, presupuestos y lo que hoy hace el bot de Telegram, más el outreach a contactos conocidos. Se suma al final."],
] as const;

export type TipoLinea = (typeof TIPOS_LINEA)[number][0];
export const esTipoLinea = (x: unknown): x is TipoLinea => TIPOS_LINEA.some(([t]) => t === x);
export const tituloTipoLinea = (t: TipoLinea) => TIPOS_LINEA.find(([x]) => x === t)![1];

export interface Linea {
  id: string;
  orden: number;
  nombre: string;
  tipo: TipoLinea;
  descripcion: string;
  /** El número, para mostrarlo (lo carga Mindlin). */
  telefono: string;
  /** La bandeja de Chatwoot de esta línea. Null: todavía no está conectada. */
  bandeja: number | null;
  /** La de los avisos que no traen bandeja. */
  por_defecto: boolean;
  pausada: boolean;
  /** Modo «presenta y pasa»: cuando la persona responde después de la presentación, sigue el equipo. */
  pasar_al_responder: boolean;
  /** Lo que el asistente tiene que saber de esta línea, además del tono. */
  instrucciones: string;
  /** Qué proyectos atiende en esta línea. Vacía: todos los activos. */
  proyectos: string[];
  /** La campaña de la línea, si el primer mensaje no coincide con ninguna frase (lib/campanias.ts). Vacía: ninguna. */
  campania: string;
}

const fabrica = (l: Pick<Linea, "id" | "orden" | "nombre" | "tipo" | "descripcion"> & Partial<Linea>): Linea => ({
  telefono: "",
  bandeja: null,
  por_defecto: false,
  pausada: false,
  pasar_al_responder: false,
  instrucciones: "",
  proyectos: [],
  campania: "",
  ...l,
});

/** Las cuatro líneas de fábrica (las mismas que carga la migración 202611150011). */
export const LINEAS_DE_FABRICA: Linea[] = [
  fabrica({ id: "linea-1", orden: 1, nombre: "Outreach frío", tipo: "outreach_frio", descripcion: TIPOS_LINEA[1][2] }),
  fabrica({ id: "linea-2", orden: 2, nombre: "Equipo: facturas y outreach cálido", tipo: "equipo", descripcion: TIPOS_LINEA[2][2] }),
  fabrica({ id: "linea-3", orden: 3, nombre: "Leads entrantes", tipo: "entrada", descripcion: "Responde las consultas de los interesados que escriben (la línea que ya atiende el asistente).", bandeja: 1, por_defecto: true }),
  fabrica({ id: "linea-4", orden: 4, nombre: "Leads entrantes 2", tipo: "entrada", descripcion: "Otra línea para consultas de interesados (por ejemplo, otra campaña o zona). Se configura igual que la 3." }),
];

/**
 * La línea de un aviso según su bandeja. Sin bandeja en el aviso, la línea por defecto. Null si la
 * bandeja no es de ninguna línea: el asistente no sabe qué hacer ahí y la pasa al equipo.
 */
export function lineaDeBandeja(lineas: Linea[], bandeja: number | null | undefined): Linea | null {
  if (bandeja == null) return lineas.find((l) => l.por_defecto) ?? null;
  return lineas.find((l) => l.bandeja === bandeja) ?? null;
}

/** Los proyectos que atiende el asistente en esta línea (sin línea, o sin elegir ninguno: todos). */
export function proyectosDeLinea<P extends Pick<Proyecto, "id">>(linea: Pick<Linea, "proyectos"> | null | undefined, proyectos: P[]): P[] {
  if (!linea?.proyectos.length) return proyectos;
  return proyectos.filter((p) => linea.proyectos.includes(p.id));
}

/** La nota para el equipo cuando el asistente de ventas no atiende en esa línea. */
export function notaLineaSinAsistente(linea: Linea | null, bandeja: number | null): string {
  if (!linea) {
    return `🙋 Este mensaje entró por la bandeja ${bandeja ?? "(sin número)"}, que no está asignada a ninguna línea del asistente: atiende el equipo. Para que responda el asistente, asignala en el hub (Comercial → Asistente de WhatsApp → la línea → Conexión).`;
  }
  if (linea.tipo === "outreach_frio") return `🙋 Respuesta en la línea «${linea.nombre}» (outreach frío): el asistente de ventas no atiende esta línea, sigue el equipo.`;
  if (linea.tipo === "equipo") return `🙋 Mensaje en la línea «${linea.nombre}» (la del equipo): el asistente todavía no la atiende, sigue el equipo.`;
  return `⏸️ La línea «${linea.nombre}» está pausada: atiende el equipo. Para que vuelva a responder la IA, reactivá la línea en el hub y, en esta conversación, «Marcar como pendiente».`;
}
