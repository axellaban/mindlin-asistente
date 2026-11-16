/**
 * Las reglas del outreach frío (docs/outreach.md): los cuidados de la línea, la secuencia y sus
 * textos, y la decisión de si puede salir un mensaje ahora. Todo se configura desde el hub; lo
 * marcado «fijo» en el documento no se puede pasar (por ejemplo, más de 3 mensajes sin respuesta).
 *
 * Puro: la base y el reloj vienen de afuera (lib/outreach/datos.ts).
 */

import { normalizarTelefono } from "./telefono";

/** Una franja de envío, en hora de Buenos Aires. Días: 0 domingo … 6 sábado. Horas «HH:MM». */
export interface Franja {
  dias: number[];
  desde: string;
  hasta: string;
}

export interface ConfigOutreach {
  /** Los modos de envío que se usan en esta línea. */
  modos: { waha: boolean; computer_use: boolean };
  /** Mensajes automáticos por día (saludos y seguimientos) al empezar. */
  tope_inicial: number;
  /** Cuánto sube el tope por semana sin frenos, y hasta dónde. */
  tope_suba: number;
  tope_max: number;
  /** Mensajes por tanda (WAHA nativo). */
  tanda: number;
  /** Pausa al azar entre mensajes de la línea, en segundos. */
  pausa_waha: [number, number];
  pausa_agente: [number, number];
  franjas: Franja[];
  /** Días sin envío («AAAA-MM-DD»). */
  feriados: string[];
  /** Mensajes sin respuesta por persona: el saludo y los seguimientos (como mucho, 3). */
  mensajes_max: number;
  /** Días hábiles entre un mensaje sin respuesta y el siguiente. */
  dias_seguimiento: number;
  /** Variantes de cada texto: se alternan, para que no salgan cien mensajes iguales. */
  saludo: string[];
  seguimiento: string[];
  /** Mindlin revisó los textos: sin eso no sale nada (de fábrica hay un borrador). */
  textos_revisados: boolean;
  /** Teléfonos que nunca reciben nada de esta línea (por ejemplo, del Registro No Llame). */
  excluidos: string[];
  /** Cuántos «no salió» o números inválidos seguidos frenan la línea. */
  freno_fallas: number;
}

export const LIMITES_OUTREACH = {
  tope: [1, 200],
  suba: [0, 50],
  tanda: [1, 50],
  pausa: [10, 3600],
  mensajes: [1, 3],
  dias_seguimiento: [1, 15],
  variantes: 5,
  texto: 1000,
  excluidos: 5000,
  freno: [2, 10],
  franjas: 6,
  feriados: 60,
} as const;

/** Los cuidados que ya probó Turnia: 20 por día, tandas de 5, pausas de 3 a 6 minutos. */
export const CONFIG_OUTREACH_DE_FABRICA: ConfigOutreach = {
  modos: { waha: true, computer_use: true },
  tope_inicial: 20,
  tope_suba: 5,
  tope_max: 60,
  tanda: 5,
  pausa_waha: [180, 360],
  pausa_agente: [45, 90],
  franjas: [
    { dias: [1, 2, 3, 4, 5], desde: "10:00", hasta: "13:00" },
    { dias: [1, 2, 3, 4, 5], desde: "15:00", hasta: "19:00" },
  ],
  feriados: [],
  mensajes_max: 2,
  dias_seguimiento: 2,
  saludo: [
    "Hola {nombre}, ¿cómo estás? Te escribo de Mindlin Developers. Hace un tiempo nos consultaste por un departamento. ¿Seguís buscando?",
    "¡Hola {nombre}! Soy de Mindlin Developers. Nos habías escrito hace un tiempo por un departamento: ¿todavía estás buscando?",
  ],
  seguimiento: [
    "{nombre}, te escribo de nuevo por si se te pasó. Si te sirve, te cuento lo que tenemos hoy{proyecto_en}. Y si ya no buscás, avisame y no te escribo más.",
    "Hola {nombre}, ¿pudiste ver mi mensaje? Si seguís buscando, te paso las novedades{proyecto_en}. Si no, decime y no te molesto más.",
  ],
  textos_revisados: false,
  excluidos: [],
  freno_fallas: 3,
};

