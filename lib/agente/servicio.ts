/**
 * Atender un mensaje del interesado, de punta a punta:
 *
 * 1. No contestar dos veces el mismo mensaje (Chatwoot puede reintentar el aviso).
 *    Si trae audios, transcribirlos (con OpenAI) y guardar el texto en el historial.
 * 2. Esperar unos segundos: la gente manda varios mensajes seguidos. Si llegó otro, contesta ese.
 * 3. Armar la conversación (lib/agente/charla.ts): la línea, sus proyectos, el tono, lo que dice
 *    el CRM y el historial.
 * 4. Si la línea tiene un flujo para esta persona (lib/flujos/servicio.ts), lo sigue el flujo.
 * 5. Si no, responde la IA (y puede registrar al interesado, elegir el proyecto o pasar a una persona).
 * 6. Mandar la respuesta por Chatwoot; si pasa a una persona, nota interna y conversación abierta.
 *
 * Si algo falla, la conversación pasa a una persona con una nota que explica qué pasó: ningún
 * interesado queda sin respuesta.
 */

import type { Accion } from "../chatwoot/evento";
import type { Evento } from "../etapas/reglas";
import { conFlujo } from "../flujos/servicio";
import type { Linea } from "../lineas";
import { LARGO_HISTORIAL, pasarAPersona, prepararCharla, type Servicios } from "./charla";
import { motivoParaFrenar } from "./limites";

export { LARGO_HISTORIAL, type Servicios } from "./charla";

export const ESPERA_MS = 6000;

type Responder = Extract<Accion, { tipo: "responder" }>;

const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const detalle = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** `linea`: la de la bandeja del aviso (el webhook ya revisó que sea de leads y no esté pausada). */
export async function atender(s: Servicios, a: Responder, linea: Linea | null = null): Promise<string> {
  const ahora = s.ahora ?? (() => new Date());
  const conv = a.conversacion;
  if (a.mensaje != null && !(await s.almacen.reclamarMensaje(a.mensaje, conv))) return "ya se había atendido";

  // Antes de esperar: si mientras tanto llega otro mensaje, ese ya lee la transcripción.
  const transcripciones = await transcribirAudios(s, a);
  const textoDelAviso = conTranscripciones([a.texto, ...a.audios.map(() => "[audio]"), ...a.adjuntos].filter(Boolean).join(" "), transcripciones);
  if (transcripciones.some(Boolean) && a.mensaje != null) {
    await s.almacen.actualizarTextoMensaje(a.mensaje, textoDelAviso).catch(() => {});
  }

  await (s.dormir ?? dormirReal)(s.esperaMs ?? ESPERA_MS);

  try {
    const historial = await s.almacen.historial(conv, LARGO_HISTORIAL);
    const ultimo = historial.at(-1);
    if (ultimo && a.mensaje != null && ultimo.id !== a.mensaje && historial.some((m) => m.id === a.mensaje)) {
      return ultimo.rol === "interesado" ? "llegó otro mensaje: contesta ese" : "ya le contestó alguien";
    }
    // Si el mensaje no quedó guardado (por ejemplo, falló la base), se responde igual con lo que trae el aviso.
    if (!historial.some((m) => m.id === a.mensaje)) {
      historial.push({ id: a.mensaje ?? -1, conversacion: conv, rol: "interesado", texto: textoDelAviso, fecha: ahora().toISOString() });
    }

    // Un contestador automático o alguien que escribe sin parar: atiende el equipo, sin gastar la IA.
    const frenar = motivoParaFrenar(historial, ahora());
    if (frenar) {
      await pasarAPersona(s, conv, { motivo: `El asistente dejó de responder: ${frenar}.`, resumen: "" }, null, ahora);
      return `frenó: ${frenar}`;
    }

    // Si el equipo había tomado la conversación y la volvió a poner pendiente, se la devolvió al bot.
    const devuelta = await s.almacen.volvioAlBot(conv);
    if (devuelta) {
      await s.almacen.registrar({ tipo: "volvio_al_bot", conversacion: conv, detalle: "El equipo le devolvió la conversación al asistente: vuelve a responder y a llevar seguimientos." });
      // Lo decidió el equipo: desde acá conversa la IA, aunque hubiera un flujo a medias.
      await s.almacen.cancelarCorridas(conv).catch(() => {});
    }

    const ch = await prepararCharla(s, { conv, linea, historial, contacto: a.contacto, bandeja: a.bandeja, eventoPara: (g) => eventoDelMensaje(historial, g?.ultimo_seguimiento) });

    // Un flujo (como los bots de Kommo) para esta persona, si la línea tiene uno.
    let pasoPorFlujo = false;
    if (!devuelta) {
      const f = await conFlujo(s, ch);
      if ("hecho" in f) return f.hecho;
      pasoPorFlujo = f.ia;
    }

    // Modo «presenta y pasa» (como los bots de Kommo): el asistente ya le escribió y la persona
    // respondió → sigue el equipo. Si el equipo se la devolvió a propósito, o la conversación ya
    // pasó por un flujo (que decidió que siga la IA), responde.
    const presentaYPasa = linea ? linea.pasar_al_responder : ch.tono.pasar_al_responder === true;
    if (presentaYPasa && !devuelta && !pasoPorFlujo && historial.some((m) => m.rol === "bot")) {
      await ch.mover(["paso_al_equipo"]);
      await ch.pasarAlEquipo({ motivo: "La persona respondió después de la presentación (modo «presenta y pasa»).", resumen: ch.anotado.resumen ?? "" });
      return "pasó al equipo: respondió después de la presentación";
    }

    const { pasar } = await ch.turnoIA();
    await ch.mover(pasar ? ["paso_al_equipo"] : []);
    if (pasar) {
      await ch.pasarAlEquipo(pasar);
      return `respondió y pasó a una persona: ${pasar.motivo}`;
    }
    return "respondió";
  } catch (e) {
    await s.almacen.registrar({ tipo: "error", conversacion: conv, detalle: detalle(e) }).catch(() => {});
    await pasarAPersona(s, conv, { motivo: "El asistente tuvo un error y no pudo responder.", resumen: detalle(e).slice(0, 300) }, null, ahora).catch(() => {});
    return `error: ${detalle(e)}`;
  }
}

