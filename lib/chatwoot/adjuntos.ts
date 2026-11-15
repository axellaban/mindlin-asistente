/**
 * Las fotos, los audios y los archivos de una conversación, para verlos adentro del hub (mejora 8
 * de Axel, fase 2 de las conversaciones; docs/arquitectura.md, sección 12). La base del asistente
 * guarda solo el texto («[foto]»): los archivos se le piden a Chatwoot en el momento, solo de la
 * conversación que alguien abrió, con el token de un usuario «Hub» (CHATWOOT_HUB_TOKEN). El del
 * Agent Bot no puede leer el historial. El hub muestra cada archivo con el link de Chatwoot: se ve
 * directo desde el servidor, sin pasar por Vercel.
 */

import { ErrorChatwoot, TIEMPO_MAXIMO_MS } from "./api";

export interface AdjuntoDeMensaje {
  /** El mensaje (el mismo id que en la base del asistente). */
  mensaje: number;
  tipo: "foto" | "audio" | "video" | "archivo";
  url: string;
  miniatura: string | null;
}

export type LectorDeAdjuntos = (conversacion: number) => Promise<AdjuntoDeMensaje[]>;

/** Chatwoot devuelve los mensajes de a 20: hasta 10 páginas (unos 200 mensajes). */
const MAX_PAGINAS = 10;
const TIPO: Record<string, AdjuntoDeMensaje["tipo"]> = { image: "foto", audio: "audio", video: "video", file: "archivo" };

interface MensajeChatwoot {
  id: number;
  private?: boolean;
  attachments?: { file_type?: string; data_url?: string; thumb_url?: string }[] | null;
}

export function lectorDeAdjuntos(env: Record<string, string | undefined>, pedir: typeof fetch = fetch): LectorDeAdjuntos | null {
  const url = env.CHATWOOT_URL?.trim().replace(/\/+$/, "");
  const cuenta = env.CHATWOOT_ACCOUNT_ID?.trim();
  const token = env.CHATWOOT_HUB_TOKEN?.trim();
  if (!url || !/^https?:\/\//.test(url) || !cuenta || !token) return null;
  const origen = new URL(url).origin;
  // Solo links de ese mismo Chatwoot: lo que se muestra en el hub no puede apuntar a otro lado.
  const deChatwoot = (u: string | undefined) => {
    if (!u) return null;
    try {
      return new URL(u).origin === origen ? u : null;
    } catch {
      return null;
    }
  };
  return async (conversacion) => {
    const adjuntos: AdjuntoDeMensaje[] = [];
    let antes: number | null = null;
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const ruta = `/api/v1/accounts/${cuenta}/conversations/${conversacion}/messages${antes ? `?before=${antes}` : ""}`;
      const r = await pedir(`${url}${ruta}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
      if (r.status === 401 || r.status === 403 || r.status === 404) {
        throw new ErrorChatwoot(`Chatwoot no deja leer esa conversación con el usuario «Hub» (${r.status}): revisá que CHATWOOT_HUB_TOKEN sea de un administrador o que esté en esa bandeja.`, r.status);
      }
      if (!r.ok) throw new ErrorChatwoot(`Chatwoot respondió ${r.status} al leer los mensajes.`, r.status);
      const lista = (((await r.json().catch(() => null)) as { payload?: MensajeChatwoot[] } | null)?.payload ?? []).filter((m) => typeof m.id === "number");
      for (const m of lista) {
        if (m.private) continue;
        for (const a of m.attachments ?? []) {
          const tipo = TIPO[a.file_type ?? ""];
          const enlace = deChatwoot(a.data_url);
          if (tipo && enlace) adjuntos.push({ mensaje: m.id, tipo, url: enlace, miniatura: deChatwoot(a.thumb_url) });
        }
      }
      if (lista.length < 20) break;
      antes = Math.min(...lista.map((m) => m.id));
    }
    return adjuntos.sort((a, b) => a.mensaje - b.mensaje);
  };
}