const HORA = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const esObjeto = (x: unknown): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x);

/** Un entero dentro de un rango, o el error para mostrar. */
function entero(x: unknown, [min, max]: readonly [number, number], nombre: string): number | string {
  const n = Number(x);
  return Number.isInteger(n) && n >= min && n <= max ? n : `${nombre}: tiene que ser un número entre ${min} y ${max}.`;
}

function textos(x: unknown, nombre: string): string[] | string {
  if (!Array.isArray(x)) return `${nombre}: falta.`;
  const t = x.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (!t.length) return `${nombre}: escribí al menos un texto.`;
  if (t.length > LIMITES_OUTREACH.variantes) return `${nombre}: como mucho ${LIMITES_OUTREACH.variantes} variantes.`;
  if (t.some((v) => v.length > LIMITES_OUTREACH.texto)) return `${nombre}: cada texto, hasta ${LIMITES_OUTREACH.texto} caracteres.`;
  const desconocida = t.join(" ").match(/\{(?!nombre\}|proyecto\}|proyecto_en\})[^}]*\}/);
  if (desconocida) return `${nombre}: «${desconocida[0]}» no es una variable. Se pueden usar {nombre}, {proyecto} y {proyecto_en}.`;
  if (/https?:\/\/|www\./i.test(t.join(" ")) && nombre === "Saludo") return "Saludo: va sin links (el link, si hace falta, va después de que responda).";
  return t;
}

function pausa(x: unknown, nombre: string): [number, number] | string {
  if (!Array.isArray(x) || x.length !== 2) return `${nombre}: falta.`;
  const a = entero(x[0], LIMITES_OUTREACH.pausa, nombre);
  const b = entero(x[1], LIMITES_OUTREACH.pausa, nombre);
  if (typeof a === "string") return a;
  if (typeof b === "string") return b;
  return a <= b ? [a, b] : `${nombre}: la mínima no puede ser mayor que la máxima.`;
}

/**
 * La configuración bien armada, o el primer error en castellano. Lo que falta se completa con lo
 * de fábrica (así un hub viejo que no manda un campo nuevo no rompe nada).
 */
