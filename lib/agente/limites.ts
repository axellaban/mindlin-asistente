/**
 * Cuándo el asistente deja de contestar en una conversación y se la pasa al equipo, para que no
 * se vuelva cara ni arriesgue el número: un contestador automático que le responde a cada mensaje
 * (un bucle sin fin), o alguien que escribe sin parar. Misma idea que los límites de Turnia,
 * adaptada. Puro: recibe el historial.
 */

import type { MensajeHistorial } from "../chatwoot/evento";

export const LIMITES = {
  /** Mensajes del interesado en la última media hora. */
  rafaga: { mensajes: 25, minutos: 30 },
  /** Respuestas del asistente en la última media hora: más que esto, es casi seguro un bucle. */
  respuestas: { mensajes: 20, minutos: 30 },
  /** El mismo mensaje largo repetido tantas veces es un contestador automático. */
  repetido: { veces: 3, minimoLetras: 15 },
  /** Contestar más rápido que esto después del asistente, tantas veces seguidas, no lo hace una persona. */
  rapido: { segundos: 3, seguidas: 4 },
} as const;

const normal = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Por qué frenar, o null si la conversación está normal. `historial` incluye el mensaje que acaba de llegar. */
export function motivoParaFrenar(historial: MensajeHistorial[], ahora: Date): string | null {
  const desde = (minutos: number) => ahora.getTime() - minutos * 60_000;
  const delInteresado = historial.filter((m) => m.rol === "interesado");

  const ultimo = delInteresado.at(-1);
  if (ultimo) {
    const texto = normal(ultimo.texto);
    if (texto.length >= LIMITES.repetido.minimoLetras && delInteresado.filter((m) => normal(m.texto) === texto).length >= LIMITES.repetido.veces) {
      return "repite el mismo mensaje: puede ser un contestador automático";
    }
  }

  if (delInteresado.filter((m) => Date.parse(m.fecha) >= desde(LIMITES.rafaga.minutos)).length >= LIMITES.rafaga.mensajes) {
    return `escribió más de ${LIMITES.rafaga.mensajes - 1} mensajes en media hora`;
  }

  if (historial.filter((m) => m.rol === "bot" && Date.parse(m.fecha) >= desde(LIMITES.respuestas.minutos)).length >= LIMITES.respuestas.mensajes) {
    return `el asistente ya respondió ${LIMITES.respuestas.mensajes} veces en media hora: puede ser otro bot`;
  }

  // Cuánto tardó en contestar cada vez que le escribió el asistente (el primer mensaje después).
  let seguidas = 0;
  for (let i = historial.length - 1; i > 0; i--) {
    const [antes, despues] = [historial[i - 1], historial[i]];
    if (despues.rol !== "interesado" || antes.rol !== "bot") continue;
    if (Date.parse(despues.fecha) - Date.parse(antes.fecha) > LIMITES.rapido.segundos * 1000) break;
    if (++seguidas >= LIMITES.rapido.seguidas) return "contesta al instante, varias veces seguidas: puede ser otro bot";
  }
  return null;
}
