/**
 * Atender un mensaje del interesado, de punta a punta:
 *
 * 1. No contestar dos veces el mismo mensaje (Chatwoot puede reintentar el aviso).
 *    Si trae audios, transcribirlos (con OpenAI) y guardar el texto en el historial.
 * 2. Esperar unos segundos: la gente manda varios mensajes seguidos. Si llegó otro, contesta ese.
 * 3. Armar el contexto: tono, ficha del proyecto, lo que dice el CRM y el historial.
 * 4. Claude responde (y puede registrar al interesado, elegir el proyecto o pasar a una persona).
 * 5. Mandar la respuesta por Chatwoot; si pasa a una persona, nota interna y conversación abierta.
 *
 * Si algo falla, la conversación pasa a una persona con una nota que explica qué pasó: ningún
 * interesado queda sin respuesta.
 */

import type { Chatwoot } from "../chatwoot/api";
import type { Accion } from "../chatwoot/evento";
import type { ContactoCRM, CRM } from "../crm/planilla";
import type { Almacen, Proyecto } from "../datos/tipos";
import { responder, type Herramientas, type Modelo, type Resultado } from "./agente";
import type { Transcriptor } from "./openai";
import { ficha, instrucciones, situacion } from "./contexto";

export interface Servicios {
  almacen: Almacen;
  chatwoot: Chatwoot;
  modelo: Modelo;
  crm: CRM | null;
  /** Sin él (falta OPENAI_API_KEY), los audios quedan como [audio] y el bot pide que lo escriban. */
  transcribir?: Transcriptor | null;
  ahora?: () => Date;
  dormir?: (ms: number) => Promise<void>;
  /** Cuánto esperar por si la persona sigue escribiendo. */
  esperaMs?: number;
}

/** Mensajes del historial que se le pasan a Claude. */
export const LARGO_HISTORIAL = 40;
export const ESPERA_MS = 6000;

type Responder = Extract<Accion, { tipo: "responder" }>;

