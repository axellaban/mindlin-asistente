/**
 * WAHA, directo (docs/outreach.md, «Los dos modos de envío»): para el outreach el asistente le
 * habla a WAHA sin pasar por Chatwoot. Lo que sale vuelve a Chatwoot solo (la integración de WAHA
 * lo copia como mensaje saliente) y las respuestas entran por el webhook de siempre.
 *
 * Necesita WAHA_URL (la dirección pública de WAHA) y WAHA_API_KEY. Sin ellas, el modo WAHA no está
 * disponible y queda el de computer use.
 */

export interface Waha {
  /** El estado de la sesión: «WORKING» es que está conectada y puede mandar. */
  estado(sesion: string): Promise<string>;
  /** Si el número tiene WhatsApp (no le manda nada). `chatId`: cómo lo llama WhatsApp. */
  existe(sesion: string, telefono: string): Promise<{ existe: boolean; chatId: string | null }>;
  enviarTexto(sesion: string, chatId: string, texto: string): Promise<void>;
}

/** Cuánto se espera a WAHA por pedido. */
const ESPERA_MS = 20_000;

export function wahaDesdeEnv(env: Record<string, string | undefined>, pedir: typeof fetch = fetch): Waha | null {
  const url = env.WAHA_URL?.trim().replace(/\/+$/, "");
  const clave = env.WAHA_API_KEY?.trim();
  if (!url || !/^https?:\/\//.test(url) || !clave) return null;
  const llamar = async (ruta: string, init: RequestInit = {}) => {
    const r = await pedir(`${url}${ruta}`, {
      ...init,
      headers: { "X-Api-Key": clave, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    const cuerpo = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (!r.ok) {
      const detalle = typeof cuerpo?.message === "string" ? `: ${cuerpo.message}` : typeof cuerpo?.error === "string" ? `: ${cuerpo.error}` : "";
      throw new Error(`WAHA respondió ${r.status}${detalle}`);
    }
    return cuerpo ?? {};
  };
  return {
    async estado(sesion) {
      const r = await llamar(`/api/sessions/${encodeURIComponent(sesion)}`);
      return String(r.status ?? "DESCONOCIDO");
    },
    async existe(sesion, telefono) {
      const r = await llamar(`/api/contacts/check-exists?phone=${encodeURIComponent(telefono)}&session=${encodeURIComponent(sesion)}`);
      return { existe: r.numberExists === true, chatId: typeof r.chatId === "string" ? r.chatId : null };
    },
    async enviarTexto(sesion, chatId, texto) {
      await llamar("/api/sendText", { method: "POST", body: JSON.stringify({ session: sesion, chatId, text: texto }) });
    },
  };
}
