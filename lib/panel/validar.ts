/**
 * Lo que se carga en el panel, revisado antes de guardarlo. Puro: recibe lo que vino del
 * formulario y devuelve los datos limpios o un mensaje de error para mostrar.
 */

import { MAX_NOMBRE_CAMPANIA } from "../campanias";
import { ETAPAS } from "../crm/planilla";
import { esEvento, ETAPAS_DESTINO, type Evento } from "../etapas/reglas";
import type { Proyecto, ReglaSeguimiento, Tono } from "../datos/tipos";
import { MAX_PASOS } from "../seguimientos/reglas";
import { HORARIO_EQUIPO_DE_FABRICA, horarioValido, type HorarioEquipo } from "../agente/horario";
import type { Linea } from "../lineas";
import { LIMITES, validarPasos, type Paso } from "../flujos/modelo";

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
  if (!textos.instrucciones) return { ok: false, error: "Falta «Quién es y cómo habla»: sin eso el asistente no sabe qué tono usar." };
  if (Object.values(textos).some((v) => v.length > MAX_CAMPO_FICHA)) return { ok: false, error: `Cada texto puede tener hasta ${MAX_CAMPO_FICHA} letras.` };
  const horario = leerHorario(f);
  if (!horario.ok) return horario;
  return { ok: true, valor: { ...textos, pasar_al_responder: f.get("pasar_al_responder") === "on", horario_equipo: horario.valor } };
}

/**
 * El horario del equipo comercial. En el panel, una casilla por día (equipo_dia_1 … equipo_dia_0)
 * y las horas (equipo_desde, equipo_hasta); el hub manda los días como lista (equipo_dias).
 * Si no viene nada, el de fábrica.
 */
