/**
 * Cuándo y qué mandar de seguimiento. Puro (sin red ni base).
 *
 * - Solo a quien ya escribió y dejó de responder, mientras la conversación la atiende el bot.
 * - De 9 a 20, hora de Buenos Aires.
 * - Una regla por etapa del CRM y paso (1.º, 2.º… seguimiento), con «días sin respuesta».
 *   Si hay una regla para el proyecto de la conversación, va esa; si no, la general.
 * - Versiones: si para la misma etapa y paso hay varias (la activa y las «a prueba»), a cada
 *   conversación le toca siempre la misma, repartidas por partes iguales. Así se compara cuál
 *   consigue más respuestas.
 * - Tope: no hay regla para el paso siguiente (o se llegó al 5.º) → no se manda más.
 */

import { normalizar } from "../crm/planilla";
import type { CandidatoSeguimiento, ReglaSeguimiento } from "../datos/tipos";

export const HORARIO = { desde: 9, hasta: 20 } as const;
export const MAX_PASOS = 5;
/** Variables que se pueden usar en el mensaje. */
export const VARIABLES = ["{{nombre}}", "{{proyecto}}"] as const;

const HORA_BA = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hourCycle: "h23" });

/** ¿Es horario para escribirle a alguien? (de 9 a 20 en Buenos Aires) */
export function enHorario(ahora: Date): boolean {
  const hora = Number(HORA_BA.format(ahora));
  return hora >= HORARIO.desde && hora < HORARIO.hasta;
}

/** La regla que le toca a esta conversación para el paso siguiente, o null si no hay. */
export function elegirRegla(reglas: ReglaSeguimiento[], c: { etapa: string; paso: number; proyecto: string | null; conversacion: number }): ReglaSeguimiento | null {
  if (c.paso > MAX_PASOS) return null;
  const etapa = normalizar(c.etapa);
  const vigentes = reglas.filter((r) => r.estado !== "archivada" && r.paso === c.paso && normalizar(r.etapa) === etapa);
  const delProyecto = c.proyecto ? vigentes.filter((r) => r.proyecto === c.proyecto) : [];
  const opciones = (delProyecto.length ? delProyecto : vigentes.filter((r) => !r.proyecto)).sort((a, b) => a.version - b.version || a.id - b.id);
  if (!opciones.length) return null;
  return opciones[Math.abs(c.conversacion) % opciones.length];
}

/** ¿Pasaron los días de la regla desde lo último que le mandamos? */
export function pasaronLosDias(c: Pick<CandidatoSeguimiento, "ultima_salida">, r: Pick<ReglaSeguimiento, "dias_sin_respuesta">, ahora: Date): boolean {
  return ahora.getTime() - Date.parse(c.ultima_salida) >= r.dias_sin_respuesta * 86_400_000;
}

/** «ANA maría» → «Ana». */
export function nombreDePila(nombre: string | null | undefined): string {
  const primero = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  // Los nombres que puso el asistente cuando no sabía cómo se llamaba («WhatsApp +54…»), los
  // números y los que empiezan con un emoji no cuentan.
  if (!primero || /^whatsapp$/i.test(primero) || !/^\p{L}/u.test(primero)) return "";
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
}

/** El mensaje con las variables reemplazadas. Sin nombre, «Hola {{nombre}}, …» queda «Hola, …». */
export function textoSeguimiento(mensaje: string, { nombre, proyecto }: { nombre: string; proyecto: string }): string {
  return mensaje
    .replace(/\s*\{\{\s*nombre\s*\}\}/gi, nombre ? ` ${nombre}` : "")
    .replace(/\{\{\s*proyecto\s*\}\}/gi, proyecto || "el proyecto")
    .replace(/^[\s,]+/, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
