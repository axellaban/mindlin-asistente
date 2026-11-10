/**
 * Probar el asistente desde el panel, sin WhatsApp: mismo tono, mismas fichas, mismos ejemplos y
 * la misma IA que en una conversación real, pero sin tocar Chatwoot ni el CRM. Lo que haría
 * (anotar en el CRM, elegir un proyecto, pasar al equipo) se muestra en vez de hacerse.
 *
 * Sirve para que Mindlin ajuste el tono y las fichas antes de abrir la línea, y para revisar
 * cómo contestaría una pregunta difícil.
 */

import type { MensajeHistorial } from "../chatwoot/evento";
import type { Anotado, Ejemplo, Proyecto, Tono } from "../datos/tipos";
import { MAX_LARGO_PRUEBA, MAX_MENSAJES_PRUEBA, type EstadoPrueba, type MensajePrueba, type RespuestaPrueba } from "./prueba-comun";
import { responder, type Herramientas, type Modelo } from "./agente";
import { CAMPOS_ANOTADOS, sumarAnotado } from "./anotado";
import { ficha, instrucciones, situacion } from "./contexto";
import { paraWhatsApp } from "./whatsapp";

export { estadoInicial, MAX_LARGO_PRUEBA, MAX_MENSAJES_PRUEBA, type EstadoPrueba, type MensajePrueba, type RespuestaPrueba } from "./prueba-comun";

export async function probar({
  modelo,
  proyectos,
  tono,
  ejemplos,
  estado,
  texto,
  ahora = new Date(),
}: {
  modelo: Modelo;
  proyectos: Proyecto[];
  tono: Tono;
  ejemplos: Ejemplo[];
  estado: EstadoPrueba;
  texto: string;
  ahora?: Date;
}): Promise<RespuestaPrueba> {
  const acciones: string[] = [];
  const mensajes: MensajePrueba[] = [...estado.mensajes, { rol: "interesado" as const, texto: texto.trim().slice(0, MAX_LARGO_PRUEBA) }].slice(-MAX_MENSAJES_PRUEBA);
  let proyectoId = proyectos.some((p) => p.id === estado.proyecto) ? estado.proyecto : proyectos.length === 1 ? proyectos[0].id : null;
  let anotado = estado.anotado;
  const proyecto = (id: string | null) => proyectos.find((p) => p.id === id) ?? null;

  const herramientas: Herramientas = {
    async registrarInteresado(d) {
      const suma = sumarAnotado(anotado, d);
      anotado = suma.anotado;
      if (!suma.cambios.length) return "Eso ya estaba anotado: no hace falta registrarlo de nuevo. Seguí la conversación.";
      acciones.push(`📝 Anotaría en el CRM: ${suma.cambios.join(", ")}${d.resumen ? `. «${d.resumen}»` : ""}`);
      return "Listo: quedó anotado en el CRM.";
    },
    async elegirProyecto(id) {
      const p = proyecto(id);
      if (!p) throw new Error(`No hay un proyecto activo con id ${id}.`);
      proyectoId = p.id;
      acciones.push(`🏢 Eligió el proyecto ${p.nombre}`);
      return `Quedó elegido. Ficha:\n\n${ficha(p)}`;
    },
  };

  const base = ahora.getTime() - mensajes.length * 60_000;
  const historial: MensajeHistorial[] = mensajes.map((m, i) => ({ id: i + 1, conversacion: 0, rol: m.rol, texto: m.texto, fecha: new Date(base + i * 60_000).toISOString() }));
  const r = await responder({
    modelo,
    instrucciones: instrucciones({ tono, proyectos, proyecto: proyecto(proyectoId), ejemplos }),
    situacion: situacion({ ahora, nombre: "", telefono: "", crm: null, anotado }),
    historial,
    proyectos: proyectos.map((p) => p.id),
    herramientas,
  });

  const respuesta = paraWhatsApp(r.texto);
  if (respuesta) mensajes.push({ rol: "bot", texto: respuesta });
  const pasar = r.pasarAPersona ?? (respuesta ? null : { motivo: "El asistente no supo qué responder.", resumen: "" });
  if (pasar) acciones.push(`🙋 Acá pasaría la conversación al equipo: ${pasar.motivo}${pasar.resumen ? `. Resumen: ${pasar.resumen}` : ""}`);
  return { estado: { mensajes, proyecto: proyectoId, anotado, pasada: estado.pasada || Boolean(pasar) }, acciones };
}

/** Lo que llega del navegador, revisado (nunca se confía en la forma). */
export function estadoDesdeNavegador(x: unknown): EstadoPrueba {
  const e = (x && typeof x === "object" ? x : {}) as Partial<EstadoPrueba>;
  const mensajes = Array.isArray(e.mensajes)
    ? e.mensajes
        .filter((m): m is MensajePrueba => Boolean(m) && (m.rol === "interesado" || m.rol === "bot") && typeof m.texto === "string")
        .map((m) => ({ rol: m.rol, texto: m.texto.slice(0, MAX_LARGO_PRUEBA * 2) }))
        .slice(-MAX_MENSAJES_PRUEBA)
    : [];
  const anotado: Anotado = {};
  const crudo = (e.anotado && typeof e.anotado === "object" ? e.anotado : {}) as Record<string, unknown>;
  for (const k of [...CAMPOS_ANOTADOS.map(([c]) => c), "resumen"] as const) {
    const v = crudo[k];
    if (typeof v === "string" && v) anotado[k] = v.slice(0, 300);
  }
  return { mensajes, proyecto: typeof e.proyecto === "string" ? e.proyecto : null, anotado, pasada: e.pasada === true };
}
