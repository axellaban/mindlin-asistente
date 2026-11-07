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
}

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
      headers: { "Content-Type": "application/json", api_access_token: cfg.token },
      body: JSON.stringify(cuerpo),
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
  };
}
