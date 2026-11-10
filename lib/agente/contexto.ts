/**
 * Lo que Claude lee antes de contestar. Dos partes:
 * - instrucciones(): estable (tono, reglas, ficha, ejemplos). Cambia solo cuando Mindlin edita
 *   el tono o una ficha, así que se guarda en el caché de Anthropic y sale más barato.
 * - situacion(): lo de esta conversación (fecha y hora, el interesado y lo que dice el CRM).
 *
 * Puro (sin red).
 */

import type { ContactoCRM } from "../crm/planilla";
import type { Anotado, Ejemplo, Proyecto, Tono } from "../datos/tipos";
import { describirAnotado } from "./anotado";

const CAMPOS_FICHA: [keyof Proyecto, string][] = [
  ["descripcion", "Descripción"],
  ["ubicacion", "Ubicación"],
  ["etapa_obra", "Etapa de obra"],
  ["entrega", "Entrega"],
  ["tipologias", "Tipologías y superficies"],
  ["precios", "Precios"],
  ["financiacion", "Financiación y formas de pago"],
  ["disponibilidad", "Disponibilidad"],
  ["amenities", "Amenities"],
  ["preguntas_frecuentes", "Preguntas frecuentes"],
  ["links", "Links para compartir (folleto, planos, ubicación)"],
];

/** La ficha de un proyecto como la lee el agente. Lo vacío se marca: así no lo inventa. */
export function ficha(p: Proyecto): string {
  const lineas = CAMPOS_FICHA.map(([campo, titulo]) => {
    const valor = String(p[campo] ?? "").trim();
    return `### ${titulo}\n${valor || "(Sin datos: no lo informes; ofrecé que lo confirme el equipo.)"}`;
  });
  return `## ${p.nombre} (id: ${p.id})\n\n${lineas.join("\n\n")}`;
}

const REGLAS = `- Usá solo la información de la ficha del proyecto de esta conversación. Si un dato no está (precio, disponibilidad, plazos, condiciones, descuentos), no lo inventes ni lo estimes: decí que lo confirmás con el equipo y ofrecé que lo contacte una persona.
- Cada ficha vale solo para su proyecto: nunca mezcles datos de un proyecto con otro.
- No prometas reservas, descuentos ni condiciones especiales.
- Escribís por WhatsApp: mensajes cortos, sin títulos ni listas largas. Como mucho, *negrita* para un dato puntual.
- Si te preguntan si sos una persona o un bot, contestá con honestidad: sos el asistente virtual de Mindlin Developers y una persona del equipo puede seguir la conversación cuando quiera.
- Cuando sepas algo nuevo de lo que busca la persona (nombre, para vivir o invertir, ambientes, presupuesto, forma de pago, plazo), usá la herramienta registrar_interesado, sin avisarle. Lo que ya está en «Lo que ya sabés de esta persona» no hace falta volver a registrarlo ni a preguntarlo.
- Una pregunta por mensaje. No pidas todos los datos juntos: que sea una charla, no un formulario.
- Si en la conversación escribió alguien del equipo (aparece como «[Equipo]»), seguí su línea y no lo contradigas.
- Los audios llegan transcriptos así: [audio: «lo que dijo»]. Respondé a lo que dice, por escrito, sin aclarar que era un audio.
- Si aparece solo [audio] (no se pudo transcribir) o una [foto] o un [archivo] que no podés ver, pedile con amabilidad que te lo escriba, o ofrecé que la llame alguien del equipo.`;

