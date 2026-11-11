/**
 * Etapas automáticas: «cuando pasa esto con el lead, moverlo a esta etapa del CRM». Puro.
 *
 * Las reglas (qué etapa le toca a cada evento) las configura Mindlin desde el hub o el panel.
 * Los cuidados son fijos, para que el asistente nunca le desordene el embudo al equipo:
 * - No toca a quien está en Reserva o Vendido: eso lo decide una persona.
 * - Dentro del embudo solo avanza, nunca retrocede (si el equipo lo puso en Negociación, un
 *   mensaje nuevo no lo vuelve a Seguimiento).
 * - A «En pausa» o «Descartado» solo lo manda desde las primeras etapas (Nuevo, Contacto inicial,
 *   Seguimiento). Si ya hubo visita o negociación, decide el equipo.
 * - Si alguien que estaba en pausa o descartado vuelve a escribir, sí lo reactiva.
 */

import { ETAPAS, normalizar } from "../crm/planilla";

export const EVENTOS = [
  ["primer_contacto", "El asistente le respondió por primera vez"],
  ["respondio", "La persona respondió y la conversación sigue"],
  ["seguimiento_enviado", "Se le mandó un seguimiento porque no respondía"],
  ["respondio_seguimiento", "Respondió a un seguimiento"],
  ["sin_respuesta", "No respondió a ningún seguimiento"],
  ["quiere_visita", "Pidió una visita, una reunión o que la llamen"],
  ["senal_de_compra", "Mostró una señal de compra (una unidad puntual, la reserva, la forma de pago exacta)"],
  ["no_le_interesa", "Dijo que no le interesa o pidió que no le escriban más"],
  ["paso_al_equipo", "El asistente pasó la conversación al equipo"],
] as const;

export type Evento = (typeof EVENTOS)[number][0];
export const esEvento = (x: string): x is Evento => EVENTOS.some(([e]) => e === x);
export const tituloEvento = (e: Evento) => EVENTOS.find(([x]) => x === e)![1];

/** Lo que la IA puede avisar con la herramienta marcar_senal. */
export const SENALES = ["quiere_visita", "senal_de_compra", "no_le_interesa"] as const satisfies readonly Evento[];
export type Senal = (typeof SENALES)[number];

/** A dónde puede mandar el asistente (Nuevo es el punto de partida; Reserva y Vendido los decide una persona). */
export const ETAPAS_DESTINO = ["Contacto inicial", "Seguimiento", "Visita / reunión", "Negociación", "En pausa", "Descartado"] as const;
export type EtapaDestino = (typeof ETAPAS_DESTINO)[number];

/** Null: ese evento no mueve a nadie. */
export type ReglasEtapa = Partial<Record<Evento, string | null>>;

/** Lo que viene de fábrica (lo carga la migración; acá para las pruebas y para «volver a lo de fábrica»). */
export const REGLAS_POR_DEFECTO: Record<Evento, EtapaDestino | null> = {
  primer_contacto: "Contacto inicial",
  respondio: "Seguimiento",
  seguimiento_enviado: null,
  respondio_seguimiento: "Seguimiento",
  sin_respuesta: "En pausa",
  quiere_visita: "Visita / reunión",
  senal_de_compra: null,
  no_le_interesa: "Descartado",
  paso_al_equipo: null,
};

const EMBUDO = ["Nuevo", "Contacto inicial", "Seguimiento", "Visita / reunión", "Negociación", "Reserva"];
const INTOCABLES = ["Reserva", "Vendido"];
const PRIMERAS = ["Nuevo", "Contacto inicial", "Seguimiento"];
const FUERA = ["En pausa", "Descartado"];

const canonica = (t: string) => ETAPAS.find((e) => normalizar(e) === normalizar(t)) ?? null;

/** ¿Se puede pasar de `actual` a `destino` con los cuidados de arriba? Devuelve la etapa de destino o null. */
export function puedeMover(actual: string, destino: string | null | undefined): string | null {
  const a = canonica(actual) ?? "Nuevo";
  const d = destino ? canonica(destino) : null;
  if (!d || d === a || !(ETAPAS_DESTINO as readonly string[]).includes(d)) return null;
  if (INTOCABLES.includes(a)) return null;
  if (FUERA.includes(d)) {
    if (PRIMERAS.includes(a)) return d;
    return a === "En pausa" && d === "Descartado" ? d : null;
  }
  // Destino dentro del embudo: solo hacia adelante; desde pausa o descarte, es una reactivación.
  if (FUERA.includes(a)) return d;
  return EMBUDO.indexOf(d) > EMBUDO.indexOf(a) ? d : null;
}

/**
 * Con todo lo que pasó en un mensaje (en orden), a qué etapa queda el lead y por qué. Null si no
 * hay que mover nada.
 */
export function resolverEtapa(actual: string, eventos: Evento[], reglas: ReglasEtapa): { etapa: string; evento: Evento } | null {
  let etapa: string = canonica(actual) ?? "Nuevo";
  let por: Evento | null = null;
  for (const e of eventos) {
    const d = puedeMover(etapa, reglas[e]);
    if (d) {
      etapa = d;
      por = e;
    }
  }
  return por ? { etapa, evento: por } : null;
}

/** La etapa con la que entra un contacto que da de alta el asistente (ya le habló: es un «primer contacto»). */
export function etapaDeAlta(reglas: ReglasEtapa): string {
  return puedeMover("Nuevo", reglas.primer_contacto) ?? "Nuevo";
}

/** El motivo de descarte del hub que corresponde a cada evento (la lista es la del CRM). */
export const MOTIVO_DE_DESCARTE: Partial<Record<Evento, string>> = { sin_respuesta: "No responde", no_le_interesa: "Otro" };
