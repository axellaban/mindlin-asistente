/**
 * El webhook del Agent Bot: verifica la firma de Chatwoot, guarda el mensaje en el historial y
 * decide qué hacer. Lo que tarda (Claude, el CRM) va en una tarea que corre después de responder:
 * Chatwoot espera la respuesta solo 5 segundos.
 */

import { type Accion, accionPara, mensajeParaHistorial } from "./chatwoot/evento";
import { firmaValida } from "./chatwoot/firma";
import type { Conexiones } from "./servicios";
import { atender, laTomoUnaPersona, type Servicios } from "./agente/servicio";

export interface Salida {
  status: number;
  json: Record<string, unknown>;
  tarea?: () => Promise<unknown>;
}

/** Un mensaje del bot que vuelve a entrar como si lo hubiera escrito una persona (eco), dentro de este margen. */
export const MARGEN_ECO_MS = 3 * 60_000;

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

  const { almacen, chatwoot, modelo, crm } = conexiones;
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
  if (!chatwoot) return { status: 200, json: { accion: "ignorar", motivo: "falta configurar Chatwoot en Vercel" } };

  if (accion.tipo === "la_tomo_una_persona") {
    if (!almacen) return { status: 200, json: { accion: "ignorar", motivo: "falta configurar la base (DATABASE_URL) en Vercel" } };
    return { status: 200, json: { accion: accion.tipo }, tarea: () => laTomoUnaPersona({ almacen, chatwoot }, accion.conversacion) };
  }

  if (!almacen || !modelo) {
    const faltan = [!almacen && "DATABASE_URL", !modelo && "ANTHROPIC_API_KEY"].filter(Boolean).join(" y ");
    return {
      status: 200,
      json: { accion: "pasar_a_persona", motivo: `falta configurar ${faltan}` },
      tarea: async () => {
        await chatwoot.notaInterna(accion.conversacion, `🙋 El asistente todavía no está configurado (falta ${faltan} en Vercel): atiende el equipo.`);
        await chatwoot.pasarAPersona(accion.conversacion);
      },
    };
  }

  return { status: 200, json: { accion: accion.tipo }, tarea: () => atender({ ...opciones, almacen, chatwoot, modelo, crm }, accion) };
}

async function esEcoDelBot(almacen: NonNullable<Conexiones["almacen"]>, conversacion: number, texto: string, ahoraMs: number): Promise<boolean> {
  const recientes = await almacen.historial(conversacion, 10);
  return recientes.some((m) => m.rol === "bot" && m.texto.trim() === texto.trim() && ahoraMs - Date.parse(m.fecha) < MARGEN_ECO_MS);
}