const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const detalle = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function atender(s: Servicios, a: Responder): Promise<string> {
  const ahora = s.ahora ?? (() => new Date());
  const conv = a.conversacion;
  if (a.mensaje != null && !(await s.almacen.reclamarMensaje(a.mensaje, conv))) return "ya se había atendido";

  // Antes de esperar: si mientras tanto llega otro mensaje, ese ya lee la transcripción.
  const transcripciones = await transcribirAudios(s, a);
  const textoDelAviso = conTranscripciones([a.texto, ...a.audios.map(() => "[audio]")].filter(Boolean).join(" "), transcripciones);
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

    const [guardada, proyectos, tono, ejemplos] = await Promise.all([
      s.almacen.conversacion(conv),
      s.almacen.proyectosActivos(),
      s.almacen.tono(),
      s.almacen.ejemplos(),
    ]);
    // El teléfono y el nombre de WhatsApp, si cambiaron o todavía no estaban (la fila la puede haber creado el historial).
    const telefono = a.contacto.telefono || guardada?.telefono || null;
    const nombre = a.contacto.nombre || guardada?.nombre || null;
    if (!guardada || guardada.telefono !== telefono || guardada.nombre !== nombre) await s.almacen.guardarConversacion({ chatwoot_id: conv, telefono, nombre });
    let proyectoId = guardada?.proyecto ?? (proyectos.length === 1 ? proyectos[0].id : null);
    const proyecto = (id: string | null): Proyecto | null => proyectos.find((p) => p.id === id) ?? null;

    let contactoCRM: ContactoCRM | null | undefined = undefined;
    if (s.crm && a.contacto.telefono) {
      try {
        contactoCRM = await s.crm.buscarPorTelefono(a.contacto.telefono);
      } catch (e) {
        await s.almacen.registrar({ tipo: "error", conversacion: conv, detalle: `CRM (buscar): ${detalle(e)}` });
      }
    }

    const herramientas: Herramientas = {
      async registrarInteresado(d) {
        if (!s.crm) return "El CRM no está conectado todavía: seguí la conversación igual.";
        const cuando = ahora().toISOString();
        // Si al principio no se pudo consultar el CRM, se vuelve a buscar: nunca se crea un repetido.
        if (contactoCRM === undefined && a.contacto.telefono) contactoCRM = await s.crm.buscarPorTelefono(a.contacto.telefono);
        if (!contactoCRM) {
          contactoCRM = await s.crm.crearContacto(
            {
              nombre: d.nombre || a.contacto.nombre,
              telefono: a.contacto.telefono,
              proyecto: proyectoId,
              para: d.para,
              ambientes: d.ambientes,
              presupuestoUsd: d.presupuesto_usd,
              formaDePago: d.forma_de_pago,
              plazo: d.plazo,
              notas: d.resumen,
            },
            cuando,
          );
          await s.almacen.guardarConversacion({ chatwoot_id: conv, crm_contacto_id: contactoCRM.id });
          await s.crm.anotarActividad({ contacto: contactoCRM, detalle: `Alta por WhatsApp. ${d.resumen}`.trim(), ahora: cuando });
          await s.almacen.registrar({ tipo: "crm", conversacion: conv, detalle: `Contacto nuevo ${contactoCRM.id}`, datos: d });
          return "Listo: quedó en el CRM como contacto nuevo.";
        }
        const datos = [
          d.nombre && `nombre: ${d.nombre}`,
          d.para && `para: ${d.para}`,
          d.ambientes && `ambientes: ${d.ambientes}`,
          d.presupuesto_usd && `presupuesto: USD ${d.presupuesto_usd}`,
          d.forma_de_pago && `pago: ${d.forma_de_pago}`,
          d.plazo && `plazo: ${d.plazo}`,
        ].filter(Boolean);
        await s.crm.anotarActividad({ contacto: contactoCRM, detalle: [d.resumen, datos.length ? `(${datos.join(", ")})` : ""].filter(Boolean).join(" "), ahora: cuando });
        await s.almacen.registrar({ tipo: "crm", conversacion: conv, detalle: `Actividad en ${contactoCRM.id}`, datos: d });
        return "Listo: quedó anotado en el CRM (el contacto ya existía).";
      },
      async elegirProyecto(id) {
        const p = proyecto(id);
        if (!p) throw new Error(`No hay un proyecto activo con id ${id}.`);
        proyectoId = p.id;
        await s.almacen.guardarConversacion({ chatwoot_id: conv, proyecto: p.id });
        return `Quedó elegido. Ficha:\n\n${ficha(p)}`;
      },
    };

    const resultado: Resultado = await responder({
      modelo: s.modelo,
      instrucciones: instrucciones({ tono, proyectos, proyecto: proyecto(proyectoId), ejemplos }),
      situacion: situacion({ ahora: ahora(), nombre: a.contacto.nombre, telefono: a.contacto.telefono, crm: contactoCRM }),
      historial,
      proyectos: proyectos.map((p) => p.id),
      herramientas,
    });

    if (resultado.texto) await s.chatwoot.enviar(conv, resultado.texto);
    await s.almacen.registrar({ tipo: "respuesta", conversacion: conv, detalle: resultado.texto.slice(0, 500), datos: { fin: resultado.fin } });

    const pasar = resultado.pasarAPersona ?? (resultado.texto ? null : { motivo: "El asistente no supo qué responder.", resumen: "" });
    if (pasar) {
      await pasarAPersona(s, conv, pasar, contactoCRM ?? null, ahora);
      return `respondió y pasó a una persona: ${pasar.motivo}`;
    }
    return "respondió";
  } catch (e) {
    await s.almacen.registrar({ tipo: "error", conversacion: conv, detalle: detalle(e) }).catch(() => {});
    await pasarAPersona(s, conv, { motivo: "El asistente tuvo un error y no pudo responder.", resumen: detalle(e).slice(0, 300) }, null, ahora).catch(() => {});
    return `error: ${detalle(e)}`;
  }
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

async function pasarAPersona(s: Servicios, conv: number, p: { motivo: string; resumen: string }, contacto: ContactoCRM | null, ahora: () => Date) {
  const nota = [`🙋 El asistente pasó esta conversación al equipo: ${p.motivo}`, p.resumen && `Resumen: ${p.resumen}`, contacto?.responsable && `Responsable en el CRM: ${contacto.responsable}`]
    .filter(Boolean)
    .join("\n");
  await s.chatwoot.notaInterna(conv, nota);
  await s.chatwoot.pasarAPersona(conv);
  await s.almacen.sinSeguimientos(conv).catch(() => {});
  await s.almacen.registrar({ tipo: "paso_a_persona", conversacion: conv, detalle: p.motivo, datos: p });
  if (s.crm && contacto) {
    await s.crm.anotarActividad({ contacto, detalle: `Pasó al equipo: ${p.motivo}. ${p.resumen}`.trim(), ahora: ahora().toISOString() }).catch(() => {});
  }
}

/** Una persona escribió en una conversación que atendía el bot: pasa a abierta y queda anotado. */
export async function laTomoUnaPersona(s: Pick<Servicios, "almacen" | "chatwoot">, conversacion: number): Promise<string> {
  await s.chatwoot.pasarAPersona(conversacion);
  await s.almacen.sinSeguimientos(conversacion);
  await s.almacen.registrar({ tipo: "la_tomo_una_persona", conversacion, detalle: "Una persona del equipo escribió: el asistente deja de responder." });
  return "pasó a abierta";
}
