/**
 * Lo que el asistente hace en Chatwoot, con el token del Agent Bot: contestar, dejar una nota
 * interna y pasar la conversación a una persona. (Ese token no puede leer el historial: el
 * asistente lo arma con los eventos, ver mensajeParaHistorial.)
 */

export interface ConfigChatwoot {
  url: string;
  cuenta: string;
  token: string;
}

export function configChatwoot(env: Record<string, string | undefined> = process.env): ConfigChatwoot | null {
  const url = env.CHATWOOT_URL?.trim().replace(/\/+$/, "");
  const cuenta = env.CHATWOOT_ACCOUNT_ID?.trim();
  const token = env.CHATWOOT_BOT_TOKEN?.trim();
  return url && cuenta && token ? { url, cuenta, token } : null;
}

export interface Chatwoot {
  /** Manda un mensaje al interesado. Devuelve el id del mensaje en Chatwoot. */
  enviar(conversacion: number, texto: string): Promise<number | null>;
  /** Una nota que solo ve el equipo. */
  notaInterna(conversacion: number, texto: string): Promise<void>;
  /** Pasa la conversación a «abierta»: la atiende una persona y el bot se calla. */
  pasarAPersona(conversacion: number): Promise<void>;
  /** Baja un adjunto (un audio) de un mensaje. Solo de la dirección de Chatwoot y hasta MAX_ADJUNTO_BYTES. */
  bajarAdjunto(url: string): Promise<Blob>;
}

/** 25 MB: el máximo que acepta OpenAI para transcribir. Un audio de WhatsApp de varios minutos pesa mucho menos. */
export const MAX_ADJUNTO_BYTES = 25 * 1024 * 1024;

/** Cuánto esperar a Chatwoot en cada pedido. */
export const TIEMPO_MAXIMO_MS = 20_000;

export class ErrorChatwoot extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function crearChatwoot(cfg: ConfigChatwoot, pedir: typeof fetch = fetch): Chatwoot {
  const base = `${cfg.url}/api/v1/accounts/${cfg.cuenta}/conversations`;
  async function post(ruta: string, cuerpo: unknown): Promise<unknown> {
    const r = await pedir(`${base}${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(cuerpo),
      // Si Chatwoot no contesta, mejor un error a tiempo (pasa al equipo) que colgar la función.
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    if (!r.ok) throw new ErrorChatwoot(`Chatwoot respondió ${r.status} en ${ruta}: ${(await r.text()).slice(0, 300)}`, r.status);
    return r.json().catch(() => null);
  }
  return {
    async enviar(conversacion, texto) {
      const r = (await post(`/${conversacion}/messages`, { content: texto, message_type: "outgoing" })) as { id?: number } | null;
      return r?.id ?? null;
    },
    async notaInterna(conversacion, texto) {
      await post(`/${conversacion}/messages`, { content: texto, message_type: "outgoing", private: true });
    },
    async pasarAPersona(conversacion) {
      await post(`/${conversacion}/toggle_status`, { status: "open" });
    },
    async bajarAdjunto(url) {
      // Solo se baja de Chatwoot: el aviso trae la dirección y no se sigue a cualquier lado.
      let destino: URL;
      try {
        destino = new URL(url, cfg.url);
      } catch {
        throw new ErrorChatwoot(`El adjunto no tiene una dirección válida: ${url.slice(0, 120)}`, 0);
      }
      if (destino.origin !== new URL(cfg.url).origin) throw new ErrorChatwoot(`El adjunto no está en Chatwoot: ${destino.origin}`, 0);
      const r = await pedir(destino.toString(), { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new ErrorChatwoot(`Chatwoot respondió ${r.status} al bajar un adjunto`, r.status);
      const largo = Number(r.headers.get("content-length") ?? 0);
      if (largo > MAX_ADJUNTO_BYTES) throw new ErrorChatwoot("El adjunto es demasiado grande para transcribirlo", 413);
      const blob = await r.blob();
      if (blob.size > MAX_ADJUNTO_BYTES) throw new ErrorChatwoot("El adjunto es demasiado grande para transcribirlo", 413);
      return blob;
    },
  };
}
