import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Modelo } from "./agente";

/** Claude Opus 5.5 por defecto. Se puede cambiar con ASISTENTE_MODELO sin tocar código. */
export const MODELO_POR_DEFECTO = "claude-opus-5-5";
/** Esfuerzo: «medium» equilibra calidad y tiempo de respuesta para un chat comercial. */
export const ESFUERZO_POR_DEFECTO = "medium";

const ESFUERZOS = ["low", "medium", "high", "xhigh", "max"] as const;
type Esfuerzo = (typeof ESFUERZOS)[number];

export function modeloClaude(env: Record<string, string | undefined> = process.env): Modelo | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  const cliente = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 90_000 });
  const model = env.ASISTENTE_MODELO?.trim() || MODELO_POR_DEFECTO;
  const pedido = (env.ASISTENTE_ESFUERZO?.trim() ?? "") as Esfuerzo;
  const effort: Esfuerzo = ESFUERZOS.includes(pedido) ? pedido : ESFUERZO_POR_DEFECTO;
  return ({ system, tools, messages }) =>
    cliente.beta.messages.create({
      model,
      max_tokens: 16000,
      output_config: { effort },
      // Si el modelo rechaza la consulta por sus filtros de seguridad, Anthropic la reintenta en
      // el modelo que recomienda para ese caso, en el mismo pedido.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      tools,
      messages,
    });
}
