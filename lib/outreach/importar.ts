/**
 * Cargar una base de leads viejos (docs/outreach.md, «Prospectos»): lo que se pega desde una
 * planilla (columnas separadas por tabulaciones) o un CSV (comas o punto y coma). La primera fila
 * son los títulos; se reconocen por el nombre, sin importar mayúsculas ni tildes.
 *
 * Primero se lee (`leerBase`) y después se decide quién entra a la cola (`revisarBase`) con lo que
 * ya se sabe: los cargados antes, las bajas, los excluidos, el CRM y quién está hablando con
 * Mindlin. Las dos cosas son puras; lib/outreach/datos.ts junta lo que hace falta de la base.
 */

import { normalizarTelefono } from "./telefono";

export const MAX_FILAS = 5000;
export const MAX_TEXTO_BASE = 2_000_000;

export type Columna = "nombre" | "telefono" | "proyecto" | "fecha" | "origen" | "notas";

const TITULOS: Record<Columna, string[]> = {
  nombre: ["nombre", "nombre y apellido", "nombre completo", "name", "contacto", "cliente", "lead"],
  telefono: ["telefono", "tel", "celular", "cel", "movil", "whatsapp", "wsp", "phone", "numero", "nro", "telefono celular"],
  proyecto: ["proyecto", "desarrollo", "emprendimiento", "interes", "consulto por", "producto"],
  fecha: ["fecha", "fecha consulta", "fecha de consulta", "fecha de alta", "creado", "alta", "created", "created at", "fecha de creacion"],
  origen: ["origen", "fuente", "source", "canal", "campana", "campania"],
  notas: ["notas", "nota", "comentario", "comentarios", "observaciones", "obs"],
};

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Parte una línea respetando las comillas de un CSV («"Pérez, Juan"»). */
function partir(linea: string, sep: string): string[] {
  if (sep === "\t") return linea.split("\t").map((c) => c.trim());
  const celdas: string[] = [];
  let actual = "";
  let comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (comillas) {
      if (ch === '"' && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (ch === '"') comillas = false;
      else actual += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) {
      celdas.push(actual.trim());
      actual = "";
    } else actual += ch;
  }
  celdas.push(actual.trim());
  return celdas;
}

function separador(titulos: string): string {
  if (titulos.includes("\t")) return "\t";
  const puntoYComa = (titulos.match(/;/g) ?? []).length;
  const comas = (titulos.match(/,/g) ?? []).length;
  return puntoYComa > comas ? ";" : ",";
}

