/**
 * Qué IA arma las respuestas: Claude (Anthropic) u OpenAI, según las claves cargadas en Vercel.
 *
 * - ASISTENTE_PROVEEDOR=openai o anthropic lo fija.
 * - Si no está, se usa el que tenga clave. Con las dos claves, Claude.
 *
 * Los audios se transcriben con OpenAI, así que necesitan OPENAI_API_KEY aunque responda Claude.
 * Puro: recibe el entorno.
 */

import { ESFUERZO_POR_DEFECTO, MODELO_POR_DEFECTO } from "./claude";
import { MODELO_OPENAI_POR_DEFECTO, MODELO_TRANSCRIPCION_POR_DEFECTO } from "./openai";

export type Proveedor = "anthropic" | "openai";

export interface EleccionIA {
  proveedor: Proveedor;
  clave: string;
  modelo: string;
  esfuerzo: string;
}

const ESFUERZOS = ["low", "medium", "high", "xhigh", "max"];

export function elegirIA(env: Record<string, string | undefined>): EleccionIA | null {
  const claves: Record<Proveedor, string> = { anthropic: env.ANTHROPIC_API_KEY?.trim() ?? "", openai: env.OPENAI_API_KEY?.trim() ?? "" };
  const pedido = env.ASISTENTE_PROVEEDOR?.trim().toLowerCase();
  const proveedor: Proveedor | null =
    pedido === "openai" || pedido === "anthropic" ? pedido : claves.anthropic ? "anthropic" : claves.openai ? "openai" : null;
  if (!proveedor || !claves[proveedor]) return null;
  const esfuerzo = env.ASISTENTE_ESFUERZO?.trim() ?? "";
  return {
    proveedor,
    clave: claves[proveedor],
    modelo: env.ASISTENTE_MODELO?.trim() || (proveedor === "openai" ? MODELO_OPENAI_POR_DEFECTO : MODELO_POR_DEFECTO),
    esfuerzo: ESFUERZOS.includes(esfuerzo) ? esfuerzo : ESFUERZO_POR_DEFECTO,
  };
}

/** Para transcribir audios hace falta la clave de OpenAI. */
export function eleccionTranscripcion(env: Record<string, string | undefined>): { clave: string; modelo: string } | null {
  const clave = env.OPENAI_API_KEY?.trim();
  if (!clave) return null;
  return { clave, modelo: env.ASISTENTE_MODELO_AUDIOS?.trim() || MODELO_TRANSCRIPCION_POR_DEFECTO };
}

/** Para mostrar en /api/salud y en el panel, sin claves. */
export function describirIA(env: Record<string, string | undefined>): { proveedor: Proveedor | null; modelo: string | null; audios: boolean } {
  const e = elegirIA(env);
  return { proveedor: e?.proveedor ?? null, modelo: e?.modelo ?? null, audios: Boolean(eleccionTranscripcion(env)) };
}
