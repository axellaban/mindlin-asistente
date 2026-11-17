/**
 * Una conversación lista para atender: lo que el asistente sabe de ella (la línea, los proyectos que
 * atiende esa línea, el tono, el contacto del CRM, lo anotado, el historial) y lo que puede hacer
 * (que conteste la IA, mandar un mensaje fijo o un archivo, mover de etapa, pasar al equipo).
 *
 * La arman el webhook (un mensaje nuevo, lib/agente/servicio.ts) y el cron (una espera de un flujo
 * que venció, lib/flujos/servicio.ts): así la IA y los flujos hacen lo mismo de las dos maneras.
 */

import type { Chatwoot } from "../chatwoot/api";
import type { MensajeHistorial } from "../chatwoot/evento";
import type { ContactoCRM, CRM } from "../crm/planilla";
import type { Almacen, Anotado, Conversacion, Ejemplo, Proyecto, Tono } from "../datos/tipos";
import { moverAEtapa, moverEtapa } from "../etapas/mover";
import { etapaDeAlta, type Evento, type ReglasEtapa, type Senal } from "../etapas/reglas";
import { campaniaDe, etiquetaCampania, type CampaniaPor } from "../campanias";
import { proyectosDeLinea, type Linea } from "../lineas";
import { nombreDePila, textoSeguimiento } from "../seguimientos/reglas";
import { responder, type Herramientas, type Modelo } from "./agente";
import { sumarAnotado } from "./anotado";
import { ficha, instrucciones, situacion } from "./contexto";
import type { Transcriptor } from "./openai";
import { paraWhatsApp } from "./whatsapp";
import { conListaDePrecios, type LeerLista } from "../hub/lista";
import type { AvisarAlEquipo } from "../hub/aviso";

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
  /** Avisa en el hub (la campanita y el celular) cuando pasa una conversación al equipo. */
  avisarAlEquipo?: AvisarAlEquipo | null;
  /** La lista de precios del hub (lib/hub/lista.ts). Sin ella, vale solo la ficha. */
  listaDePrecios?: LeerLista | null;
}

/** Mensajes del historial que se le pasan a la IA. */
export const LARGO_HISTORIAL = 40;

export interface PedidoDeEquipo {
  motivo: string;
  resumen: string;
}

const detalle = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface Charla {
  conv: number;
  linea: Linea | null;
  tono: Tono;
  /** Los proyectos que atiende esta línea. */
  proyectos: Proyecto[];
  /** Del más viejo al más nuevo. Lo que manda el asistente se suma acá enseguida. */
  historial: MensajeHistorial[];
  guardada: Conversacion | null;
  nombre: string | null;
  telefono: string | null;
  anotado: Anotado;
  proyectoId: string | null;
  /** El contacto del CRM: null si no está, undefined si no se pudo consultar (o no hay CRM). */
  contacto: ContactoCRM | null | undefined;
  /** Lo que pasó con este mensaje, para las etapas automáticas (los flujos lo vacían: mueven ellos). */
  eventos: Evento[];
  /** De qué campaña viene (lib/campanias.ts), decidido con el primer mensaje. */
  campania: { nombre: string; por: CampaniaPor } | null;
  proyecto(id: string | null): Proyecto | null;
  elegirProyecto(id: string): Promise<void>;
  /** La IA contesta (sin consigna) o escribe siguiendo una consigna, y el mensaje sale por Chatwoot. */
  turnoIA(o?: { consigna?: string | null }): Promise<{ texto: string; pasar: PedidoDeEquipo | null }>;
  /** Mueve de etapa según los eventos anotados (etapas automáticas). */
  mover(mas?: Evento[]): Promise<void>;
  /** Mueve a una etapa puntual (un paso de un flujo). */
  moverA(etapa: string, por: string): Promise<void>;
  /** Da de alta a la persona en el CRM si no estaba (los flujos lo hacen al arrancar). */
  asegurarContacto(nota: string): Promise<ContactoCRM | null>;
  /** Un mensaje fijo (con {{nombre}} y {{proyecto}}) y, si hay, un archivo de la base. */
  enviar(texto: string, archivo: number | null): Promise<void>;
  pasarAlEquipo(p: PedidoDeEquipo): Promise<void>;
  /** Vuelve a leer el historial (llegó algo mientras corría un flujo). */
  refrescarHistorial(): Promise<void>;
}

