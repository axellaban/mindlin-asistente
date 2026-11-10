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
 * - La conversación «Integración de WhatsApp» que crea WAHA (avisos y QR) → nada.
 * - Cambio de estado de la conversación (el equipo la resolvió, la abrió o la volvió a poner
 *   pendiente) → avisarle al asistente, para frenar o retomar los seguimientos.
 * - Todo lo demás (notas internas, avisos de Chatwoot, conversaciones que ya atiende una
 *   persona, mensajes del propio bot) → nada.
 *
 * Puro (sin red). La forma del evento se confirmó con Chatwoot 4.19.1 (ver docs/chatwoot.md).
 */

export interface Adjunto {
  file_type?: string;
  data_url?: string;
}

export interface ContactoChatwoot {
  id?: number;
  name?: string | null;
  phone_number?: string | null;
  identifier?: string | null;
  custom_attributes?: Record<string, unknown> | null;
}

export interface EventoChatwoot {
  event?: string;
  id?: number;
  content?: string | null;
  /** En los webhooks llega como texto; en algunas respuestas de la API, como número. */
  message_type?: string | number;
  private?: boolean;
  created_at?: string | number;
  sender?: { id?: number; type?: string; name?: string } | null;
  conversation?: { id?: number; status?: string; meta?: { sender?: ContactoChatwoot | null } | null } | null;
  inbox?: { id?: number; name?: string } | null;
  attachments?: Adjunto[] | null;
  /** En los eventos de conversación (conversation_*): el estado actual y el contacto, en la raíz. */
  status?: string;
  meta?: { sender?: ContactoChatwoot | null } | null;
}

/** Los avisos de Chatwoot cuando cambia el estado de una conversación (app/listeners/agent_bot_listener.rb). */
const EVENTOS_DE_ESTADO = ["conversation_status_changed", "conversation_resolved", "conversation_opened"];

export interface Contacto {
  nombre: string;
  telefono: string;
}

export type Accion =
  | {
      tipo: "responder";
      conversacion: number;
      mensaje: number | null;
      texto: string;
      audios: string[];
      /** Los demás adjuntos, como quedan en el historial: «[foto]», «[archivo]»… */
      adjuntos: string[];
      contacto: Contacto;
      bandeja: number | null;
    }
  | { tipo: "la_tomo_una_persona"; conversacion: number }
  /** pending: la atiende el bot; open, resolved o snoozed: el equipo (o ya terminó). */
  | { tipo: "cambio_de_estado"; conversacion: number; estado: string }
  | { tipo: "ignorar"; motivo: string };

/** Quién escribió un mensaje del historial. */
export type Rol = "interesado" | "bot" | "persona";

export interface MensajeHistorial {
  id: number;
  conversacion: number;
  rol: Rol;
  texto: string;
  fecha: string;
}

const TIPOS_DE_MENSAJE = ["incoming", "outgoing", "activity", "template"] as const;

function tipoDeMensaje(t: EventoChatwoot["message_type"]): string | undefined {
  return typeof t === "number" ? TIPOS_DE_MENSAJE[t] : t;
}

/** El bot escribe con su token de Agent Bot: Chatwoot marca esos mensajes con ese tipo de remitente. */
const loMandoElBot = (e: EventoChatwoot) => /^agent_?bot$/i.test(e.sender?.type ?? "");

/** El contacto con el que WAHA manda avisos y el QR a Chatwoot. */
export const CONTACTO_INTEGRACION = "whatsapp.integration";

function esIntegracion(e: EventoChatwoot): boolean {
  const c = e.conversation?.meta?.sender ?? e.meta?.sender;
  return c?.identifier === CONTACTO_INTEGRACION || c?.custom_attributes?.waha_whatsapp_chat_id === CONTACTO_INTEGRACION;
}

function contactoDe(e: EventoChatwoot): Contacto {
  const c = e.conversation?.meta?.sender;
  return { nombre: (c?.name ?? "").trim(), telefono: (c?.phone_number ?? "").replace(/[^\d]/g, "") };
}

