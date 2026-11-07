/**
 * Qué hacer con cada evento que Chatwoot le manda al Agent Bot.
 *
 * Cómo reparte Chatwoot las conversaciones cuando la bandeja tiene un Agent Bot:
 * - Cada conversación nueva entra como «pendiente» (pending): la atiende el bot.
 * - Cuando pasa a «abierta» (open), la atiende una persona. Chatwoot le sigue mandando
 *   los eventos al bot, así que el bot tiene que mirar el estado y callarse.
 *
 * Reglas:
 * - Mensaje del interesado en una conversación pendiente → el bot responde.
 * - Mensaje saliente que no mandó el bot (una persona escribió desde Chatwoot o desde el
 *   celular de la línea) en una conversación pendiente → la tomó una persona: pasarla a abierta.
 * - Todo lo demás (notas internas, avisos de Chatwoot, conversaciones que ya atiende una
 *   persona, mensajes del propio bot) → nada.
 *
 * Puro (sin red). La forma del evento se armó con la documentación de Chatwoot: hay que
 * confirmarla con un evento real (ver PENDIENTES.md).
 */

export interface Adjunto {
  file_type?: string;
  data_url?: string;
}

export interface EventoChatwoot {
  event?: string;
  id?: number;
  content?: string | null;
  /** En los webhooks llega como texto; en algunas respuestas de la API, como número. */
  message_type?: string | number;
  private?: boolean;
  sender?: { id?: number; type?: string; name?: string } | null;
  conversation?: { id?: number; status?: string } | null;
  attachments?: Adjunto[] | null;
}

export type Accion =
  | { tipo: "responder"; conversacion: number; mensaje: number | null; texto: string; audios: string[] }
  | { tipo: "la_tomo_una_persona"; conversacion: number }
  | { tipo: "ignorar"; motivo: string };

const TIPOS_DE_MENSAJE = ["incoming", "outgoing", "activity", "template"] as const;

function tipoDeMensaje(t: EventoChatwoot["message_type"]): string | undefined {
  return typeof t === "number" ? TIPOS_DE_MENSAJE[t] : t;
}

/** El bot escribe con su token de Agent Bot: Chatwoot marca esos mensajes con ese tipo de remitente. */
const loMandoElBot = (e: EventoChatwoot) => /^agent_?bot$/i.test(e.sender?.type ?? "");

export function accionPara(evento: unknown): Accion {
  if (!evento || typeof evento !== "object") return { tipo: "ignorar", motivo: "no es un evento" };
  const e = evento as EventoChatwoot;
  if (e.event !== "message_created") return { tipo: "ignorar", motivo: "no es un mensaje nuevo" };
  const conversacion = e.conversation?.id;
  if (typeof conversacion !== "number") return { tipo: "ignorar", motivo: "el evento no trae la conversación" };
  if (e.private) return { tipo: "ignorar", motivo: "es una nota interna" };

  const pendiente = e.conversation?.status === "pending";
  const tipo = tipoDeMensaje(e.message_type);

  if (tipo === "incoming") {
    if (!pendiente) return { tipo: "ignorar", motivo: "la conversación la atiende una persona" };
    const texto = (e.content ?? "").trim();
    const audios = (e.attachments ?? []).filter((a) => a.file_type === "audio" && a.data_url).map((a) => a.data_url!);
    if (!texto && !audios.length) return { tipo: "ignorar", motivo: "el mensaje no trae texto ni audio" };
    return { tipo: "responder", conversacion, mensaje: e.id ?? null, texto, audios };
  }

  if (tipo === "outgoing") {
    if (loMandoElBot(e)) return { tipo: "ignorar", motivo: "lo mandó el bot" };
    if (pendiente) return { tipo: "la_tomo_una_persona", conversacion };
    return { tipo: "ignorar", motivo: "la conversación ya la atiende una persona" };
  }

  return { tipo: "ignorar", motivo: "es un aviso de Chatwoot" };
}
