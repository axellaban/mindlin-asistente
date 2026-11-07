/**
 * Lo que Claude lee antes de contestar. Dos partes:
 * - instrucciones(): estable (tono, reglas, ficha, ejemplos). Cambia solo cuando Mindlin edita
 *   el tono o una ficha, así que se guarda en el caché de Anthropic y sale más barato.
 * - situacion(): lo de esta conversación (fecha y hora, el interesado y lo que dice el CRM).
 *
 * Puro (sin red).
 */

import type { ContactoCRM } from "../crm/planilla";
import type { Ejemplo, Proyecto, Tono } from "../datos/tipos";

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
- Cuando sepas algo de lo que busca la persona (nombre, para vivir o invertir, ambientes, presupuesto, forma de pago, plazo), usá la herramienta registrar_interesado. Hacelo una vez por dato nuevo, sin avisarle.
- Si en la conversación escribió alguien del equipo (aparece como «[Equipo]»), seguí su línea y no lo contradigas.
- Si la persona mandó un audio o una foto que no podés ver, pedile con amabilidad que te lo escriba, o ofrecé que la llame alguien del equipo.`;

export function instrucciones({ tono, proyectos, proyecto, ejemplos }: { tono: Tono; proyectos: Proyecto[]; proyecto: Proyecto | null; ejemplos: Ejemplo[] }): string {
  const partes = [
    `# Quién sos\n\n${tono.instrucciones.trim() || "Sos parte del equipo comercial de Mindlin Developers y atendés consultas por WhatsApp."}`,
    `# Criterios comerciales\n\n${tono.criterios_comerciales.trim() || "Entendé qué busca la persona antes de ofrecer."}`,
    `# Reglas que no se rompen\n\n${REGLAS}`,
    `# Cuándo pasar la conversación a una persona\n\nUsá la herramienta pasar_a_persona cuando: ${tono.cuando_pasar_a_persona.trim() || "la persona lo pida o la consulta no esté en la ficha"}. Antes, en tu mensaje, avisale que alguien del equipo le va a escribir.`,
  ];
  if (proyecto) {
    partes.push(`# El proyecto de esta conversación\n\n${ficha(proyecto)}`);
  } else if (proyectos.length) {
    const lista = proyectos.map((p) => `- ${p.nombre} (id: ${p.id})${p.ubicacion ? `: ${p.ubicacion}` : ""}`).join("\n");
    partes.push(
      `# Proyectos de Mindlin\n\nTodavía no sabés por cuál consulta la persona. Si no queda claro, preguntale. Cuando lo sepas, usá la herramienta elegir_proyecto: te devuelve la ficha. Hasta entonces, no des datos de ningún proyecto.\n\n${lista}`,
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

/** crm: el contacto, null si no está, undefined si no se pudo consultar (o no está conectado). */
export function situacion({ ahora, nombre, telefono, crm }: { ahora: Date; nombre: string; telefono: string; crm: ContactoCRM | null | undefined }): string {
  const lineas = [`- Fecha y hora en Buenos Aires: ${FECHA.format(ahora)}.`];
  lineas.push(`- La persona: ${nombre || "(sin nombre en WhatsApp)"}${telefono ? `, +${telefono}` : ""}.`);
  if (crm === undefined) lineas.push("- CRM: no se pudo consultar ahora.");
  else if (!crm) lineas.push("- CRM: es la primera vez que escribe (no está en el CRM).");
  else {
    lineas.push(`- CRM: ya es contacto. Etapa: ${crm.etapa}.${crm.responsable ? ` Responsable: ${crm.responsable}.` : ""}${crm.ultimoContacto ? ` Último contacto: ${crm.ultimoContacto.slice(0, 10)}.` : ""}`);
    if (crm.notas) lineas.push(`- Notas del equipo sobre esta persona: ${crm.notas.slice(0, 600)}`);
  }
  return `# Esta conversación\n\n${lineas.join("\n")}`;
}
