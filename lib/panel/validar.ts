/**
 * Lo que se carga en el panel, revisado antes de guardarlo. Puro: recibe lo que vino del
 * formulario y devuelve los datos limpios o un mensaje de error para mostrar.
 */

import { ETAPAS } from "../crm/planilla";
import { esEvento, ETAPAS_DESTINO, type Evento } from "../etapas/reglas";
import type { Proyecto, ReglaSeguimiento, Tono } from "../datos/tipos";
import { MAX_PASOS } from "../seguimientos/reglas";

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

type Formulario = Pick<FormData, "get">;
const texto = (f: Formulario, campo: string) => String(f.get(campo) ?? "").replace(/\r\n/g, "\n").trim();

/** Hasta dónde puede llegar cada campo de la ficha (son textos para el agente, no un folleto entero). */
export const MAX_CAMPO_FICHA = 8000;

export const CAMPOS_FICHA = [
  ["presentacion", "Presentación (lo primero que cuenta del proyecto)"],
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
] as const satisfies readonly (readonly [keyof Proyecto, string])[];

export type FichaEditable = Proyecto & { activo: boolean; notas_internas: string };

/** «Lerma 439» → «lerma-439». */
export const idDesdeNombre = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export function validarProyecto(f: Formulario): Resultado<FichaEditable> {
  const nombre = texto(f, "nombre");
  if (!nombre || nombre.length > 120) return { ok: false, error: "El nombre del proyecto va de 1 a 120 letras." };
  const id = texto(f, "id") || idDesdeNombre(nombre);
  if (!/^[a-z0-9-]+$/.test(id)) return { ok: false, error: "El identificador va en minúsculas, números y guiones (por ejemplo «lerma-439»)." };
  // «nuevo» es la dirección de la pantalla para dar de alta (/panel/proyectos/nuevo).
  if (id === "nuevo") return { ok: false, error: "«nuevo» no puede ser el identificador: elegí otro." };
  const campos = {} as Record<(typeof CAMPOS_FICHA)[number][0], string>;
  for (const [campo, titulo] of CAMPOS_FICHA) {
    const valor = texto(f, campo);
    if (valor.length > MAX_CAMPO_FICHA) return { ok: false, error: `«${titulo}» es muy largo (máximo ${MAX_CAMPO_FICHA} letras).` };
    campos[campo] = valor;
  }
  const notas = texto(f, "notas_internas");
  if (notas.length > MAX_CAMPO_FICHA) return { ok: false, error: "Las notas internas son muy largas." };
  const palabras = [
    ...new Set(
      texto(f, "palabras_clave")
        .split(/[,\n]+/)
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 30);
  return { ok: true, valor: { id, nombre, palabras_clave: palabras, ...campos, activo: f.get("activo") === "on", notas_internas: notas } };
}

export function validarTono(f: Formulario): Resultado<Tono> {
  const textos = {
    instrucciones: texto(f, "instrucciones"),
    criterios_comerciales: texto(f, "criterios_comerciales"),
    cuando_pasar_a_persona: texto(f, "cuando_pasar_a_persona"),
    sobre_la_empresa: texto(f, "sobre_la_empresa"),
    objeciones: texto(f, "objeciones"),
  };
  const t = { ...textos, pasar_al_responder: f.get("pasar_al_responder") === "on" };
  if (!t.instrucciones) return { ok: false, error: "Falta «Quién es y cómo habla»: sin eso el asistente no sabe qué tono usar." };
  if (Object.values(textos).some((v) => v.length > MAX_CAMPO_FICHA)) return { ok: false, error: `Cada texto puede tener hasta ${MAX_CAMPO_FICHA} letras.` };
  return { ok: true, valor: t };
}

export function validarEjemplo(f: Formulario): Resultado<{ titulo: string; conversacion: string }> {
  const titulo = texto(f, "titulo");
  const conversacion = texto(f, "conversacion");
  if (!titulo || titulo.length > 200) return { ok: false, error: "El título va de 1 a 200 letras." };
  if (!conversacion || conversacion.length > 20000) return { ok: false, error: "Pegá la conversación (hasta 20.000 letras)." };
  return { ok: true, valor: { titulo, conversacion } };
}

/** Las etapas que pueden llevar seguimientos (no las cerradas: Vendido y Descartado). */
export const ETAPAS_SEGUIMIENTO = ETAPAS.filter((e) => e !== "Vendido" && e !== "Descartado");
export const ESTADOS_REGLA = ["activa", "a_prueba", "archivada"] as const;

export type ReglaNueva = Omit<ReglaSeguimiento, "id" | "version">;

/** Una regla de etapas: a qué etapa mueve un evento. "" o «no mover» → null. */
export function validarReglaEtapa(evento: string, etapa: unknown): Resultado<{ evento: Evento; etapa: string | null }> {
  if (!esEvento(evento)) return { ok: false, error: "Ese evento no existe." };
  const e = typeof etapa === "string" ? etapa.trim() : "";
  if (!e) return { ok: true, valor: { evento, etapa: null } };
  if (!(ETAPAS_DESTINO as readonly string[]).includes(e)) return { ok: false, error: `El asistente solo puede mover a: ${ETAPAS_DESTINO.join(", ")}. Reserva y Vendido los decide una persona.` };
  return { ok: true, valor: { evento, etapa: e } };
}

export function validarRegla(f: Formulario, proyectos: string[]): Resultado<ReglaNueva> {
  const etapa = texto(f, "etapa");
  if (!(ETAPAS_SEGUIMIENTO as readonly string[]).includes(etapa)) return { ok: false, error: "Elegí una etapa del CRM." };
  const paso = Number(texto(f, "paso"));
  if (!Number.isInteger(paso) || paso < 1 || paso > MAX_PASOS) return { ok: false, error: `El paso va de 1 a ${MAX_PASOS}.` };
  const dias = Number(texto(f, "dias_sin_respuesta"));
  if (!Number.isInteger(dias) || dias < 1 || dias > 90) return { ok: false, error: "Los días sin respuesta van de 1 a 90." };
  const proyecto = texto(f, "proyecto") || null;
  if (proyecto && !proyectos.includes(proyecto)) return { ok: false, error: "Ese proyecto no existe." };
  const mensaje = texto(f, "mensaje");
  if (!mensaje || mensaje.length > 2000) return { ok: false, error: "El mensaje va de 1 a 2000 letras." };
  const otras = mensaje.match(/\{\{[^}]*\}\}/g)?.filter((v) => !/^\{\{\s*(nombre|proyecto)\s*\}\}$/i.test(v));
  if (otras?.length) return { ok: false, error: `Solo se pueden usar {{nombre}} y {{proyecto}} (no ${otras[0]}).` };
  const estado = texto(f, "estado") || "activa";
  if (!(ESTADOS_REGLA as readonly string[]).includes(estado)) return { ok: false, error: "Estado inválido." };
  return { ok: true, valor: { etapa, paso, dias_sin_respuesta: dias, proyecto, mensaje, estado: estado as ReglaNueva["estado"] } };
}
