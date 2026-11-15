/**
 * Probar el asistente desde el panel o el hub, sin WhatsApp: mismo tono, mismas fichas, mismos
 * ejemplos y la misma IA que en una conversación real, pero sin tocar Chatwoot ni el CRM. Lo que
 * haría (anotar en el CRM, elegir un proyecto, mover de etapa, pasar al equipo) se muestra en vez
 * de hacerse.
 *
 * Con una línea, prueba como esa línea: sus proyectos, sus instrucciones, su modo y sus flujos. Un
 * flujo corre con el mismo motor que en una conversación real (lib/flujos/motor.ts): los mensajes
 * fijos salen en la charla, las pausas y los cambios de etapa se muestran, y las esperas quedan a la
 * espera de tu respuesta (o de «Simular que no respondió»).
 */

import type { MensajeHistorial } from "../chatwoot/evento";
import type { Almacen, Anotado, Ejemplo, FlujoActivo, Proyecto, Tono } from "../datos/tipos";
import { archivosDe, elegirFlujo, textoHoras, validarPasos, pasoEn } from "../flujos/modelo";
import { avanzar, type Acciones, type Disparo } from "../flujos/motor";
import { proyectosDeLinea, type Linea } from "../lineas";
import { textoSeguimiento } from "../seguimientos/reglas";
import { MAX_LARGO_PRUEBA, MAX_MENSAJES_PRUEBA, type EstadoPrueba, type FlujoPrueba, type MensajePrueba, type RespuestaPrueba } from "./prueba-comun";
import { responder, type Herramientas, type Modelo } from "./agente";
import { CAMPOS_ANOTADOS, sumarAnotado } from "./anotado";
import { ficha, instrucciones, situacion } from "./contexto";
import { tituloEvento, type ReglasEtapa } from "../etapas/reglas";
import { paraWhatsApp } from "./whatsapp";

export { estadoInicial, MAX_LARGO_PRUEBA, MAX_MENSAJES_PRUEBA, type EstadoPrueba, type MensajePrueba, type RespuestaPrueba } from "./prueba-comun";