export function instrucciones({ tono, proyectos, proyecto, ejemplos }: { tono: Tono; proyectos: Proyecto[]; proyecto: Proyecto | null; ejemplos: Ejemplo[] }): string {
  const partes = [
    `# Quién sos\n\n${tono.instrucciones.trim() || "Sos parte del equipo comercial de Mindlin Developers y atendés consultas por WhatsApp."}`,
    `# Criterios comerciales\n\n${tono.criterios_comerciales.trim() || "Entendé qué busca la persona antes de ofrecer."}`,
    `# Reglas que no se rompen\n\n${REGLAS}`,
    `# Cuándo pasar la conversación a una persona\n\nUsá la herramienta pasar_a_persona cuando: ${tono.cuando_pasar_a_persona.trim() || "la persona lo pida o la consulta no esté en la ficha"}. Antes, en tu mensaje, avisale que alguien del equipo le va a escribir.`,
  ];
  // Con un proyecto ya elegido, de los otros va solo el nombre: ningún dato que se pueda mezclar.
  const lista = (ps: Proyecto[], { ubicacion = true } = {}) =>
    ps
      .map((p) => {
        const otros = p.palabras_clave.filter((k) => k.toLowerCase() !== p.nombre.toLowerCase());
        return `- ${p.nombre} (id: ${p.id})${ubicacion && p.ubicacion ? `: ${p.ubicacion}` : ""}${otros.length ? ` También lo pueden nombrar así: ${otros.join(", ")}.` : ""}`;
      })
      .join("\n");
  if (proyecto) {
    partes.push(`# El proyecto de esta conversación\n\n${ficha(proyecto)}`);
    const otros = proyectos.filter((p) => p.id !== proyecto.id);
    if (otros.length) {
      partes.push(
        `# Otros proyectos de Mindlin\n\nSi la persona pregunta por otro de estos, usá la herramienta elegir_proyecto para cambiar: te devuelve su ficha. Sin esa ficha no des ningún dato de otro proyecto.\n\n${lista(otros, { ubicacion: false })}`,
      );
    }
  } else if (proyectos.length) {
    partes.push(
      `# Proyectos de Mindlin\n\nTodavía no sabés por cuál consulta la persona. Si no queda claro, preguntale. Cuando lo sepas, usá la herramienta elegir_proyecto: te devuelve la ficha. Hasta entonces, no des datos de ningún proyecto.\n\n${lista(proyectos)}`,
    );
  } else {
    partes.push("# Proyectos\n\nNo hay fichas cargadas: no des datos de proyectos. Tomá los datos de la persona y pasala al equipo.");
  }
  if (ejemplos.length) {
    partes.push(`# Ejemplos de cómo habla Mindlin\n\n${ejemplos.map((e) => `## ${e.titulo}\n${e.conversacion.trim()}`).join("\n\n")}`);
  }
  return partes.join("\n\n");
}

const FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Cuándo trabaja el equipo comercial (hora de Buenos Aires). Si cambia, se cambia acá. */
export const HORARIO_EQUIPO = { dias: [1, 2, 3, 4, 5], desde: 9, hasta: 20, texto: "de lunes a viernes de 9 a 20" } as const;

const DIA_Y_HORA = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", hour: "numeric", hourCycle: "h23" });
const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** ¿Está trabajando el equipo ahora? */
export function equipoTrabajando(ahora: Date): boolean {
  const partes = DIA_Y_HORA.formatToParts(ahora);
  const dia = DIAS.indexOf(partes.find((p) => p.type === "weekday")?.value ?? "");
  const hora = Number(partes.find((p) => p.type === "hour")?.value);
  return (HORARIO_EQUIPO.dias as readonly number[]).includes(dia) && hora >= HORARIO_EQUIPO.desde && hora < HORARIO_EQUIPO.hasta;
}

/** Lo que el CRM ya sabe de lo que busca (cargado por el equipo o por el asistente). */
function loQueDiceElCRM(c: ContactoCRM): string {
  return [
    c.para && `para: ${c.para}`,
    c.ambientes && `ambientes: ${c.ambientes}`,
    c.presupuestoUsd && `presupuesto: USD ${c.presupuestoUsd}`,
    c.formaDePago && `forma de pago: ${c.formaDePago}`,
    c.plazo && `plazo: ${c.plazo}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/** crm: el contacto, null si no está, undefined si no se pudo consultar (o no está conectado). */
export function situacion({
  ahora,
  nombre,
  telefono,
  crm,
  anotado,
}: {
  ahora: Date;
  nombre: string;
  telefono: string;
  crm: ContactoCRM | null | undefined;
  anotado?: Anotado | null;
}): string {
  const lineas = [`- Fecha y hora en Buenos Aires: ${FECHA.format(ahora)}.`];
  if (!equipoTrabajando(ahora)) {
    lineas.push(
      `- El equipo comercial no está trabajando ahora (atiende ${HORARIO_EQUIPO.texto}). Vos seguí atendiendo normal; si pasás la conversación a una persona, avisale que le escriben apenas vuelvan, sin prometer una hora exacta.`,
    );
  }
  lineas.push(`- Nombre en WhatsApp: ${nombre || "(no tiene)"}${telefono ? `. Teléfono: +${telefono}` : ""}.`);
  if (crm === undefined) lineas.push("- CRM: no se pudo consultar ahora.");
  else if (!crm) lineas.push("- CRM: es la primera vez que escribe (no está en el CRM).");
  else {
    lineas.push(`- CRM: ya es contacto. Etapa: ${crm.etapa}.${crm.responsable ? ` Responsable: ${crm.responsable}.` : ""}${crm.ultimoContacto ? ` Último contacto: ${crm.ultimoContacto.slice(0, 10)}.` : ""}`);
    const sabe = loQueDiceElCRM(crm);
    if (sabe) lineas.push(`- En el CRM figura: ${sabe}.`);
    if (crm.proximoPaso) lineas.push(`- Próximo paso que anotó el equipo: ${crm.proximoPaso}${crm.fechaProximoPaso ? ` (${crm.fechaProximoPaso.slice(0, 10)})` : ""}. No lo contradigas.`);
    if (crm.notas) lineas.push(`- Notas del equipo sobre esta persona: ${crm.notas.slice(0, 600)}`);
  }
  const yaSabe = describirAnotado(anotado);
  if (yaSabe) lineas.push(`- Lo que ya sabés de esta persona (lo anotaste vos): ${yaSabe}.`);
  if (anotado?.resumen) lineas.push(`- Tu último resumen para el equipo: ${anotado.resumen}`);
  return `# Esta conversación\n\n${lineas.join("\n")}`;
}
