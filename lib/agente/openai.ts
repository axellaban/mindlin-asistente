/**
 * OpenAI como alternativa a Claude, con la misma forma de pedido y respuesta que usa el agente.
 *
 * El agente (agente.ts) arma los pedidos con la forma de la API de Anthropic. Este adaptador los
 * traduce a la API «Responses» de OpenAI (la que admite herramientas con todos sus modelos nuevos)
 * y traduce la respuesta de vuelta. Así el resto del asistente no cambia según el proveedor.
 *
 * Sin dependencias: habla con la API por fetch. Puro salvo por el pedido de red, que se recibe de
 * afuera (en las pruebas, uno simulado).
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { Modelo } from "./agente";

/** GPT-6.1 Sol: la opción de menor costo de la familia GPT-6, que OpenAI recomienda para producción. */
export const MODELO_OPENAI_POR_DEFECTO = "gpt-6.1-sol";
/** El modelo que reemplaza a whisper-1 y gpt-4o-transcribe (que dejan de andar el 26/02/2027). */
export const MODELO_TRANSCRIPCION_POR_DEFECTO = "gpt-transcribe";

const URL_OPENAI = "https://api.openai.com/v1";

type Pedido = Parameters<Modelo>[0];
type Mensaje = Anthropic.Beta.BetaMessage;

/** Un ítem de entrada o de salida de la API Responses (solo los campos que se usan). */
export type ItemOpenAI = Record<string, unknown> & { type?: string };

