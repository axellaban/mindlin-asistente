/**
 * El aviso al hub cuando el asistente pasa una conversación al equipo (mejora 4 de Axel, 15/11;
 * docs/avisos.md). El hub lo convierte en una notificación (la campanita y el celular) para el
 * responsable del lead en el CRM, con el resumen y el link a su ficha.
 *
 * Necesita HUB_URL (la dirección del hub) y HUB_CLAVE (la misma clave que usa el hub para hablarle
 * al asistente). Sin HUB_URL, no avisa: el equipo ve la conversación abierta en Chatwoot, como antes.
 */

import { enlacesChatwoot } from "./api";

export interface AvisoAlEquipo {
  conversacion: number;
  /** El nombre que anotó el asistente o el de WhatsApp (puede venir vacío). */
  nombre: string;
  telefono: string;
  motivo: string;
  resumen: string;
  /** El responsable del lead en el CRM, como está escrito ahí (el hub lo busca entre sus usuarios). */
  responsable: string;
  /** El ID del contacto en el CRM, para el link a su ficha. */
  contacto: string | null;
  proyecto: string | null;
  /** El nombre de la línea. */
  linea: string | null;
  /** El link a la conversación en Chatwoot. */
  enlace?: string | null;
}

export type AvisarAlEquipo = (a: AvisoAlEquipo) => Promise<void>;

/** Cuánto se espera al hub: el aviso no puede frenar al asistente. */
const ESPERA_MS = 8000;

export function avisoAlHubDesdeEnv(env: Record<string, string | undefined>, pedir: typeof fetch = fetch): AvisarAlEquipo | null {
  const url = env.HUB_URL?.trim().replace(/\/+$/, "");
  const clave = env.HUB_CLAVE?.trim();
  if (!url || !/^https?:\/\//.test(url) || !clave) return null;
  const enlace = enlacesChatwoot(env);
  return async (a) => {
    const r = await pedir(`${url}/api/asistente/aviso`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...a, enlace: a.enlace ?? enlace?.(a.conversacion) ?? null }),
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!r.ok) {
      const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
      throw new Error(`el hub respondió ${r.status}${cuerpo?.error ? `: ${cuerpo.error}` : ""}`);
    }
  };
}
