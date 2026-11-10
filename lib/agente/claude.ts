import Anthropic from "@anthropic-ai/sdk";
import type { Modelo } from "./agente";

/** Claude Opus 5.5 por defecto. Se puede cambiar con ASISTENTE_MODELO sin tocar código. */
export const MODELO_POR_DEFECTO = "claude-opus-5-5";
/** Esfuerzo: «medium» equilibra calidad y tiempo de respuesta para un chat comercial. */
export const ESFUERZO_POR_DEFECTO = "medium";

type Esfuerzo = "low" | "medium" | "high" | "xhigh" | "max";

/** Se arma desde lib/servicios.ts con lo que eligió elegirIA() (lib/agente/proveedor.ts). */
export function crearModeloClaude({ clave, modelo, esfuerzo }: { clave: string; modelo: string; esfuerzo: string }): Modelo {
  const cliente = new Anthropic({ apiKey: clave, maxRetries: 2, timeout: 90_000 });
  return ({ system, tools, messages }) =>
    cliente.beta.messages.create({
      model: modelo,
      max_tokens: 16000,
      output_config: { effort: esfuerzo as Esfuerzo },
      // Si el modelo rechaza la consulta por sus filtros de seguridad, Anthropic la reintenta en
      // el modelo que recomienda para ese caso, en el mismo pedido.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      tools,
      messages,
    });
}
