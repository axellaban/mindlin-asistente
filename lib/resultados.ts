/**
 * Qué flujo y qué seguimiento venden, no solo cuál responde (mejora 3 de Axel, 15/11;
 * docs/resultados.md). Para cada flujo y cada versión de un seguimiento: a cuántos leads les tocó y
 * cuántos llegaron a Visita / reunión, a Negociación y a Reserva (o Vendido) en el CRM.
 *
 * «Llegó» es la etapa más avanzada que se conoce: la de hoy en el CRM o la más alta a la que lo
 * movió el asistente (queda en su registro). Así cuenta el que pidió una visita y después se cayó.
 * Lo que el equipo movió a mano y después volvió atrás no se ve: el CRM guarda solo la etapa de hoy.
 * Puro (sin red ni base).
 */

import { claveTelefono, normalizar, type ContactoCRM } from "./crm/planilla";

/** Las etapas del embudo, en orden: más adelante, más cerca de la venta. */
const ORDEN = ["Nuevo", "Contacto inicial", "Seguimiento", "Visita / reunión", "Negociación", "Reserva", "Vendido"];
/** Los hitos que se cuentan (Vendido cuenta como Reserva). */
export const HITOS = [
  ["visita", "Visita / reunión"],
  ["negociacion", "Negociación"],
  ["reserva", "Reserva"],
] as const;
export type Hito = (typeof HITOS)[number][0];

/** En qué lugar del embudo está una etapa (-1: fuera del embudo, como En pausa o Descartado). */
export const nivel = (etapa: string | null | undefined) => (etapa ? ORDEN.findIndex((e) => normalizar(e) === normalizar(etapa)) : -1);

export interface Llegadas {
  /** A cuántos leads les tocó (personas distintas). */
  leads: number;
  visita: number;
  negociacion: number;
  reserva: number;
}

/** Un lead que pasó por un flujo o un seguimiento: su etapa de hoy y las que le puso el asistente. */
export interface LeadDeResultado {
  conversacion: number;
  crm_contacto_id: string | null;
  telefono: string | null;
  /** Las etapas a las que lo movió el asistente (registro «etapa»). */
  etapas_asistente: string[];
}

/** El contacto del CRM de un lead: por el ID que anotó el asistente o por el teléfono. */
export function contactoDe(l: Pick<LeadDeResultado, "crm_contacto_id" | "telefono">, porId: Map<string, ContactoCRM>, porTelefono: Map<string, ContactoCRM>): ContactoCRM | null {
  return (l.crm_contacto_id && porId.get(l.crm_contacto_id)) || (l.telefono && claveTelefono(l.telefono).length >= 8 && porTelefono.get(claveTelefono(l.telefono))) || null;
}

/** Cuántos llegaron a cada hito (un lead cuenta una vez, aunque haya pasado dos veces). */
export function contarLlegadas(leads: LeadDeResultado[], contactos: ContactoCRM[]): Llegadas {
  const porId = new Map(contactos.map((c) => [c.id, c]));
  const porTelefono = new Map(contactos.filter((c) => claveTelefono(c.telefono).length >= 8).map((c) => [claveTelefono(c.telefono), c]));
  const mejor = new Map<string, number>();
  for (const l of leads) {
    const c = contactoDe(l, porId, porTelefono);
    const clave = c?.id ?? `conv-${l.conversacion}`;
    const n = Math.max(nivel(c?.etapa), ...l.etapas_asistente.map(nivel), -1);
    mejor.set(clave, Math.max(mejor.get(clave) ?? -1, n));
  }
  const llegaron = (desde: string) => [...mejor.values()].filter((n) => n >= nivel(desde)).length;
  return { leads: mejor.size, visita: llegaron("Visita / reunión"), negociacion: llegaron("Negociación"), reserva: llegaron("Reserva") };
}

/** Agrupa los leads por una clave (el flujo, o la regla y su versión) y cuenta las llegadas de cada grupo. */
export function resultadosPor<K extends string>(filas: (LeadDeResultado & { clave: K })[], contactos: ContactoCRM[]): Map<K, Llegadas> {
  const grupos = new Map<K, LeadDeResultado[]>();
  for (const f of filas) grupos.set(f.clave, [...(grupos.get(f.clave) ?? []), f]);
  return new Map([...grupos].map(([k, ls]) => [k, contarLlegadas(ls, contactos)]));
}
