/**
 * El webhook del Agent Bot: verifica la firma de Chatwoot, guarda el mensaje en el historial y
 * decide qué hacer. Lo que tarda (Claude, el CRM) va en una tarea que corre después de responder:
 * Chatwoot espera la respuesta solo 5 segundos.
 */

import { type Accion, accionPara, mensajeParaHistorial } from "./chatwoot/evento";
import { firmaValida } from "./chatwoot/firma";
import type { Conexiones } from "./servicios";
import { atender, laTomoUnaPersona, pasarPorPausa, type Servicios } from "./agente/servicio";
import { lineaDeBandeja, notaLineaSinAsistente } from "./lineas";

export interface Salida {
  status: number;
  json: Record<string, unknown>;
  tarea?: () => Promise<unknown>;
}

/** Un mensaje del bot que vuelve a entrar como si lo hubiera escrito una persona (eco), dentro de este margen. */
export const MARGEN_ECO_MS = 3 * 60_000;
/**
 * Cuántos mensajes recientes se miran para reconocer el eco. Un flujo puede mandar varios de
 * corrido y el eco del primero llegar después de los demás: con 10, uno de 12 mensajes abría la
 * conversación como si la hubiera tomado una persona.
 */
export const MENSAJES_PARA_ECO = 30;

export async function manejarWebhook(
  cuerpo: string,
  firma: { hora: string | null; firma: string | null },
  { clave, conexiones, opciones = {}, ahoraMs = Date.now() }: { clave: string | undefined; conexiones: Conexiones; opciones?: Partial<Servicios>; ahoraMs?: number },
): Promise<Salida> {
  if (!clave) return { status: 503, json: { error: "Falta CHATWOOT_WEBHOOK_SECRET en Vercel." } };
  if (!firmaValida(cuerpo, firma, clave, ahoraMs)) return { status: 401, json: { error: "Firma inválida." } };
  let evento: unknown;
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return { status: 400, json: { error: "El cuerpo no es JSON." } };
  }

  const { almacen, chatwoot, modelo, crm, transcribir = null, avisarAlEquipo = null } = conexiones;
  const mensaje = mensajeParaHistorial(evento);
  const accion: Accion = accionPara(evento);

  if (mensaje && almacen) {
    if (mensaje.rol === "persona" && (await esEcoDelBot(almacen, mensaje.conversacion, mensaje.texto, ahoraMs))) {
      return { status: 200, json: { accion: "ignorar", motivo: "es el eco de un mensaje del bot" } };
    }
    try {
      await almacen.guardarMensaje(mensaje);
    } catch (e) {
      // Con 500, Chatwoot reintenta el aviso.
      return { status: 500, json: { error: `No se pudo guardar el mensaje: ${e instanceof Error ? e.message : String(e)}` } };
    }
  }

  if (accion.tipo === "ignorar") return { status: 200, json: { accion: "ignorar", motivo: accion.motivo } };

  // El equipo cambió el estado en Chatwoot: si la resolvió o la tomó, no lleva más seguimientos;
  // si la volvió a poner pendiente, se la devolvió al asistente.
  if (accion.tipo === "cambio_de_estado") {
    if (!almacen) return { status: 200, json: { accion: "ignorar", motivo: "falta configurar la base (DATABASE_URL) en Vercel" } };
    try {
      if (accion.estado === "pending") {
        if (await almacen.volvioAlBot(accion.conversacion)) {
          await almacen.registrar({ tipo: "volvio_al_bot", conversacion: accion.conversacion, detalle: "El equipo le devolvió la conversación al asistente (la puso pendiente)." });
        }
      } else {
        await almacen.sinSeguimientos(accion.conversacion);
        // La tomó o la cerró el equipo: si había un flujo andando, se corta.
        await almacen.cancelarCorridas(accion.conversacion).catch(() => {});
      }
    } catch (e) {
      return { status: 500, json: { error: `No se pudo anotar el cambio de estado: ${e instanceof Error ? e.message : String(e)}` } };
    }
    return { status: 200, json: { accion: accion.tipo, estado: accion.estado } };
  }
  if (!chatwoot) return { status: 200, json: { accion: "ignorar", motivo: "falta configurar Chatwoot en Vercel" } };

  if (accion.tipo === "la_tomo_una_persona") {
    if (!almacen) return { status: 200, json: { accion: "ignorar", motivo: "falta configurar la base (DATABASE_URL) en Vercel" } };
    return { status: 200, json: { accion: accion.tipo }, tarea: () => laTomoUnaPersona({ almacen, chatwoot }, accion.conversacion) };
  }

  if (!almacen || !modelo) {
    const faltan = [!almacen && "DATABASE_URL", !modelo && "la clave de la IA"].filter(Boolean).join(" y ");
    return {
      status: 200,
      json: { accion: "pasar_a_persona", motivo: `falta configurar ${faltan}` },
      tarea: async () => {
        await chatwoot.notaInterna(accion.conversacion, `🙋 El asistente todavía no está configurado (falta ${faltan} en Vercel): atiende el equipo.`);
        await chatwoot.pasarAPersona(accion.conversacion);
      },
    };
  }

  // La línea, por la bandeja del aviso. Si no se puede saber (falla la base), se atiende como antes.
  const lineas = await almacen.lineas().catch(() => []);
  const linea = lineas.length ? lineaDeBandeja(lineas, accion.bandeja) : null;
  // Una bandeja que no es de ninguna línea, o una línea que no es de leads (outreach, la del equipo):
  // el asistente de ventas no contesta ahí.
  if (lineas.length && (!linea || linea.tipo !== "entrada")) {
    const motivo = linea ? `la línea «${linea.nombre}» no la atiende el asistente de ventas` : `la bandeja ${accion.bandeja} no es de ninguna línea`;
    return {
      status: 200,
      json: { accion: "pasar_a_persona", motivo },
      tarea: () => pasarPorPausa({ almacen, chatwoot }, accion.conversacion, { nota: notaLineaSinAsistente(linea, accion.bandeja), motivo: `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)}.` }),
    };
  }

  // Pausado desde el panel: atiende el equipo. Si no se puede saber, el asistente sigue (no deja a nadie sin respuesta).
  if (await almacen.pausado().catch(() => false)) {
    return { status: 200, json: { accion: "pasar_a_persona", motivo: "el asistente está pausado" }, tarea: () => pasarPorPausa({ almacen, chatwoot }, accion.conversacion) };
  }
  if (linea?.pausada) {
    const motivo = `la línea «${linea.nombre}» está pausada`;
    return {
      status: 200,
      json: { accion: "pasar_a_persona", motivo },
      tarea: () => pasarPorPausa({ almacen, chatwoot }, accion.conversacion, { nota: notaLineaSinAsistente(linea, accion.bandeja), motivo: `La línea «${linea.nombre}» está pausada.` }),
    };
  }

  return { status: 200, json: { accion: accion.tipo, ...(linea ? { linea: linea.id } : {}) }, tarea: () => atender({ ...opciones, almacen, chatwoot, modelo, crm, transcribir, avisarAlEquipo }, accion, linea) };
}

/** El texto sin las etiquetas de los adjuntos («[foto]», «[audio]»…): el eco de un archivo puede llegar con otra. */
const sinAdjuntos = (t: string) => t.replace(/\[(foto|audio|archivo|video|ubicación|contacto)\]/g, "").replace(/\s+/g, " ").trim();

async function esEcoDelBot(almacen: NonNullable<Conexiones["almacen"]>, conversacion: number, texto: string, ahoraMs: number): Promise<boolean> {
  const recientes = await almacen.historial(conversacion, MENSAJES_PARA_ECO);
  return recientes.some((m) => {
    // El eco puede ser de un mensaje del bot o de uno del equipo (por ejemplo, el que salió desde el hub).
    if (m.rol === "interesado" || ahoraMs - Date.parse(m.fecha) >= MARGEN_ECO_MS) return false;
    if (m.texto.trim() === texto.trim()) return true;
    // Un archivo que mandó un flujo: coincide el texto, aunque la etiqueta del adjunto sea otra.
    const a = sinAdjuntos(m.texto);
    return a !== m.texto.trim() && a === sinAdjuntos(texto) && (a !== "" || /\[[a-zó]+\]/.test(texto));
  });
}
