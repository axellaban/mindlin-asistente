/**
 * El agente: le pasa a Claude las instrucciones, la situación y el historial, ejecuta las
 * herramientas que pide (registrar al interesado, elegir el proyecto, pasar a una persona) y
 * devuelve el texto para mandar.
 *
 * El modelo se recibe de afuera (en las pruebas, uno simulado).
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { MensajeHistorial } from "../chatwoot/evento";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type Tool = Anthropic.Beta.BetaTool;
type ToolUseBlock = Anthropic.Beta.BetaToolUseBlock;
type ToolResultBlockParam = Anthropic.Beta.BetaToolResultBlockParam;

export type Modelo = (pedido: { system: Anthropic.Beta.BetaTextBlockParam[]; tools: Tool[]; messages: MessageParam[] }) => Promise<Anthropic.Beta.BetaMessage>;

export interface DatosRegistro {
  nombre: string;
  para: string;
  ambientes: string;
  presupuesto_usd: string;
  forma_de_pago: string;
  plazo: string;
  /** Opcionales en el tipo: los modelos los mandan siempre (el esquema los exige), las pruebas viejas no. */
  zona?: string;
  busca_desde?: string;
  resumen: string;
}

export interface Herramientas {
  registrarInteresado(d: DatosRegistro): Promise<string>;
  /** Devuelve la ficha del proyecto elegido, o un error si el id no existe. */
  elegirProyecto(id: string): Promise<string>;
}

export interface Resultado {
  texto: string;
  pasarAPersona: { motivo: string; resumen: string } | null;
  /** Por qué terminó: para el registro. */
  fin: "respuesta" | "rechazo" | "sin_texto" | "demasiadas_vueltas" | "demasiado_tiempo" | "cortada";
}

/** Vueltas máximas entre Claude y las herramientas en un mismo mensaje. */
export const MAX_VUELTAS = 5;
/**
 * Pasado este tiempo no se empieza otra vuelta: la conversación pasa al equipo. La función de
 * Vercel corta a los 300 segundos (maxDuration) y cada pedido a la IA puede tardar hasta 60.
 */
export const LIMITE_MS = 150_000;

const texto = (descripcion: string) => ({ type: "string", description: descripcion }) as const;

export function definirHerramientas(proyectos: string[]): Tool[] {
  const tools: Tool[] = [
    {
      name: "registrar_interesado",
      description:
        "Guarda en el CRM de Mindlin lo que sabés de la persona y lo que busca. Usala cuando aparezca un dato nuevo. Completá con \"\" lo que todavía no sabés.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["nombre", "para", "ambientes", "presupuesto_usd", "forma_de_pago", "plazo", "zona", "busca_desde", "resumen"],
        properties: {
          nombre: texto("Nombre y apellido, si lo dijo."),
          para: { type: "string", enum: ["Vivir", "Invertir", "A definir", ""], description: "Para qué busca." },
          ambientes: texto("Cuántos ambientes busca, por ejemplo «2» o «2 o 3»."),
          presupuesto_usd: texto("Presupuesto en dólares, solo el número (por ejemplo «120000»)."),
          forma_de_pago: { type: "string", enum: ["Al costo (cuotas)", "Contado", "A definir", ""], description: "Cómo piensa pagar." },
          plazo: { type: "string", enum: ["Menos de 2 meses", "2 a 6 meses", "Más de 6 meses", "A definir", ""], description: "Cuándo piensa comprar." },
          zona: texto("De dónde es o en qué zona vive, si lo dijo."),
          busca_desde: texto("Hace cuánto está buscando, si lo dijo (por ejemplo «3 meses» o «recién empieza»)."),
          resumen: texto("Qué busca y qué se habló, en una o dos oraciones para el equipo comercial."),
        },
      },
    },
    {
      name: "pasar_a_persona",
      description:
        "Pasa la conversación a una persona del equipo comercial: después de tu mensaje, el asistente deja de responder en esta conversación. Usala cuando lo indiquen las instrucciones.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["motivo", "resumen"],
        properties: {
          motivo: texto("Por qué la pasás, en pocas palabras (por ejemplo «quiere visitar el proyecto»)."),
          resumen: texto("Lo que la persona del equipo necesita saber para seguir: qué busca y qué se le dijo."),
        },
      },
    },
  ];
  if (proyectos.length > 1) {
    tools.push({
      name: "elegir_proyecto",
      description: "Cuando ya sabés por qué proyecto consulta la persona: lo deja anotado y te devuelve su ficha.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["proyecto_id"],
        properties: { proyecto_id: { type: "string", enum: proyectos, description: "El id del proyecto." } },
      },
    });
  }
  return tools;
}