export async function prepararCharla(
  s: Servicios,
  {
    conv,
    linea,
    historial,
    contacto: delAviso,
    bandeja = null,
    eventoPara,
  }: {
    conv: number;
    linea: Linea | null;
    historial: MensajeHistorial[];
    /** El contacto que trae el aviso de Chatwoot (nombre y teléfono de WhatsApp). */
    contacto?: { nombre: string; telefono: string };
    bandeja?: number | null;
    /** Qué fue este mensaje para las etapas automáticas (con lo que ya se sabía de la conversación). */
    eventoPara?: (guardada: Conversacion | null) => Evento;
  },
): Promise<Charla> {
  const ahora = s.ahora ?? (() => new Date());
  const [guardada, todos, tono, ejemplos, reglasEtapa] = await Promise.all([
    s.almacen.conversacion(conv),
    s.almacen.proyectosActivos(),
    s.almacen.tono(),
    s.almacen.ejemplos(),
    // Sin las reglas de etapas, el asistente atiende igual: solo no mueve a nadie.
    s.almacen.reglasEtapa().catch((): ReglasEtapa => ({})),
  ]);
  // Con la lista de precios del hub de cada proyecto que la usa (guardada 10 minutos; si falla, la ficha sola).
  const proyectos = await conListaDePrecios(proyectosDeLinea(linea, todos), s.listaDePrecios);
  // El teléfono y el nombre de WhatsApp, si cambiaron o todavía no estaban (la fila la puede haber creado el historial).
  const telefono = delAviso?.telefono || guardada?.telefono || null;
  const nombre = delAviso?.nombre || guardada?.nombre || null;
  const cambios: Partial<Conversacion> = {};
  if (!guardada || guardada.telefono !== telefono || guardada.nombre !== nombre) Object.assign(cambios, { telefono, nombre });
  if (linea && guardada?.linea !== linea.id) cambios.linea = linea.id;
  if (bandeja != null && guardada?.bandeja !== bandeja) cambios.bandeja = bandeja;
  // La campaña, una sola vez: con el primer mensaje de una conversación nueva (todavía no le
  // escribió nadie). Después no cambia, aunque escriba otra frase.
  let campania: Charla["campania"] = guardada?.campania ? { nombre: guardada.campania, por: guardada.campania_por ?? "frase" } : null;
  let campaniaNueva = false;
  if (!campania && linea && historial.length && historial.every((m) => m.rol === "interesado")) {
    const todas = await s.almacen.campanias().catch(() => []);
    campania = campaniaDe(historial.map((m) => m.texto).join(" \n "), linea, todas);
    if (campania) {
      campaniaNueva = true;
      Object.assign(cambios, { campania: campania.nombre, campania_por: campania.por });
    }
  }
  if (Object.keys(cambios).length) await s.almacen.guardarConversacion({ chatwoot_id: conv, ...cambios });

  const ch: Charla = {
    conv,
    linea,
    tono,
    proyectos,
    historial,
    guardada,
    nombre,
    telefono,
    anotado: guardada?.interesado ?? {},
    proyectoId: guardada?.proyecto ?? (proyectos.length === 1 ? proyectos[0].id : null),
    contacto: undefined,
    eventos: eventoPara ? [eventoPara(guardada)] : [],
    campania,
    proyecto: (id) => proyectos.find((p) => p.id === id) ?? null,
    async elegirProyecto(id) {
      ch.proyectoId = id;
      await s.almacen.guardarConversacion({ chatwoot_id: conv, proyecto: id });
    },
    async turnoIA({ consigna = null } = {}) {
      const herramientas: Herramientas = {
        async registrarInteresado(d) {
          // Primero en la base del asistente: así lo tiene a mano en los próximos mensajes.
          const suma = sumarAnotado(ch.anotado, d);
          const nuevo = suma.cambios.length > 0;
          ch.anotado = suma.anotado;
          await s.almacen.guardarConversacion({ chatwoot_id: conv, interesado: ch.anotado });
          if (!s.crm) return "Anotado. (El CRM no está conectado todavía: seguí la conversación igual.)";
          const cuando = ahora().toISOString();
          // Si al principio no se pudo consultar el CRM, se vuelve a buscar: nunca se crea un repetido.
          if (ch.contacto === undefined) ch.contacto = await buscarEnCRM();
          if (ch.contacto && !nuevo) return "Eso ya estaba anotado: no hace falta registrarlo de nuevo. Seguí la conversación.";
          if (!ch.contacto) {
            ch.contacto = await crearEnCRM(d.resumen, cuando);
            await s.crm.anotarActividad({ contacto: ch.contacto, detalle: `Alta por WhatsApp${lineaEnNota()}. ${d.resumen}`.trim(), ahora: cuando });
            await s.almacen.registrar({ tipo: "crm", conversacion: conv, detalle: `Contacto nuevo ${ch.contacto.id}`, datos: d });
            return "Listo: quedó en el CRM como contacto nuevo.";
          }
          // Solo lo que cambió: lo que ya estaba anotado no se repite en la actividad.
          await s.crm.anotarActividad({ contacto: ch.contacto, detalle: [d.resumen?.trim(), `(${suma.cambios.join(", ")})`].filter(Boolean).join(" "), ahora: cuando });
          // Y en la ficha, lo que estaba vacío (lo que cargó una persona no se toca).
          // Si falla, la actividad ya quedó: se anota el error y la conversación sigue.
          const a = ch.anotado;
          try {
            const completadas = await s.crm.completarVacios({
              id: ch.contacto.id,
              datos: { para: a.para ?? "", ambientes: a.ambientes ?? "", presupuestoUsd: a.presupuesto_usd ?? "", formaDePago: a.forma_de_pago ?? "", plazo: a.plazo ?? "" },
              ahora: cuando,
            });
            if (completadas.length) await s.almacen.registrar({ tipo: "crm", conversacion: conv, detalle: `Completado en ${ch.contacto.id}: ${completadas.join(", ")}` });
          } catch (e) {
            await s.almacen.registrar({ tipo: "error", conversacion: conv, detalle: `CRM (completar la ficha): ${detalle(e)}` });
          }
          await s.almacen.registrar({ tipo: "crm", conversacion: conv, detalle: `Actividad en ${ch.contacto.id}`, datos: d });
          return "Listo: quedó anotado en el CRM (el contacto ya existía).";
        },
        async elegirProyecto(id) {
          const p = ch.proyecto(id);
          if (!p) throw new Error(`No hay un proyecto activo con id ${id}.`);
          await ch.elegirProyecto(p.id);
          return `Quedó elegido. Ficha:\n\n${ficha(p)}`;
        },
        async marcarSenal(senal: Senal) {
          if (!ch.eventos.includes(senal)) ch.eventos.push(senal);
          // Si pidió que no le escriban (o no le interesa), no le salen más seguimientos ni flujos, mueva
          // o no de etapa, aunque vuelva a escribir (lib/baja.ts). El flujo que esté corriendo termina su
          // tramo: el cron ya no lo retoma.
          if (senal === "no_le_interesa" && (await s.almacen.pidioBaja(conv, ahora().toISOString()))) {
            await s.almacen.registrar({ tipo: "pidio_baja", conversacion: conv, detalle: "La IA marcó que no le interesa o que pidió que no le escriban: sin seguimientos ni flujos automáticos." });
          }
          return "Anotado para el equipo. Seguí la conversación sin mencionarlo.";
        },
      };
      // La IA siempre contesta un mensaje de la persona: si lo último lo mandamos nosotros (una espera
      // que venció), va una nota que lo aclara.
      const historialIA =
        consigna && ch.historial.at(-1)?.rol !== "interesado"
          ? [...ch.historial, { id: -1, conversacion: conv, rol: "interesado" as const, texto: "(Nota interna, no la escribió la persona: todavía no respondió a lo último que le mandamos.)", fecha: ahora().toISOString() }]
          : ch.historial;
      const r = await responder({
        modelo: s.modelo,
        instrucciones: instrucciones({ tono, proyectos, proyecto: ch.proyecto(ch.proyectoId), ejemplos, linea }),
        situacion:
          situacion({ ahora: ahora(), nombre: nombre ?? "", telefono: telefono ?? "", crm: ch.contacto, anotado: ch.anotado, horario: tono.horario_equipo }) +
          (consigna ? `\n\n# Lo que tenés que hacer ahora\n\n${consigna}\n\nEscribí un solo mensaje para mandarle ahora, como parte de la conversación.` : ""),
        historial: historialIA,
        proyectos: proyectos.map((p) => p.id),
        herramientas,
      });
      const texto = paraWhatsApp(r.texto);
      if (texto) {
        await s.chatwoot.enviar(conv, texto);
        ch.historial.push({ id: -ch.historial.length - 1, conversacion: conv, rol: "bot", texto, fecha: ahora().toISOString() });
      }
      await s.almacen.registrar({ tipo: "respuesta", conversacion: conv, detalle: texto.slice(0, 500), datos: { fin: r.fin, ...(consigna ? { consigna: consigna.slice(0, 200) } : {}) } });
      return { texto, pasar: r.pasarAPersona ?? (texto ? null : { motivo: "El asistente no supo qué responder.", resumen: "" }) };
    },
    async mover(mas = []) {
      const movido = await moverEtapa({ crm: s.crm, almacen: s.almacen, conversacion: conv, contacto: ch.contacto, eventos: [...ch.eventos, ...mas], reglas: reglasEtapa, ahora: ahora().toISOString() });
      if (movido) ch.contacto = movido;
    },
    async moverA(etapa, por) {
      const contacto = await ch.asegurarContacto(`flujo: ${por}`);
      const movido = await moverAEtapa({ crm: s.crm, almacen: s.almacen, conversacion: conv, contacto, etapa, por, ahora: ahora().toISOString() });
      if (movido) ch.contacto = movido;
    },
    async asegurarContacto(nota) {
      if (!s.crm) return null;
      try {
        if (ch.contacto === undefined) ch.contacto = await buscarEnCRM();
        if (ch.contacto) return ch.contacto;
        const cuando = ahora().toISOString();
        ch.contacto = await crearEnCRM(nota, cuando);
        await s.crm.anotarActividad({ contacto: ch.contacto, detalle: `Alta por WhatsApp${lineaEnNota()}. ${nota}`.trim(), ahora: cuando });
        await s.almacen.registrar({ tipo: "crm", conversacion: conv, detalle: `Contacto nuevo ${ch.contacto.id}` });
        return ch.contacto;
      } catch (e) {
        // Sin el CRM, la conversación sigue igual: solo queda anotado.
        await s.almacen.registrar({ tipo: "error", conversacion: conv, detalle: `CRM (alta): ${detalle(e)}` }).catch(() => {});
        return null;
      }
    },
    async enviar(texto, archivo) {
      const final = textoSeguimiento(texto, {
        nombre: [ch.anotado.nombre, ch.contacto?.nombre, nombre].map(nombreDePila).find(Boolean) ?? "",
        proyecto: ch.proyecto(ch.proyectoId)?.nombre ?? "",
      });
      let etiqueta = "";
      if (archivo) {
        const a = await s.almacen.archivo(archivo);
        if (a) {
          try {
            await s.chatwoot.enviarArchivo(conv, final, a);
            etiqueta = a.tipo.startsWith("image/") ? "[foto]" : a.tipo.startsWith("audio/") ? "[audio]" : "[archivo]";
          } catch (e) {
            // Si Chatwoot no acepta el archivo, sale el texto solo y queda anotado.
            await s.almacen.registrar({ tipo: "error", conversacion: conv, detalle: `No salió el archivo «${a.nombre}»: ${detalle(e)}` });
            if (final) await s.chatwoot.enviar(conv, final);
          }
        } else {
          await s.almacen.registrar({ tipo: "error", conversacion: conv, detalle: `El archivo ${archivo} ya no existe: salió solo el texto.` });
          if (final) await s.chatwoot.enviar(conv, final);
        }
      } else if (final) {
        await s.chatwoot.enviar(conv, final);
      }
      const visto = [final, etiqueta].filter(Boolean).join(" ");
      if (visto) ch.historial.push({ id: -ch.historial.length - 1, conversacion: conv, rol: "bot", texto: visto, fecha: ahora().toISOString() });
    },
    async pasarAlEquipo(p) {
      await pasarAPersona(s, conv, p, ch.contacto ?? null, ahora, { nombre: ch.anotado.nombre || nombre || "", telefono: telefono ?? "", linea: linea?.nombre ?? null, proyecto: ch.proyectoId });
    },
    async refrescarHistorial() {
      const nuevo = await s.almacen.historial(conv, LARGO_HISTORIAL);
      // Lo que mandó el asistente recién puede no haber vuelto todavía como aviso de Chatwoot.
      const propios = ch.historial.filter((m) => m.id < 0 && !nuevo.some((n) => n.rol === "bot" && n.texto === m.texto));
      ch.historial.splice(0, ch.historial.length, ...nuevo, ...propios);
    },
  };

  const lineaEnNota = () => {
    const partes = [linea && `línea «${linea.nombre}»`, campania && `campaña «${campania.nombre}»`].filter(Boolean);
    return partes.length ? ` (${partes.join(", ")})` : "";
  };
  const buscarEnCRM = () => s.crm!.buscar({ id: ch.guardada?.crm_contacto_id, telefono });
  async function crearEnCRM(resumen: string | undefined, cuando: string): Promise<ContactoCRM> {
    const a = ch.anotado;
    const nuevo = await s.crm!.crearContacto(
      {
        nombre: a.nombre || nombre || "",
        telefono: telefono ?? "",
        proyecto: ch.proyectoId,
        para: a.para ?? "",
        ambientes: a.ambientes ?? "",
        presupuestoUsd: a.presupuesto_usd ?? "",
        formaDePago: a.forma_de_pago ?? "",
        plazo: a.plazo ?? "",
        notas: [resumen, a.zona && `Es de: ${a.zona}.`, a.busca_desde && `Busca hace: ${a.busca_desde}.`].filter(Boolean).join(" "),
        tags: campania ? [etiquetaCampania(campania.nombre)] : [],
      },
      cuando,
      // Ya le está hablando el asistente: entra con la etapa del «primer contacto», no como «Nuevo».
      etapaDeAlta(reglasEtapa),
    );
    await s.almacen.guardarConversacion({ chatwoot_id: conv, crm_contacto_id: nuevo.id });
    return nuevo;
  }

  // El contacto del CRM: por el ID que ya quedó anotado o por teléfono.
  if (s.crm) {
    try {
      ch.contacto = await buscarEnCRM();
      if (ch.contacto && ch.contacto.id !== guardada?.crm_contacto_id) await s.almacen.guardarConversacion({ chatwoot_id: conv, crm_contacto_id: ch.contacto.id });
      // Ya estaba en el CRM y vuelve a escribir desde una campaña: queda en la actividad (sus etiquetas no se tocan).
      if (ch.contacto && campaniaNueva && campania) {
        await s.crm.anotarActividad({ contacto: ch.contacto, detalle: `Escribió por WhatsApp${lineaEnNota()}.`, ahora: ahora().toISOString() });
      }
    } catch (e) {
      await s.almacen.registrar({ tipo: "error", conversacion: conv, detalle: `CRM (buscar): ${detalle(e)}` });
    }
  }
  return ch;
}