export interface RespuestaOpenAI {
  id?: string;
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: ItemOpenAI[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Lo que usa el agente («low» a «max») en lo que entiende OpenAI. */
export function esfuerzoOpenAI(esfuerzo: string): "low" | "medium" | "high" {
  if (esfuerzo === "low") return "low";
  if (esfuerzo === "high" || esfuerzo === "xhigh" || esfuerzo === "max") return "high";
  return "medium";
}

/**
 * Las salidas crudas de OpenAI de cada vuelta con herramientas, por id de llamada. Se devuelven tal
 * cual en la vuelta siguiente (con el razonamiento cifrado), como pide OpenAI.
 */
export type Crudos = Map<string, ItemOpenAI[]>;
const MAX_CRUDOS = 200;

/** El pedido del agente (forma Anthropic) como cuerpo para POST /v1/responses. */
export function pedidoOpenAI(p: Pedido, { modelo, esfuerzo, crudos = new Map() }: { modelo: string; esfuerzo: string; crudos?: Crudos }): Record<string, unknown> {
  const input: ItemOpenAI[] = [];
  for (const m of p.messages) {
    if (typeof m.content === "string") {
      input.push({ role: m.role, content: m.content });
      continue;
    }
    const bloques = m.content as Anthropic.Beta.BetaContentBlockParam[];
    // Una vuelta con herramientas que vino de OpenAI: se devuelve la salida original entera.
    const llamada = bloques.find((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === "tool_use");
    const original = llamada && crudos.get(llamada.id);
    if (m.role === "assistant" && original) {
      input.push(...original);
      continue;
    }
    for (const b of bloques) {
      if (b.type === "text") input.push({ role: m.role, content: b.text });
      else if (b.type === "tool_use") input.push({ type: "function_call", call_id: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}) });
      else if (b.type === "tool_result") {
        const salida = typeof b.content === "string" ? b.content : (b.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
        input.push({ type: "function_call_output", call_id: b.tool_use_id, output: b.is_error ? `Error: ${salida}` : salida });
      }
    }
  }
  return {
    model: modelo,
    instructions: p.system.map((s) => s.text).join("\n\n"),
    input,
    tools: p.tools.map((t) => ({ type: "function", name: t.name, description: t.description ?? "", parameters: t.input_schema, strict: t.strict ?? false })),
    reasoning: { effort: esfuerzoOpenAI(esfuerzo) },
    max_output_tokens: 16000,
    // No se guarda nada en OpenAI: el historial vive en la base del asistente.
    store: false,
    include: ["reasoning.encrypted_content"],
  };
}

/** La respuesta de OpenAI con la forma de un mensaje de Claude (texto, herramientas, por qué terminó). */
export function respuestaDeOpenAI(r: RespuestaOpenAI, crudos: Crudos = new Map()): Mensaje {
  const salida = r.output ?? [];
  const content: unknown[] = [];
  let rechazo = false;
  for (const item of salida) {
    if (item.type === "message") {
      for (const c of (item.content as { type?: string; text?: string }[] | undefined) ?? []) {
        if (c.type === "output_text" && c.text) content.push({ type: "text", text: c.text, citations: null });
        if (c.type === "refusal") rechazo = true;
      }
    } else if (item.type === "function_call") {
      let input: unknown = {};
      try {
        input = JSON.parse(String(item.arguments ?? "{}"));
      } catch {
        input = {};
      }
      content.push({ type: "tool_use", id: String(item.call_id), name: String(item.name), input });
    }
  }
  const llamadas = content.filter((b) => (b as { type: string }).type === "tool_use") as { id: string }[];
  for (const l of llamadas) crudos.set(l.id, salida);
  const hayTexto = content.some((b) => (b as { type: string }).type === "text");
  const stop_reason: Mensaje["stop_reason"] = llamadas.length
    ? "tool_use"
    : rechazo && !hayTexto
      ? "refusal"
      : r.status === "incomplete" && r.incomplete_details?.reason === "max_output_tokens"
        ? "max_tokens"
        : "end_turn";
  return {
    id: r.id ?? "",
    type: "message",
    role: "assistant",
    model: r.model ?? "",
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: r.usage?.input_tokens ?? 0, output_tokens: r.usage?.output_tokens ?? 0 },
  } as unknown as Mensaje;
}

export class ErrorOpenAI extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const reintentable = (status: number) => status === 429 || status >= 500;
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Un POST a la API de OpenAI con un reintento si está saturada o falla (60 segundos cada uno, como Claude). */
async function postOpenAI(pedir: typeof fetch, clave: string, ruta: string, cuerpo: BodyInit, json: boolean, esperar = dormir): Promise<unknown> {
  for (let intento = 0; ; intento++) {
    const r = await pedir(`${URL_OPENAI}${ruta}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, ...(json ? { "Content-Type": "application/json" } : {}) },
      body: cuerpo,
      signal: AbortSignal.timeout(60_000),
    });
    if (r.ok) return r.json();
    if (intento < 1 && reintentable(r.status)) {
      await esperar(1000 * 3 ** intento);
      continue;
    }
    throw new ErrorOpenAI(`OpenAI respondió ${r.status} en ${ruta}: ${(await r.text()).slice(0, 300)}`, r.status);
  }
}

export function crearModeloOpenAI({ clave, modelo, esfuerzo }: { clave: string; modelo: string; esfuerzo: string }, pedir: typeof fetch = fetch, esperar = dormir): Modelo {
  // Vive mientras vive la instancia, compartido entre conversaciones (los ids de llamada no se
  // repiten). Se guardan los últimos MAX_CRUDOS: una vuelta con herramientas dura segundos.
  const crudos: Crudos = new Map();
  return async (p) => {
    const cuerpo = pedidoOpenAI(p, { modelo, esfuerzo, crudos });
    const r = (await postOpenAI(pedir, clave, "/responses", JSON.stringify(cuerpo), true, esperar)) as RespuestaOpenAI;
    const mensaje = respuestaDeOpenAI(r, crudos);
    for (const id of crudos.keys()) {
      if (crudos.size <= MAX_CRUDOS) break;
      crudos.delete(id);
    }
    return mensaje;
  };
}

/** Pasa un audio a texto. Devuelve el texto (vacío si no se entendió nada). */
export type Transcriptor = (audio: Blob, nombreArchivo: string) => Promise<string>;

export function crearTranscriptorOpenAI({ clave, modelo = MODELO_TRANSCRIPCION_POR_DEFECTO }: { clave: string; modelo?: string }, pedir: typeof fetch = fetch, esperar = dormir): Transcriptor {
  return async (audio, nombreArchivo) => {
    const form = new FormData();
    form.append("file", audio, nombreArchivo);
    form.append("model", modelo);
    form.append("language", "es");
    const r = (await postOpenAI(pedir, clave, "/audio/transcriptions", form, false, esperar)) as { text?: string };
    return (r.text ?? "").trim();
  };
}