/**
 * Qué fue este mensaje del interesado para las etapas: el primero que le contesta el asistente,
 * la respuesta a un seguimiento automático, o una respuesta más de la conversación.
 */
export function eventoDelMensaje(historial: { rol: string; fecha: string }[], ultimoSeguimiento: string | null | undefined): Evento {
  // Lo último que le mandamos antes de lo que escribió ahora.
  let i = historial.length - 1;
  while (i >= 0 && historial[i].rol === "interesado") i--;
  if (i < 0) return "primer_contacto";
  const saliente = historial[i];
  // El seguimiento se anota un instante antes de mandarlo; Chatwoot le pone su propia hora al mensaje.
  const fueSeguimiento = saliente.rol === "bot" && !!ultimoSeguimiento && Math.abs(Date.parse(saliente.fecha) - Date.parse(ultimoSeguimiento)) <= 5 * 60_000;
  return fueSeguimiento ? "respondio_seguimiento" : "respondio";
}

/** Transcribe los audios del mensaje, en orden. Un audio que no se pudo transcribir queda en "". */
async function transcribirAudios(s: Servicios, a: Responder): Promise<string[]> {
  const transcribir = s.transcribir;
  if (!transcribir || !a.audios.length) return a.audios.map(() => "");
  return Promise.all(
    a.audios.map(async (url) => {
      try {
        const audio = await s.chatwoot.bajarAdjunto(url);
        return await transcribir(audio, nombreDeAudio(audio.type));
      } catch (e) {
        await s.almacen.registrar({ tipo: "error", conversacion: a.conversacion, detalle: `Audio (transcribir): ${detalle(e)}` }).catch(() => {});
        return "";
      }
    }),
  );
}

/** OpenAI reconoce el formato por la extensión: las notas de voz de WhatsApp son ogg (opus). */
export function nombreDeAudio(tipo: string): string {
  const t = tipo.toLowerCase();
  if (t.includes("mpeg") || t.includes("mp3")) return "audio.mp3";
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "audio.m4a";
  if (t.includes("wav")) return "audio.wav";
  if (t.includes("webm")) return "audio.webm";
  return "audio.ogg";
}

/** Cambia cada «[audio]» del texto por su transcripción, en orden: «[audio: «…»]». Puro. */
export function conTranscripciones(texto: string, transcripciones: string[]): string {
  let i = 0;
  return texto.replace(/\[audio\]/g, (marca) => {
    const t = transcripciones[i++]?.trim();
    return t ? `[audio: «${t.replace(/\s+/g, " ")}»]` : marca;
  });
}

/**
 * El asistente no atiende acá (está pausado, la línea está pausada o no es de leads): la
 * conversación pasa al equipo con una nota, sin que responda la IA.
 */
export async function pasarPorPausa(
  s: Pick<Servicios, "almacen" | "chatwoot">,
  conversacion: number,
  { nota = "⏸️ El asistente está pausado (se reactiva desde el panel): atiende el equipo.", motivo = "El asistente está pausado." }: { nota?: string; motivo?: string } = {},
): Promise<string> {
  await s.chatwoot.notaInterna(conversacion, nota);
  await s.chatwoot.pasarAPersona(conversacion);
  await s.almacen.sinSeguimientos(conversacion);
  await s.almacen.cancelarCorridas(conversacion).catch(() => {});
  await s.almacen.registrar({ tipo: "paso_a_persona", conversacion, detalle: motivo });
  return `pasó al equipo: ${motivo.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())}`;
}

/** Una persona escribió en una conversación que atendía el bot: pasa a abierta y queda anotado. */
export async function laTomoUnaPersona(s: Pick<Servicios, "almacen" | "chatwoot">, conversacion: number): Promise<string> {
  await s.chatwoot.pasarAPersona(conversacion);
  await s.almacen.sinSeguimientos(conversacion);
  await s.almacen.cancelarCorridas(conversacion).catch(() => {});
  await s.almacen.registrar({ tipo: "la_tomo_una_persona", conversacion, detalle: "Una persona del equipo escribió: el asistente deja de responder." });
  return "pasó a abierta";
}