const NOMBRE_ADJUNTO: Record<string, string> = { audio: "audio", image: "foto", video: "video", location: "ubicación", contact: "contacto" };
/** Cómo queda un adjunto en el historial: «[foto]», «[audio]», «[archivo]»… */
export const etiquetaAdjunto = (a: Adjunto) => `[${NOMBRE_ADJUNTO[a.file_type ?? ""] ?? "archivo"}]`;

function fechaDe(e: EventoChatwoot): string {
  const f = e.created_at;
  if (typeof f === "number") return new Date(f * 1000).toISOString();
  return f && !Number.isNaN(Date.parse(f)) ? new Date(f).toISOString() : new Date().toISOString();
}

export function accionPara(evento: unknown): Accion {
  if (!evento || typeof evento !== "object") return { tipo: "ignorar", motivo: "no es un evento" };
  const e = evento as EventoChatwoot;
  if (EVENTOS_DE_ESTADO.includes(e.event ?? "")) {
    if (typeof e.id !== "number" || !e.status) return { tipo: "ignorar", motivo: "el aviso no trae la conversación" };
    if (esIntegracion(e)) return { tipo: "ignorar", motivo: "es la conversación de avisos de WAHA" };
    return { tipo: "cambio_de_estado", conversacion: e.id, estado: e.status };
  }
  if (e.event !== "message_created") return { tipo: "ignorar", motivo: "no es un mensaje nuevo" };
  const conversacion = e.conversation?.id;
  if (typeof conversacion !== "number") return { tipo: "ignorar", motivo: "el evento no trae la conversación" };
  if (e.private) return { tipo: "ignorar", motivo: "es una nota interna" };
  if (esIntegracion(e)) return { tipo: "ignorar", motivo: "es la conversación de avisos de WAHA" };

  const pendiente = e.conversation?.status === "pending";
  const tipo = tipoDeMensaje(e.message_type);

  if (tipo === "incoming") {
    if (!pendiente) return { tipo: "ignorar", motivo: "la conversación la atiende una persona" };
    const texto = (e.content ?? "").trim();
    const adjuntos = e.attachments ?? [];
    const audios = adjuntos.filter((a) => a.file_type === "audio" && a.data_url).map((a) => a.data_url!);
    // Una foto o un archivo sin texto también se contesta (pidiendo que lo cuente por escrito).
    if (!texto && !adjuntos.length) return { tipo: "ignorar", motivo: "el mensaje no trae texto ni adjuntos" };
    const otros = adjuntos.filter((a) => !(a.file_type === "audio" && a.data_url)).map(etiquetaAdjunto);
    return { tipo: "responder", conversacion, mensaje: e.id ?? null, texto, audios, adjuntos: otros, contacto: contactoDe(e), bandeja: e.inbox?.id ?? null };
  }

  if (tipo === "outgoing") {
    if (loMandoElBot(e)) return { tipo: "ignorar", motivo: "lo mandó el bot" };
    if (pendiente) return { tipo: "la_tomo_una_persona", conversacion };
    return { tipo: "ignorar", motivo: "la conversación ya la atiende una persona" };
  }

  return { tipo: "ignorar", motivo: "es un aviso de Chatwoot" };
}

/**
 * El mensaje para guardar en el historial del asistente (el bot no puede leer el historial por la
 * API de Chatwoot: lo arma con los eventos). Null si no es un mensaje de una conversación real.
 */
export function mensajeParaHistorial(evento: unknown): MensajeHistorial | null {
  if (!evento || typeof evento !== "object") return null;
  const e = evento as EventoChatwoot;
  if (e.event !== "message_created" || e.private || typeof e.id !== "number") return null;
  const conversacion = e.conversation?.id;
  if (typeof conversacion !== "number" || esIntegracion(e)) return null;
  const tipo = tipoDeMensaje(e.message_type);
  if (tipo !== "incoming" && tipo !== "outgoing") return null;
  const texto = [(e.content ?? "").trim(), ...(e.attachments ?? []).map(etiquetaAdjunto)].filter(Boolean).join(" ");
  if (!texto) return null;
  const rol: Rol = tipo === "incoming" ? "interesado" : loMandoElBot(e) ? "bot" : "persona";
  return { id: e.id, conversacion, rol, texto, fecha: fechaDe(e) };
}