export async function probar({
  modelo,
  proyectos: todos,
  tono,
  ejemplos,
  estado,
  texto,
  reglasEtapa,
  ahora = new Date(),
  linea = null,
  flujos = [],
  vencer = false,
  archivos = new Map(),
}: {
  /** Para mostrar a qué etapa movería cada señal (si no vienen, solo muestra la señal). */
  reglasEtapa?: ReglasEtapa;
  modelo: Modelo;
  proyectos: Proyecto[];
  tono: Tono;
  ejemplos: Ejemplo[];
  estado: EstadoPrueba;
  /** Lo que escribió la persona. Vacío con `vencer`: simula que no respondió a una espera. */
  texto: string;
  ahora?: Date;
  /** La línea con la que se prueba. */
  linea?: Linea | null;
  /** Los flujos activos de esa línea. */
  flujos?: FlujoActivo[];
  /** Simular que venció la espera del flujo (la persona no respondió). */
  vencer?: boolean;
  /** Los nombres de los archivos que mandan los flujos, para mostrarlos. */
  archivos?: Map<number, string>;
}): Promise<RespuestaPrueba> {
  const acciones: string[] = [];
  const turno: { tipo: "bot" | "accion"; texto: string }[] = [];
  /** Lo que haría (va en «acciones» y, en orden, en «turno»). */
  const accion = (texto: string) => (acciones.push(texto), turno.push({ tipo: "accion", texto }));
  const proyectos = proyectosDeLinea(linea, todos);
  const mensajes: MensajePrueba[] = [...estado.mensajes];
  /** Un mensaje del asistente: queda en la charla y, en orden, en «turno». */
  const bot = (texto: string) => (mensajes.push({ rol: "bot", texto }), turno.push({ tipo: "bot", texto }));
  if (!vencer) mensajes.push({ rol: "interesado" as const, texto: texto.trim().slice(0, MAX_LARGO_PRUEBA) });
  let proyectoId = proyectos.some((p) => p.id === estado.proyecto) ? estado.proyecto : proyectos.length === 1 ? proyectos[0].id : null;
  let anotado: Anotado = estado.anotado;
  let pasada = estado.pasada;
  let flujo: FlujoPrueba | null = estado.flujo ?? null;
  const proyecto = (id: string | null) => proyectos.find((p) => p.id === id) ?? null;
  const herramientas: Herramientas = {
    async registrarInteresado(d) {
      const suma = sumarAnotado(anotado, d);
      anotado = suma.anotado;
      if (!suma.cambios.length) return "Eso ya estaba anotado: no hace falta registrarlo de nuevo. Seguí la conversación.";
      accion(`📝 Anotaría en el CRM: ${suma.cambios.join(", ")}${d.resumen ? `. «${d.resumen}»` : ""}`);
      return "Listo: quedó anotado en el CRM.";
    },
    async elegirProyecto(id) {
      const p = proyecto(id);
      if (!p) throw new Error(`No hay un proyecto activo con id ${id}.`);
      proyectoId = p.id;
      accion(`🏢 Eligió el proyecto ${p.nombre}`);
      return `Quedó elegido. Ficha:\n\n${ficha(p)}`;
    },
    async marcarSenal(senal, detalle) {
      const etapa = reglasEtapa?.[senal];
      accion(`🏷️ ${tituloEvento(senal)}${detalle ? ` («${detalle}»)` : ""}${etapa ? `: lo movería a «${etapa}» en el CRM` : ""}`);
      return "Anotado para el equipo. Seguí la conversación sin mencionarlo.";
    },
  };

  /** La IA contesta (o escribe con una consigna) y su mensaje queda en la charla. */
  const turnoIA = async (consigna: string | null) => {
    const base = ahora.getTime() - mensajes.length * 60_000;
    const historial: MensajeHistorial[] = mensajes.map((m, i) => ({ id: i + 1, conversacion: 0, rol: m.rol, texto: m.texto, fecha: new Date(base + i * 60_000).toISOString() }));
    if (consigna && historial.at(-1)?.rol !== "interesado") {
      historial.push({ id: -1, conversacion: 0, rol: "interesado", texto: "(Nota interna, no la escribió la persona: todavía no respondió a lo último que le mandamos.)", fecha: ahora.toISOString() });
    }
    const r = await responder({
      modelo,
      instrucciones: instrucciones({ tono, proyectos, proyecto: proyecto(proyectoId), ejemplos, linea }),
      situacion:
        situacion({ ahora, nombre: "", telefono: "", crm: null, anotado, horario: tono.horario_equipo }) +
        (consigna ? `\n\n# Lo que tenés que hacer ahora\n\n${consigna}\n\nEscribí un solo mensaje para mandarle ahora, como parte de la conversación.` : ""),
      historial,
      proyectos: proyectos.map((p) => p.id),
      herramientas,
    });
    const respuesta = paraWhatsApp(r.texto);
    if (respuesta) bot(respuesta);
    return { pasar: r.pasarAPersona ?? (respuesta ? null : { motivo: "El asistente no supo qué responder.", resumen: "" }) };
  };
  const alEquipo = (p: { motivo: string; resumen: string }) => {
    pasada = true;
    accion(`🙋 Acá pasaría la conversación al equipo: ${p.motivo}${p.resumen ? `. Resumen: ${p.resumen}` : ""}`);
  };

  /** Corre un tramo del flujo con el motor de verdad, mostrando lo que haría. */
  const correrFlujo = async (f: FlujoPrueba, disparo: Disparo) => {
    const a: Acciones = {
      async enviar(t, archivo) {
        const final = textoSeguimiento(t, { nombre: anotado.nombre?.split(/\s+/)[0] ?? "", proyecto: proyecto(proyectoId)?.nombre ?? "" });
        const adjunto = archivo ? `📎 ${archivos.get(archivo) ?? "archivo"}` : "";
        bot([adjunto, final].filter(Boolean).join("\n"));
      },
      ia: (consigna) => turnoIA(consigna),
      async etapa(e) {
        accion(`🏷️ Movería al lead a «${e}» en el CRM (si no está en Reserva o Vendido, y sin retroceder)`);
      },
      async equipo(p) {
        alEquipo(p);
      },
      async dormir(ms) {
        accion(`⏱️ Pausa de ${Math.round(ms / 1000)} s`);
      },
      async guardar(c) {
        if (c.posicion) f.posicion = c.posicion;
        if (c.estado === "esperando" || c.estado === "terminado") f.estado = c.estado;
        if (c.resultado !== undefined) f.resultado = c.resultado === "cancelado" ? "fin" : c.resultado;
      },
      escribioDeNuevo: async () => false,
      ahora: () => ahora,
    };
    const r = await avanzar(f, disparo, a);
    if (r.estado === "esperando") {
      const espera = pasoEn(f.pasos, f.posicion);
      f.horas = espera?.tipo === "esperar" ? espera.horas : null;
      accion(`⏳ El flujo «${f.nombre}» espera la respuesta (hasta ${f.horas ? textoHoras(f.horas) : "el plazo"}). Escribí para seguir por «Si responde», o simulá que no respondió.`);
    } else if (r.resultado === "ia") accion(`🤖 Terminó el flujo «${f.nombre}»: desde acá conversa la IA.`);
    else if (r.resultado === "fin") accion(`🏁 Terminó el flujo «${f.nombre}». Si la persona escribe después, la atiende el equipo.`);
  };

  // ¿Lo atiende un flujo? (Si no, contesta la IA.)
  let atendio = true;
  if (vencer) {
    if (flujo?.estado !== "esperando") throw new Error("No hay un flujo esperando respuesta.");
    accion("⌛ La persona no respondió a tiempo.");
    await correrFlujo(flujo, "vencio");
  } else if (flujo?.estado === "esperando") {
    await correrFlujo(flujo, "respuesta");
  } else if (flujo?.resultado === "fin") {
    alEquipo({ motivo: `La persona escribió después de que terminó el flujo «${flujo.nombre}».`, resumen: "" });
  } else if (!flujo && linea && estado.mensajes.length === 0 && flujos.length) {
    // Una persona nueva: ¿le toca un flujo?
    const elegido = elegirFlujo(flujos, proyectos, mensajes.map((m) => m.texto).join(" \n "));
    if (elegido) {
      if (elegido.proyecto) proyectoId = elegido.proyecto;
      flujo = { id: elegido.flujo.id, nombre: elegido.flujo.nombre, pasos: elegido.flujo.pasos, posicion: "0", estado: "esperando", resultado: null, horas: null };
      // Si es el flujo de un proyecto, se dice por qué arrancó ese y no el general.
      const delProyecto = elegido.flujo.proyecto ? ` (el de ${proyecto(elegido.flujo.proyecto)?.nombre ?? elegido.flujo.proyecto}, porque lo nombró)` : "";
      accion(`▶️ Arranca el flujo «${elegido.flujo.nombre}»${delProyecto}.`);
      await correrFlujo(flujo, "inicio");
    } else atendio = false;
  } else atendio = false;

  // Sin flujo (o el flujo ya le pasó la charla a la IA): contesta la IA, como siempre.
  if (!atendio) {
    const presentaYPasa = linea?.pasar_al_responder === true && !flujo && estado.mensajes.some((m) => m.rol === "bot");
    if (presentaYPasa) alEquipo({ motivo: "La persona respondió después de la presentación (modo «presenta y pasa»).", resumen: anotado.resumen ?? "" });
    else {
      const r = await turnoIA(null);
      if (r.pasar) alEquipo(r.pasar);
    }
  }

  return {
    estado: { mensajes: mensajes.slice(-MAX_MENSAJES_PRUEBA), proyecto: proyectoId, anotado, pasada, ...(linea || estado.linea ? { linea: linea?.id ?? estado.linea ?? null, flujo } : {}) },
    acciones,
    turno,
  };
}