/** «16/11/2024», «2024-11-16», «16-11-24» → «2024-11-16». Lo que no se entiende, null. */
export function leerFecha(s: string): string | null {
  const t = s.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  let a: number, mes: number, d: number;
  if (m) [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(t);
    if (!m) return null;
    [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (a < 100) a += 2000;
  }
  const f = new Date(Date.UTC(a, mes - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d || a < 2000 || a > 2100) return null;
  return f.toISOString().slice(0, 10);
}

export interface FilaLeida {
  /** El número de fila en lo pegado (la 1 son los títulos). */
  fila: number;
  nombre: string;
  telefono: string | null;
  telefono_original: string;
  /** Por qué el teléfono queda por revisar. */
  motivo_telefono?: string;
  proyecto_texto: string;
  fecha_consulta: string | null;
  origen: string;
  notas: string;
}

export interface BaseLeida {
  /** Qué columna se usó para cada dato, con el título como estaba. */
  columnas: Partial<Record<Columna, string>>;
  /** Columnas que no se reconocieron: van a las notas. */
  otras: string[];
  filas: FilaLeida[];
}

const corto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function leerBase(texto: string): BaseLeida | { error: string } {
  if (texto.length > MAX_TEXTO_BASE) return { error: "Es demasiado grande: cargala en partes (hasta 5000 filas por vez)." };
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return { error: "Pegá la planilla con la fila de títulos y al menos una persona." };
  if (lineas.length - 1 > MAX_FILAS) return { error: `Son ${lineas.length - 1} filas: cargalas en partes de hasta ${MAX_FILAS}.` };

  const sep = separador(lineas[0]);
  const titulos = partir(lineas[0], sep);
  const indice: Partial<Record<Columna, number>> = {};
  titulos.forEach((t, i) => {
    const n = normal(t);
    for (const col of Object.keys(TITULOS) as Columna[]) {
      if (indice[col] === undefined && TITULOS[col].includes(n)) {
        indice[col] = i;
        return;
      }
    }
  });
  // «Nombre» y «Apellido» en columnas separadas: se juntan.
  const apellido = titulos.findIndex((t) => normal(t) === "apellido");
  if (indice.telefono === undefined) return { error: "No encontré la columna del teléfono. Tiene que llamarse «Teléfono», «Celular» o «WhatsApp»." };

  const usadas = new Set([...Object.values(indice), apellido].filter((i) => i !== undefined && i >= 0));
  const otras = titulos.map((t, i) => ({ t, i })).filter(({ t, i }) => !usadas.has(i) && t);
  const celda = (fila: string[], col: Columna) => (indice[col] === undefined ? "" : (fila[indice[col]!] ?? "").trim());

  const filas: FilaLeida[] = lineas.slice(1).map((l, i) => {
    const c = partir(l, sep);
    const tel = normalizarTelefono(celda(c, "telefono"));
    const extra = otras.map(({ t, i: j }) => (c[j]?.trim() ? `${t}: ${c[j].trim()}` : "")).filter(Boolean);
    const nombre = [celda(c, "nombre"), apellido >= 0 ? (c[apellido] ?? "").trim() : ""].filter(Boolean).join(" ");
    return {
      fila: i + 2,
      nombre: corto(nombre, 120),
      telefono: tel.telefono,
      telefono_original: corto(celda(c, "telefono"), 60),
      ...(tel.motivo ? { motivo_telefono: tel.motivo } : {}),
      proyecto_texto: corto(celda(c, "proyecto"), 120),
      fecha_consulta: leerFecha(celda(c, "fecha")),
      origen: corto(celda(c, "origen"), 120),
      notas: corto([celda(c, "notas"), ...extra].filter(Boolean).join(" · "), 2000),
    };
  });

  const columnas: Partial<Record<Columna, string>> = {};
  for (const [col, i] of Object.entries(indice) as [Columna, number][]) columnas[col] = titulos[i];
  if (apellido >= 0) columnas.nombre = [columnas.nombre, titulos[apellido]].filter(Boolean).join(" + ");
  return { columnas, otras: otras.map(({ t }) => t), filas };
}

// ─── Quién entra a la cola ──────────────────────────────────────────────────

export type EstadoFila = "entra" | "por_revisar" | "repetido" | "excluido";

export interface FilaRevisada extends FilaLeida {
  estado: EstadoFila;
  motivo: string;
  /** El proyecto de la ficha que se reconoció en la columna «Proyecto». */
  proyecto: string | null;
}

export interface LoQueSeSabe {
  /** Teléfonos ya cargados en esta línea (en otro lote). */
  yaCargados: Set<string>;
  /** Los «por revisar» ya cargados (sin teléfono): nombre y teléfono como venía (claveSinTelefono). */
  yaCargadosSinTelefono?: Set<string>;
  /** Pidieron la baja (en cualquier línea). */
  bajas: Set<string>;
  /** La lista de excluidos de la línea (por ejemplo, del Registro No Llame). */
  excluidos: Set<string>;
  /** La etapa en el CRM, por teléfono. */
  crm: Map<string, string>;
  /** Están hablando con Mindlin: con el equipo o escribieron a una línea de leads hace poco. */
  enCharla: Set<string>;
  /** Las fichas, para reconocer el proyecto. */
  proyectos: { id: string; nombre: string; palabras_clave: string[] }[];
}

/** Para no cargar dos veces a alguien cuyo teléfono no se entendió. */
export const claveSinTelefono = (nombre: string, telefonoOriginal: string) => `${normal(nombre)}|${telefonoOriginal.replace(/\D/g, "")}`;

/** El proyecto de la ficha que nombra el texto, si nombra uno solo. */
export function proyectoDe(texto: string, proyectos: LoQueSeSabe["proyectos"]): string | null {
  const t = ` ${normal(texto)} `;
  if (!t.trim()) return null;
  const encontrados = proyectos.filter((p) => [p.nombre, ...p.palabras_clave].some((k) => normal(k).length >= 3 && t.includes(` ${normal(k)} `)));
  return encontrados.length === 1 ? encontrados[0].id : null;
}

export function revisarBase(filas: FilaLeida[], s: LoQueSeSabe, o: { incluir_descartados: boolean }): FilaRevisada[] {
  const vistos = new Map<string, number>();
  const vistosSinTelefono = new Set<string>();
  return filas.map((f) => {
    const proyecto = proyectoDe(f.proyecto_texto, s.proyectos);
    const r = (estado: EstadoFila, motivo: string): FilaRevisada => ({ ...f, estado, motivo, proyecto });
    if (!f.telefono) {
      const k = claveSinTelefono(f.nombre, f.telefono_original);
      if (s.yaCargadosSinTelefono?.has(k) || vistosSinTelefono.has(k)) return r("repetido", "ya estaba cargado (por revisar)");
      vistosSinTelefono.add(k);
      return r("por_revisar", f.motivo_telefono ?? "sin teléfono");
    }
    const t = f.telefono;
    const antes = vistos.get(t);
    if (antes !== undefined) return r("repetido", `mismo teléfono que la fila ${antes}`);
    vistos.set(t, f.fila);
    if (s.yaCargados.has(t)) return r("repetido", "ya estaba cargado en otra base");
    if (s.bajas.has(t)) return r("excluido", "pidió que no le escriban más");
    if (s.excluidos.has(t)) return r("excluido", "está en la lista de excluidos");
    const etapa = s.crm.get(t);
    if (etapa === "Reserva" || etapa === "Vendido") return r("excluido", `en el CRM está en ${etapa}`);
    if (etapa === "Descartado" && !o.incluir_descartados) return r("excluido", "en el CRM está Descartado");
    if (s.enCharla.has(t)) return r("excluido", "ya está hablando con Mindlin");
    return r("entra", etapa ? `ya está en el CRM (${etapa})` : "");
  });
}

/** Los totales, para la vista previa y el resultado de la carga. */
export function contarFilas(filas: FilaRevisada[]): Record<EstadoFila, number> {
  const t: Record<EstadoFila, number> = { entra: 0, por_revisar: 0, repetido: 0, excluido: 0 };
  for (const f of filas) t[f.estado]++;
  return t;
}
