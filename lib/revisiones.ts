/**
 * Revisar respuestas reales del asistente (mejora 7 de Axel, 15/11; docs/revisar.md). Puro: cómo
 * se arma el borrador de un ejemplo a partir de una respuesta buena, sin datos personales.
 */

import type { Rol } from "./chatwoot/evento";

export const VEREDICTOS = ["buena", "mala"] as const;
export type Veredicto = (typeof VEREDICTOS)[number];

const QUIEN: Record<Rol, string> = { interesado: "Interesado", bot: "Asistente", persona: "Equipo" };

/**
 * Lo que se propone como ejemplo: lo que venía antes y la respuesta, como diálogo, con el nombre de
 * la persona cambiado por [nombre] y los números largos (teléfonos, DNI) por [número]. Quien revisa
 * lo corrige antes de guardarlo: los ejemplos van a la IA y no llevan datos personales.
 */
export function borradorDeEjemplo(antes: { rol: Rol; texto: string }[], respuesta: string, nombre: string | null): string {
  const nombres = (nombre ?? "")
    .split(/\s+/)
    .map((x) => x.replace(/[^\p{L}]/gu, ""))
    .filter((x) => x.length >= 3);
  const limpiar = (t: string) =>
    nombres.reduce((x, n) => x.replace(new RegExp(`\\b${n}\\b`, "giu"), "[nombre]"), t).replace(/\+?\d[\d\s-]{6,}\d/g, "[número]");
  return [...antes.map((m) => `${QUIEN[m.rol]}: ${limpiar(m.texto)}`), `Asistente: ${limpiar(respuesta)}`].join("\n");
}