/**
 * Probar con lo que hay en la base (lo usan el panel y la API del hub): el tono, las fichas, la
 * línea elegida y sus flujos activos. Lo que viene del navegador se revisa entero.
 */
export async function probarConAlmacen(
  almacen: Almacen,
  modelo: Modelo,
  estadoCrudo: unknown,
  texto: string,
  { linea: idLinea = null, vencer = false }: { linea?: string | null; vencer?: boolean } = {},
): Promise<RespuestaPrueba> {
  let estado = estadoDesdeNavegador(estadoCrudo);
  const [proyectos, tono, ejemplos, reglasEtapa, lineas] = await Promise.all([
    almacen.proyectosActivos(),
    almacen.tono(),
    almacen.ejemplos(),
    almacen.reglasEtapa().catch(() => ({})),
    almacen.lineas().catch(() => []),
  ]);
  const id = idLinea ?? estado.linea ?? null;
  const linea = id ? (lineas.find((l) => l.id === id) ?? null) : null;
  if (id && !linea) throw new Error("Esa línea no existe.");
  if (linea && estado.linea !== linea.id) estado = { ...estado, linea: linea.id, flujo: null };
  const flujos = linea ? await almacen.flujosActivos(linea.id) : [];
  const ids = archivosDe([...flujos.flatMap((f) => f.pasos), ...(estado.flujo?.pasos ?? [])]);
  const archivos = new Map<number, string>();
  for (const a of await Promise.all(ids.map((x) => almacen.archivo(x).catch(() => null)))) if (a) archivos.set(a.id, a.nombre);
  return probar({ modelo, proyectos, tono, ejemplos, reglasEtapa, estado, texto: texto.slice(0, MAX_LARGO_PRUEBA), linea, flujos, vencer, archivos });
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
  const base: EstadoPrueba = { mensajes, proyecto: typeof e.proyecto === "string" ? e.proyecto : null, anotado, pasada: e.pasada === true };
  if (typeof e.linea !== "string" || !/^[a-z0-9-]{1,40}$/.test(e.linea)) return base;
  return { ...base, linea: e.linea, flujo: flujoDesdeNavegador(e.flujo) };
}

/** El flujo de la prueba, revisado: los pasos se vuelven a validar y la posición tiene que existir. */
function flujoDesdeNavegador(x: unknown): FlujoPrueba | null {
  if (!x || typeof x !== "object") return null;
  const f = x as Partial<FlujoPrueba>;
  const pasos = validarPasos(f.pasos);
  if (!pasos.ok || typeof f.posicion !== "string" || !/^\d+(\.(si|no)\.\d+)*$/.test(f.posicion)) return null;
  const estado = f.estado === "esperando" ? "esperando" : "terminado";
  if (estado === "esperando" && pasoEn(pasos.valor, f.posicion)?.tipo !== "esperar") return null;
  const resultado = (["equipo", "ia", "fin", "error"] as const).find((r) => r === f.resultado) ?? null;
  return {
    id: Number.isInteger(f.id) ? Number(f.id) : 0,
    nombre: typeof f.nombre === "string" ? f.nombre.slice(0, 120) : "Flujo",
    pasos: pasos.valor,
    posicion: f.posicion,
    estado,
    resultado,
    horas: typeof f.horas === "number" ? f.horas : null,
  };
}