function leerHorario(f: Formulario): Resultado<HorarioEquipo> {
  const lista = f.get("equipo_dias");
  const desde = texto(f, "equipo_desde");
  const hasta = texto(f, "equipo_hasta");
  const casillas = [0, 1, 2, 3, 4, 5, 6].filter((d) => f.get(`equipo_dia_${d}`) === "on");
  if (lista == null && !desde && !hasta && !casillas.length) return { ok: true, valor: HORARIO_EQUIPO_DE_FABRICA };
  const dias = lista != null ? String(lista).split(/[,\s]+/).filter(Boolean).map(Number) : casillas;
  if (!dias.length) return { ok: false, error: "Marcá al menos un día en el horario del equipo." };
  if (dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return { ok: false, error: "Los días del horario del equipo van de 0 (domingo) a 6 (sábado)." };
  const h = horarioValido({ dias, desde: desde === "" ? Number.NaN : Number(desde), hasta: hasta === "" ? Number.NaN : Number(hasta) });
  if (!h) return { ok: false, error: "El horario del equipo va en horas enteras de 0 a 24, y «desde» tiene que ser antes que «hasta» (por ejemplo, de 9 a 20)." };
  return { ok: true, valor: h };
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

export function validarRegla(f: Formulario, proyectos: string[], lineas: string[] = []): Resultado<ReglaNueva> {
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
  const linea = texto(f, "linea") || null;
  if (linea && !lineas.includes(linea)) return { ok: false, error: "Esa línea no existe." };
  return { ok: true, valor: { etapa, paso, dias_sin_respuesta: dias, proyecto, mensaje, estado: estado as ReglaNueva["estado"], linea } };
}

/** Lo que se cambia de una línea desde el hub o el panel (el tipo y el orden, no). */
export type LineaEditable = Pick<Linea, "nombre" | "descripcion" | "telefono" | "bandeja" | "pausada" | "pasar_al_responder" | "instrucciones" | "proyectos" | "campania">;

export function validarLinea(f: Formulario, proyectos: string[]): Resultado<LineaEditable> {
  const nombre = texto(f, "nombre");
  if (!nombre || nombre.length > 80) return { ok: false, error: "El nombre de la línea va de 1 a 80 letras." };
  const descripcion = texto(f, "descripcion");
  if (descripcion.length > 1000) return { ok: false, error: "La descripción es muy larga (hasta 1000 letras)." };
  const telefono = texto(f, "telefono");
  if (telefono.length > 40 || /[^\d\s+()-]/.test(telefono)) return { ok: false, error: "El teléfono va con números (por ejemplo, +54 9 11 5555-0000)." };
  const crudo = texto(f, "bandeja");
  const bandeja = crudo ? Number(crudo) : null;
  if (bandeja !== null && (!Number.isInteger(bandeja) || bandeja <= 0)) return { ok: false, error: "La bandeja es el número de la bandeja (inbox) en Chatwoot: un número entero, como 1 o 2." };
  const instrucciones = texto(f, "instrucciones");
  if (instrucciones.length > MAX_CAMPO_FICHA) return { ok: false, error: `Las instrucciones de la línea pueden tener hasta ${MAX_CAMPO_FICHA} letras.` };
  const elegidos = [
    ...new Set(
      texto(f, "proyectos")
        .split(/[,\s]+/)
        .filter(Boolean),
    ),
  ];
  const noExiste = elegidos.find((p) => !proyectos.includes(p));
  if (noExiste) return { ok: false, error: `El proyecto «${noExiste}» no existe.` };
  const campania = texto(f, "campania").replace(/\s+/g, " ");
  if (campania.length > MAX_NOMBRE_CAMPANIA) return { ok: false, error: `La campaña de la línea va hasta ${MAX_NOMBRE_CAMPANIA} letras (queda como etiqueta en el CRM).` };
  return { ok: true, valor: { nombre, descripcion, telefono, bandeja, pausada: f.get("pausada") === "on", pasar_al_responder: f.get("pasar_al_responder") === "on", instrucciones, proyectos: elegidos, campania } };
}

export interface FlujoValidado {
  nombre: string;
  proyecto: string | null;
  pasos: Paso[];
}

/** Un flujo que mandan el hub o el panel. Los pasos se revisan en lib/flujos/modelo.ts. */
export function validarFlujo(x: { nombre?: unknown; proyecto?: unknown; pasos?: unknown }, { proyectos, archivos }: { proyectos: string[]; archivos?: Set<number> }): Resultado<FlujoValidado> {
  const nombre = typeof x.nombre === "string" ? x.nombre.trim() : "";
  if (!nombre || nombre.length > LIMITES.nombre) return { ok: false, error: `El nombre del flujo va de 1 a ${LIMITES.nombre} letras.` };
  const proyecto = typeof x.proyecto === "string" && x.proyecto.trim() ? x.proyecto.trim() : null;
  if (proyecto && !proyectos.includes(proyecto)) return { ok: false, error: "Ese proyecto no existe." };
  const pasos = validarPasos(x.pasos, { archivos });
  if (!pasos.ok) return pasos;
  return { ok: true, valor: { nombre, proyecto, pasos: pasos.valor } };
}

/** Los archivos que se pueden mandar por WhatsApp desde un flujo. */
export const TIPOS_ARCHIVO = ["image/jpeg", "image/png", "image/webp", "audio/ogg", "audio/mpeg", "audio/mp4", "application/pdf", "video/mp4"] as const;
/** 2,5 MB: entra en un pedido a Vercel (4,5 MB) aun pasado a base64. Un folleto más pesado va como link en el texto. */
export const MAX_ARCHIVO_BYTES = 2_621_440;

const empieza = (d: Uint8Array, firma: number[], desde = 0) => firma.every((b, i) => d[desde + i] === b);
const ascii = (t: string) => [...t].map((c) => c.charCodeAt(0));

/**
 * ¿El contenido es lo que dice el tipo? Se miran las primeras letras del archivo (su «firma»), así
 * un .exe renombrado a .jpg no entra aunque el navegador diga «image/jpeg». Puro.
 */
export function coincideElContenido(tipo: string, d: Uint8Array): boolean {
  switch (tipo) {
    case "image/jpeg":
      return empieza(d, [0xff, 0xd8, 0xff]);
    case "image/png":
      return empieza(d, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return empieza(d, ascii("RIFF")) && empieza(d, ascii("WEBP"), 8);
    case "audio/ogg":
      return empieza(d, ascii("OggS"));
    case "audio/mpeg":
      // Con etiqueta ID3 o directo un cuadro de MP3 (11 bits en 1).
      return empieza(d, ascii("ID3")) || (d[0] === 0xff && (d[1] & 0xe0) === 0xe0);
    case "audio/mp4":
    case "video/mp4":
      return empieza(d, ascii("ftyp"), 4);
    case "application/pdf": {
      // Algunos programas dejan unos bytes antes de «%PDF-»: se busca en el primer KB.
      const inicio = Buffer.from(d.subarray(0, 1024)).toString("latin1");
      return inicio.includes("%PDF-");
    }
    default:
      return false;
  }
}

export function validarArchivo(x: { nombre?: unknown; tipo?: unknown; datos?: unknown }): Resultado<{ nombre: string; tipo: string; datos: Uint8Array }> {
  const nombre = typeof x.nombre === "string" ? x.nombre.trim().replace(/[\\/]/g, "-").slice(0, 200) : "";
  if (!nombre) return { ok: false, error: "Falta el nombre del archivo." };
  const tipo = typeof x.tipo === "string" ? x.tipo.toLowerCase().split(";")[0].trim() : "";
  if (!(TIPOS_ARCHIVO as readonly string[]).includes(tipo)) return { ok: false, error: "Se pueden subir fotos (JPG, PNG, WEBP), audios (OGG, MP3, M4A), PDF o videos MP4." };
  if (typeof x.datos !== "string" || !/^[A-Za-z0-9+/=\s]+$/.test(x.datos)) return { ok: false, error: "El archivo no llegó bien: volvé a subirlo." };
  const datos = new Uint8Array(Buffer.from(x.datos, "base64"));
  if (!datos.byteLength) return { ok: false, error: "El archivo está vacío." };
  if (datos.byteLength > MAX_ARCHIVO_BYTES) return { ok: false, error: "El archivo pesa más de 2,5 MB. Para un folleto pesado, pegá el link en el texto del mensaje." };
  if (!coincideElContenido(tipo, datos)) return { ok: false, error: "El archivo no es lo que dice ser (por ejemplo, un .jpg que en realidad no es una foto). Exportalo de nuevo desde el programa donde lo hiciste y volvé a subirlo." };
  return { ok: true, valor: { nombre, tipo, datos } };
}
