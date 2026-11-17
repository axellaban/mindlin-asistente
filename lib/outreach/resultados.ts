/**
 * Los resultados del outreach (docs/outreach.md, «El embudo y los resultados»): el embudo contra la
 * meta, qué base y qué versión del saludo responden más, y lo que salió cada día.
 *
 * Mismas reglas que en Chapa Labs (Turnia y habita.):
 * - cada paso incluye a los siguientes (el que reservó también cuenta como contactado);
 * - «respondieron» es una respuesta de verdad (las automáticas no cuentan) dentro de los 7 días
 *   del primer mensaje, para comparar bases y versiones;
 * - con menos de 30 casos, «muestra chica»; no hay ganadora automática.
 *
 * Puro: las filas vienen de lib/outreach/datos.ts y las etapas, del CRM.
 */

import { MUESTRA_MINIMA } from "./puntaje";

export const DIAS_RESPUESTA = 7;

/** Lo que se espera de cada paso sobre el anterior (de 0 a 100), y los contactos por semana. */
export interface MetasOutreach {
  contactados_semana: number;
  con_whatsapp: number;
  respondieron: number;
  interesados: number;
  visita: number;
  reserva: number;
}

export const METAS_DE_FABRICA: MetasOutreach = { contactados_semana: 100, con_whatsapp: 70, respondieron: 15, interesados: 35, visita: 30, reserva: 15 };

export interface FilaResultado {
  lote: string;
  tiene_whatsapp: boolean | null;
  /** Cuándo le salió el primer mensaje y con qué versión del saludo. */
  primer_envio: string | null;
  version: number | null;
  /** La primera respuesta de verdad. */
  respondio: string | null;
  etapa: string;
  /** La etapa que tiene hoy en el CRM (si entró). */
  crm_etapa_hoy: string | null;
}

export type Paso = "cargados" | "con_whatsapp" | "contactados" | "respondieron" | "interesados" | "visita" | "reserva";

const VISITA = ["Visita / reunión", "Negociación", "Reserva", "Vendido"];
const RESERVA = ["Reserva", "Vendido"];
const INTERESADO = ["Seguimiento", ...VISITA];

function llego(f: FilaResultado): Record<Paso, boolean> {
  const crm = f.crm_etapa_hoy ?? "";
  const reserva = RESERVA.includes(crm);
  const visita = reserva || VISITA.includes(crm);
  const interesado = visita || INTERESADO.includes(crm) || f.etapa === "interesado";
  const respondio = interesado || f.respondio != null;
  const contactado = respondio || f.primer_envio != null;
  return {
    cargados: true,
    con_whatsapp: contactado || f.tiene_whatsapp === true,
    contactados: contactado,
    respondieron: respondio,
    interesados: interesado,
    visita,
    reserva,
  };
}

const respondioATiempo = (f: FilaResultado) =>
  f.primer_envio != null && f.respondio != null && Date.parse(f.respondio) - Date.parse(f.primer_envio) <= DIAS_RESPUESTA * 86_400_000;

export interface PasoEmbudo {
  paso: Paso;
  cantidad: number;
  /** La conversión sobre el paso anterior (de 0 a 1), o null. */
  conversion: number | null;
  /** La que se espera (de 0 a 1), o null para el primero. */
  meta: number | null;
  /** Por debajo de la meta (con muestra suficiente). */
  bajo: boolean;
}

export function embudo(filas: FilaResultado[], metas: MetasOutreach, o: { semanas: number }): { pasos: PasoEmbudo[]; frena: Paso | null; meta_contactados: number } {
  const orden: Paso[] = ["cargados", "con_whatsapp", "contactados", "respondieron", "interesados", "visita", "reserva"];
  const cuenta = Object.fromEntries(orden.map((p) => [p, 0])) as Record<Paso, number>;
  // «Con WhatsApp» se mide sobre los que ya se sabe si tienen (verificados o contactados): los que
  // nadie revisó todavía no cuentan como «no tiene». Sin esto, una base recién cargada «se frena» ahí.
  let sabidos = 0;
  for (const f of filas) {
    const l = llego(f);
    for (const p of orden) if (l[p]) cuenta[p]++;
    if (l.contactados || f.tiene_whatsapp !== null) sabidos++;
  }
  const metaDe: Partial<Record<Paso, number>> = { con_whatsapp: metas.con_whatsapp, respondieron: metas.respondieron, interesados: metas.interesados, visita: metas.visita, reserva: metas.reserva };
  const pasos = orden.map((paso, i): PasoEmbudo => {
    const antes = paso === "con_whatsapp" ? sabidos : i ? cuenta[orden[i - 1]] : 0;
    // «Contactados» se mide contra la meta semanal, no contra el paso anterior.
    const meta = metaDe[paso] != null ? metaDe[paso]! / 100 : null;
    const conversion = i && antes ? cuenta[paso] / antes : null;
    return { paso, cantidad: cuenta[paso], conversion, meta, bajo: meta != null && conversion != null && antes >= MUESTRA_MINIMA && conversion < meta };
  });
  const meta_contactados = Math.round(metas.contactados_semana * o.semanas);
  return { pasos, frena: pasos.find((p) => p.bajo)?.paso ?? null, meta_contactados };
}

export interface Comparacion {
  clave: string;
  contactados: number;
  respondieron: number;
  tasa: number | null;
  muestra_chica: boolean;
}

/** Qué responde más: por base o por versión del saludo (respuesta dentro de los 7 días del primer mensaje). */
export function comparar(filas: FilaResultado[], por: (f: FilaResultado) => string | null): Comparacion[] {
  const g = new Map<string, Comparacion>();
  for (const f of filas) {
    if (!f.primer_envio) continue;
    const k = por(f);
    if (k == null) continue;
    const c = g.get(k) ?? { clave: k, contactados: 0, respondieron: 0, tasa: null, muestra_chica: true };
    c.contactados++;
    if (respondioATiempo(f)) c.respondieron++;
    g.set(k, c);
  }
  return [...g.values()]
    .map((c) => ({ ...c, tasa: c.contactados ? c.respondieron / c.contactados : null, muestra_chica: c.contactados < MUESTRA_MINIMA }))
    .sort((a, b) => b.contactados - a.contactados);
}

const entero = (x: unknown, min: number, max: number) => {
  const n = Number(x);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Las metas bien armadas (los % de 0 a 100, los contactos por semana de 1 a 2000), o el error. */
export function validarMetas(x: unknown): { metas: MetasOutreach } | { error: string } {
  if (x === undefined) return { metas: METAS_DE_FABRICA };
  if (!x || typeof x !== "object" || Array.isArray(x)) return { error: "Metas: falta." };
  const o = { ...METAS_DE_FABRICA, ...(x as Record<string, unknown>) };
  const semana = entero(o.contactados_semana, 1, 2000);
  if (semana === null) return { error: "Metas: los contactos por semana van de 1 a 2000." };
  const m: MetasOutreach = { ...METAS_DE_FABRICA, contactados_semana: semana };
  for (const k of ["con_whatsapp", "respondieron", "interesados", "visita", "reserva"] as const) {
    const n = entero(o[k], 0, 100);
    if (n === null) return { error: "Metas: cada porcentaje va de 0 a 100." };
    m[k] = n;
  }
  return { metas: m };
}