export function validarConfigOutreach(x: unknown): { config: ConfigOutreach } | { error: string } {
  if (!esObjeto(x)) return { error: "Falta la configuración." };
  const o = { ...CONFIG_OUTREACH_DE_FABRICA, ...x } as Record<string, unknown>;
  const modos = esObjeto(o.modos) ? o.modos : {};
  const c: Partial<ConfigOutreach> = { modos: { waha: modos.waha === true, computer_use: modos.computer_use === true } };

  const checks: [keyof ConfigOutreach, number | string | [number, number] | string[]][] = [
    ["tope_inicial", entero(o.tope_inicial, LIMITES_OUTREACH.tope, "Tope diario")],
    ["tope_suba", entero(o.tope_suba, LIMITES_OUTREACH.suba, "Suba por semana")],
    ["tope_max", entero(o.tope_max, LIMITES_OUTREACH.tope, "Tope máximo")],
    ["tanda", entero(o.tanda, LIMITES_OUTREACH.tanda, "Tanda")],
    ["pausa_waha", pausa(o.pausa_waha, "Pausa (WAHA)")],
    ["pausa_agente", pausa(o.pausa_agente, "Pausa (computer use)")],
    ["mensajes_max", entero(o.mensajes_max, LIMITES_OUTREACH.mensajes, "Mensajes sin respuesta")],
    ["dias_seguimiento", entero(o.dias_seguimiento, LIMITES_OUTREACH.dias_seguimiento, "Días hasta el seguimiento")],
    ["freno_fallas", entero(o.freno_fallas, LIMITES_OUTREACH.freno, "Freno")],
    ["saludo", textos(o.saludo, "Saludo")],
    ["seguimiento", textos(o.seguimiento, "Seguimiento")],
  ];
  for (const [campo, v] of checks) {
    if (typeof v === "string") return { error: v };
    (c as Record<string, unknown>)[campo] = v;
  }
  if (c.tope_max! < c.tope_inicial!) return { error: "Tope máximo: no puede ser menor que el tope diario." };
  if ((c.pausa_agente as [number, number])[0] < 30) return { error: "Pausa (computer use): la mínima es de 30 segundos." };
  if ((c.pausa_waha as [number, number])[0] < 60) return { error: "Pausa (WAHA): la mínima es de 60 segundos." };

  if (!Array.isArray(o.franjas) || !o.franjas.length) return { error: "Franjas: cargá al menos una." };
  if (o.franjas.length > LIMITES_OUTREACH.franjas) return { error: `Franjas: como mucho ${LIMITES_OUTREACH.franjas}.` };
  const franjas: Franja[] = [];
  for (const f of o.franjas) {
    if (!esObjeto(f) || !Array.isArray(f.dias)) return { error: "Franjas: cada una lleva días, desde y hasta." };
    const dias = [...new Set(f.dias.map(Number))].sort();
    if (!dias.length || dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return { error: "Franjas: los días van de domingo (0) a sábado (6)." };
    const desde = String(f.desde ?? "");
    const hasta = String(f.hasta ?? "");
    if (!HORA.test(desde) || !HORA.test(hasta) || minutos(desde) >= minutos(hasta)) return { error: "Franjas: «desde» y «hasta» van como 10:00 y 13:00, y «desde» antes que «hasta»." };
    if (minutos(desde) < 9 * 60 || minutos(hasta) > 20 * 60) return { error: "Franjas: solo de 9 a 20 (la regla de WhatsApp del asistente)." };
    franjas.push({ dias, desde, hasta });
  }
  c.franjas = franjas;

  const feriados = Array.isArray(o.feriados) ? [...new Set(o.feriados.map(String))] : [];
  if (feriados.length > LIMITES_OUTREACH.feriados || feriados.some((f) => !/^\d{4}-\d{2}-\d{2}$/.test(f))) return { error: "Feriados: van como 2026-12-08." };
  c.feriados = feriados.sort();

  const excluidos: string[] = [];
  for (const t of Array.isArray(o.excluidos) ? o.excluidos : []) {
    const n = normalizarTelefono(String(t));
    if (!n.telefono) return { error: `Excluidos: «${String(t)}» ${n.motivo}.` };
    excluidos.push(n.telefono);
  }
  if (excluidos.length > LIMITES_OUTREACH.excluidos) return { error: `Excluidos: como mucho ${LIMITES_OUTREACH.excluidos}.` };
  c.excluidos = [...new Set(excluidos)];
  c.textos_revisados = o.textos_revisados === true;
  if (!c.modos!.waha && !c.modos!.computer_use) return { error: "Modos: elegí al menos uno (WAHA nativo o computer use)." };
  return { config: c as ConfigOutreach };
}

// ─── El reloj de Buenos Aires ───────────────────────────────────────────────

/** Buenos Aires no cambia de hora: siempre UTC−3. */
const BA_MS = 3 * 60 * 60 * 1000;

export interface Momento {
  /** «AAAA-MM-DD» en Buenos Aires. */
  fecha: string;
  dia: number;
  minuto: number;
}

export function enBuenosAires(ahora: Date): Momento {
  const ba = new Date(ahora.getTime() - BA_MS);
  return { fecha: ba.toISOString().slice(0, 10), dia: ba.getUTCDay(), minuto: ba.getUTCHours() * 60 + ba.getUTCMinutes() };
}

/** Las 00:00 de Buenos Aires de esa fecha. */
const inicioDelDia = (fecha: string) => new Date(`${fecha}T03:00:00.000Z`);

export function enFranja(c: Pick<ConfigOutreach, "franjas" | "feriados">, ahora: Date): boolean {
  const m = enBuenosAires(ahora);
  if (c.feriados.includes(m.fecha)) return false;
  return c.franjas.some((f) => f.dias.includes(m.dia) && m.minuto >= minutos(f.desde) && m.minuto < minutos(f.hasta));
}

/** Cuándo abre la próxima franja (para «sale a las 15:00»). Null si no hay ninguna en dos semanas. */
export function proximaFranja(c: Pick<ConfigOutreach, "franjas" | "feriados">, ahora: Date): Date | null {
  const hoy = enBuenosAires(ahora);
  for (let d = 0; d < 15; d++) {
    const dia = new Date(inicioDelDia(hoy.fecha).getTime() + d * 86_400_000);
    const m = enBuenosAires(dia);
    if (c.feriados.includes(m.fecha)) continue;
    const aperturas = c.franjas
      .filter((f) => f.dias.includes(m.dia))
      .map((f) => new Date(dia.getTime() + minutos(f.desde) * 60_000))
      .filter((t) => t > ahora)
      .sort((a, b) => a.getTime() - b.getTime());
    if (aperturas.length) return aperturas[0];
  }
  return null;
}

/** El inicio del día hábil que cae `n` días hábiles después (sin sábados, domingos ni feriados). */
export function masDiasHabiles(ahora: Date, n: number, feriados: string[]): Date {
  let dia = inicioDelDia(enBuenosAires(ahora).fecha);
  let faltan = n;
  while (faltan > 0) {
    dia = new Date(dia.getTime() + 86_400_000);
    const m = enBuenosAires(dia);
    if (m.dia !== 0 && m.dia !== 6 && !feriados.includes(m.fecha)) faltan--;
  }
  return dia;
}

// ─── El tope que sube de a poco ─────────────────────────────────────────────

/**
 * El tope de hoy. Sube `tope_suba` por cada semana entera sin frenos desde la última suba, hasta
 * `tope_max`. Devuelve también lo que hay que guardar si subió (o si no había nada guardado).
 */
export function topeVigente(
  guardado: { tope: number | null; tope_desde: string | null },
  c: Pick<ConfigOutreach, "tope_inicial" | "tope_suba" | "tope_max">,
  ahora: Date,
  huboFrenoDesde: (desde: string) => boolean,
): { tope: number; guardar?: { tope: number; tope_desde: string } } {
  const hoy = enBuenosAires(ahora).fecha;
  if (guardado.tope == null || !guardado.tope_desde) return { tope: c.tope_inicial, guardar: { tope: c.tope_inicial, tope_desde: hoy } };
  // Si en el hub bajaron el tope o el máximo, manda lo nuevo.
  let tope = Math.min(Math.max(guardado.tope, c.tope_inicial), c.tope_max);
  const dias = Math.floor((inicioDelDia(hoy).getTime() - inicioDelDia(guardado.tope_desde).getTime()) / 86_400_000);
  if (dias >= 7 && c.tope_suba > 0 && tope < c.tope_max) {
    if (huboFrenoDesde(guardado.tope_desde)) return { tope, guardar: { tope, tope_desde: hoy } };
    tope = Math.min(tope + c.tope_suba, c.tope_max);
    return { tope, guardar: { tope, tope_desde: hoy } };
  }
  return { tope };
}

// ─── Los textos ─────────────────────────────────────────────────────────────

/** Lo que se sabe de la persona para armar el texto. */
export interface ParaTexto {
  id: number;
  nombre: string;
  proyecto_nombre: string | null;
}

/** El primer nombre, prolijo: «MARÍA JOSÉ pérez» → «María». Vacío si no parece un nombre. */
export function primerNombre(nombre: string): string {
  const p = nombre.trim().split(/\s+/)[0] ?? "";
  if (!/^[\p{L}'-]{2,}$/u.test(p)) return "";
  return p.charAt(0).toLocaleUpperCase("es") + p.slice(1).toLocaleLowerCase("es");
}

/**
 * El texto de un paso para una persona. `paso` 0 es el saludo; 1 y 2, los seguimientos. La
 * variante se alterna por persona (siempre la misma para la misma persona y el mismo paso).
 */
export function textoDelPaso(c: Pick<ConfigOutreach, "saludo" | "seguimiento">, paso: number, p: ParaTexto): { texto: string; version: number } {
  const variantes = paso === 0 ? c.saludo : c.seguimiento;
  const version = (p.id + paso) % variantes.length;
  const nombre = primerNombre(p.nombre);
  const proyecto = p.proyecto_nombre?.trim() ?? "";
  let texto = variantes[version]
    .replaceAll("{proyecto_en}", proyecto ? ` en ${proyecto}` : "")
    .replaceAll("{proyecto}", proyecto || "nuestros proyectos")
    .replaceAll("{nombre}", nombre);
  if (!nombre) {
    // «Hola , ¿cómo estás?» → «Hola, ¿cómo estás?»; «¡Hola !» → «¡Hola!»; «, te escribo» al principio → «Te escribo».
    texto = texto
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/^[,\s]+/, "")
      .replace(/^\p{Ll}/u, (l) => l.toLocaleUpperCase("es"));
  }
  return { texto: texto.replace(/[ \t]{2,}/g, " ").trim(), version: version + 1 };
}

// ─── ¿Puede salir un mensaje ahora? ─────────────────────────────────────────

export type MotivoEspera =
  | { motivo: "borrador" }
  | { motivo: "pausada" }
  | { motivo: "frenada"; detalle: string }
  | { motivo: "fuera_de_horario"; abre: string | null }
  | { motivo: "tope"; tope: number }
  | { motivo: "pausa"; hasta: string }
  | { motivo: "ocupada"; por: string; hasta: string }
  | { motivo: "modo"; modo: Modo };

export type Modo = "waha" | "computer_use";

export interface EstadoLinea {
  pausada: boolean;
  frenado: string | null;
  forzar_dia: string | null;
  siguiente_desde: string | null;
  enviados_hoy: number;
  tope: number;
  /** Alguien tiene tomado un contacto de esta línea (uno a la vez, para respetar las pausas). */
  toma: { por: string; hasta: string } | null;
}

/**
 * Si se puede tomar el siguiente contacto para mandarle. Lo revisa el servidor en cada pedido: la
 * pantalla solo pregunta. `quien` es el que pide (si ya tiene la toma, puede seguir con ella).
 */
export function puedeTomar(c: ConfigOutreach, e: EstadoLinea, modo: Modo, ahora: Date, quien: string): { ok: true } | MotivoEspera {
  if (!c.modos[modo]) return { motivo: "modo", modo };
  if (!c.textos_revisados) return { motivo: "borrador" };
  if (e.pausada) return { motivo: "pausada" };
  if (e.frenado) return { motivo: "frenada", detalle: e.frenado };
  const hoy = enBuenosAires(ahora).fecha;
  if (!enFranja(c, ahora) && e.forzar_dia !== hoy) return { motivo: "fuera_de_horario", abre: proximaFranja(c, ahora)?.toISOString() ?? null };
  if (e.enviados_hoy >= e.tope) return { motivo: "tope", tope: e.tope };
  if (e.toma && new Date(e.toma.hasta) > ahora && e.toma.por !== quien) return { motivo: "ocupada", por: e.toma.por, hasta: e.toma.hasta };
  if (e.siguiente_desde && new Date(e.siguiente_desde) > ahora) return { motivo: "pausa", hasta: e.siguiente_desde };
  return { ok: true };
}

/** Cuándo puede salir el siguiente: una pausa al azar dentro del rango del modo. */
export function siguienteDesde(c: ConfigOutreach, modo: Modo, ahora: Date, azar: () => number = Math.random): Date {
  const [min, max] = modo === "waha" ? c.pausa_waha : c.pausa_agente;
  return new Date(ahora.getTime() + Math.round(min + azar() * (max - min)) * 1000);
}

/** Lo que se le dice a quien opera, en una línea. */
export function textoEspera(m: MotivoEspera): string {
  switch (m.motivo) {
    case "borrador":
      return "Los textos de la secuencia todavía son el borrador: revisalos y marcalos como revisados en «Secuencia».";
    case "pausada":
      return "La línea está pausada.";
    case "frenada":
      return `La línea está frenada: ${m.detalle}. Revisá WhatsApp y tocá «Seguir».`;
    case "fuera_de_horario":
      return m.abre ? "Fuera de horario. Sigue en la próxima franja." : "Fuera de horario y no hay franjas cargadas para los próximos días.";
    case "tope":
      return `Ya salieron los ${m.tope} de hoy. Sigue mañana.`;
    case "pausa":
      return "Pausa entre mensajes.";
    case "ocupada":
      return `La está usando ${m.por}: los mensajes salen de a uno.`;
    case "modo":
      return m.modo === "waha" ? "El envío por WAHA está apagado en esta línea." : "El envío con computer use está apagado en esta línea.";
  }
}