/** Quién es, para el aviso al hub (sin esto, el aviso dice solo el número de conversación). */
export interface QuienEs {
  nombre: string;
  telefono: string;
  linea: string | null;
  proyecto: string | null;
}

export async function pasarAPersona(
  s: Pick<Servicios, "almacen" | "chatwoot" | "crm" | "avisarAlEquipo">,
  conv: number,
  p: PedidoDeEquipo,
  contacto: ContactoCRM | null,
  ahora: () => Date,
  quien: QuienEs | null = null,
) {
  const nota = [`🙋 El asistente pasó esta conversación al equipo: ${p.motivo}`, p.resumen && `Resumen: ${p.resumen}`, contacto?.responsable && `Responsable en el CRM: ${contacto.responsable}`]
    .filter(Boolean)
    .join("\n");
  await s.chatwoot.notaInterna(conv, nota);
  await s.chatwoot.pasarAPersona(conv);
  await s.almacen.sinSeguimientos(conv).catch(() => {});
  await s.almacen.cancelarCorridas(conv).catch(() => {});
  await s.almacen.registrar({ tipo: "paso_a_persona", conversacion: conv, detalle: p.motivo, datos: p });
  if (s.crm && contacto) {
    await s.crm.anotarActividad({ contacto, detalle: `Pasó al equipo: ${p.motivo}. ${p.resumen}`.trim(), ahora: ahora().toISOString() }).catch(() => {});
  }
  // El aviso en el hub, al responsable del lead. Si falla, queda en el registro: la conversación ya pasó.
  if (s.avisarAlEquipo) {
    await s
      .avisarAlEquipo({
        conversacion: conv,
        nombre: contacto?.nombre || quien?.nombre || "",
        telefono: quien?.telefono || contacto?.telefono || "",
        motivo: p.motivo,
        resumen: p.resumen,
        responsable: contacto?.responsable ?? "",
        contacto: contacto?.id ?? null,
        proyecto: quien?.proyecto ?? contacto?.proyectos[0] ?? null,
        linea: quien?.linea ?? null,
      })
      .catch((e) => s.almacen.registrar({ tipo: "error", conversacion: conv, detalle: `Aviso al hub: ${detalle(e)}` }).catch(() => {}));
  }
}
