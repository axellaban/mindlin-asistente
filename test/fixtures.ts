import type Anthropic from "@anthropic-ai/sdk";
import type { Proyecto, Tono } from "../lib/datos/tipos";

/** Datos inventados: nada de interesados reales en las pruebas. */
export const lerma = (cambios: Partial<Proyecto> = {}): Proyecto => ({
  id: "lerma-439",
  nombre: "Lerma 439",
  palabras_clave: ["lerma"],
  presentacion: "",
  descripcion: "Edificio de departamentos de 1 a 3 ambientes.",
  ubicacion: "Villa Crespo, CABA.",
  etapa_obra: "En obra.",
  entrega: "",
  tipologias: "2 ambientes de 45 m².",
  precios: "",
  financiacion: "",
  disponibilidad: "",
  amenities: "",
  preguntas_frecuentes: "",
  links: "",
  ...cambios,
});

export const otroProyecto = (): Proyecto => ({ ...lerma(), id: "otro-1", nombre: "Otro 1", ubicacion: "Palermo.", tipologias: "Monoambientes." });

export const tono: Tono = {
  instrucciones: "Sos parte del equipo comercial de Mindlin. Hablás con voseo.",
  criterios_comerciales: "Primero entendé qué busca.",
  cuando_pasar_a_persona: "quiera visitar el proyecto",
};

type Bloque = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

/** Una respuesta de Claude armada a mano. */
export function respuesta(bloques: Bloque[], stop_reason: Anthropic.Beta.BetaMessage["stop_reason"] = bloques.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn") {
  return {
    id: "msg_prueba",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: bloques,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Anthropic.Beta.BetaMessage;
}