/** Hasta dónde se le pasa cada mensaje a la IA: alguien que pega un texto enorme no dispara el costo. */
export const MAX_LETRAS_MENSAJE = 4000;

/**
 * El historial como mensajes para Claude: el interesado es «user»; el bot y el equipo, «assistant»
 * (lo del equipo, marcado «[Equipo]»). Arranca en el primer mensaje del interesado.
 */
export function mensajesDelHistorial(historial: MensajeHistorial[]): MessageParam[] {
  const desde = historial.findIndex((m) => m.rol === "interesado");
  if (desde < 0) return [];
  return historial.slice(desde).map((m) => ({
    role: m.rol === "interesado" ? "user" : "assistant",
    content: (m.rol === "persona" ? `[Equipo] ${m.texto}` : m.texto).slice(0, MAX_LETRAS_MENSAJE),
  }));
}

const textoDe = (r: Anthropic.Beta.BetaMessage) =>
  r.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

export async function responder({
  modelo,
  instrucciones,
  situacion,
  historial,
  proyectos,
  herramientas,
  reloj = Date.now,
  limiteMs = LIMITE_MS,
}: {
  reloj?: () => number;
  limiteMs?: number;
  modelo: Modelo;
  instrucciones: string;
  situacion: string;
  historial: MensajeHistorial[];
  proyectos: string[];
  herramientas: Herramientas;
}): Promise<Resultado> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: instrucciones, cache_control: { type: "ephemeral" } },
    { type: "text", text: situacion },
  ];
  const tools = definirHerramientas(proyectos);
  const messages = mensajesDelHistorial(historial);
  let pasarAPersona: Resultado["pasarAPersona"] = null;
  // Se manda el último texto que escribió Claude: el de la respuesta final, o el de antes de la
  // última herramienta si después no escribió nada (así no se duplica el mensaje).
  let ultimo = "";

  const inicio = reloj();
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    if (vuelta > 0 && reloj() - inicio > limiteMs) {
      return { texto: ultimo, pasarAPersona: pasarAPersona ?? { motivo: "El asistente tardó demasiado en responder.", resumen: "" }, fin: "demasiado_tiempo" };
    }
    const r = await modelo({ system, tools, messages });
    if (r.stop_reason === "refusal") {
      return { texto: "", pasarAPersona: { motivo: "El asistente no pudo responder esta consulta.", resumen: "" }, fin: "rechazo" };
    }
    // Llegó al tope de largo: el mensaje saldría cortado. Mejor que lo siga el equipo.
    if (r.stop_reason === "max_tokens") {
      return { texto: "", pasarAPersona: pasarAPersona ?? { motivo: "La respuesta del asistente salió demasiado larga.", resumen: "" }, fin: "cortada" };
    }
    const t = textoDe(r);
    if (t) ultimo = t;
    const usos = r.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (r.stop_reason !== "tool_use" || !usos.length) break;

    messages.push({ role: "assistant", content: r.content as Anthropic.Beta.BetaContentBlockParam[] });
    const resultados: ToolResultBlockParam[] = [];
    for (const uso of usos) {
      const entrada = uso.input as Record<string, string>;
      try {
        let contenido: string;
        if (uso.name === "registrar_interesado") contenido = await herramientas.registrarInteresado(entrada as unknown as DatosRegistro);
        else if (uso.name === "elegir_proyecto") contenido = await herramientas.elegirProyecto(entrada.proyecto_id);
        else if (uso.name === "pasar_a_persona") {
          pasarAPersona = { motivo: entrada.motivo ?? "", resumen: entrada.resumen ?? "" };
          contenido = "Listo: cuando mandes tu mensaje, la conversación pasa al equipo. Despedite avisando que alguien le va a escribir.";
        } else throw new Error(`No existe la herramienta ${uso.name}.`);
        resultados.push({ type: "tool_result", tool_use_id: uso.id, content: contenido });
      } catch (e) {
        resultados.push({ type: "tool_result", tool_use_id: uso.id, content: e instanceof Error ? e.message : String(e), is_error: true });
      }
    }
    messages.push({ role: "user", content: resultados });
    if (vuelta === MAX_VUELTAS - 1) return { texto: ultimo, pasarAPersona, fin: "demasiadas_vueltas" };
  }

  return { texto: ultimo, pasarAPersona, fin: ultimo ? "respuesta" : "sin_texto" };
}
