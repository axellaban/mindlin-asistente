/**
 * De qué campaña viene cada lead (mejora 2 de Axel, 15/11; docs/campanias.md). Se decide una sola
 * vez, con el primer mensaje de la conversación:
 *
 * 1. Si el mensaje contiene una frase de una campaña activa (de esa línea o de todas), es esa. Si
 *    coinciden varias, gana la frase más larga (la más específica).
 * 2. Si no, la campaña de la línea, si tiene una.
 * 3. Si no, ninguna.
 *
 * Las frases se comparan sin mayúsculas, acentos ni signos: el anuncio de Meta arma el primer
 * mensaje («¡Hola! Quiero más información sobre Lerma 439») y la persona a veces lo cambia un poco.
 * Puro (sin red ni base).
 */

export interface Campania {
  id: number;
  nombre: string;
  /** Null: vale para todas las líneas. */
  linea: string | null;
  frases: string[];
  activa: boolean;
}

export type CampaniaPor = "frase" | "linea";

/** El largo máximo del nombre: así «Campaña: <nombre>» entra en una etiqueta del CRM (40 letras). */
export const MAX_NOMBRE_CAMPANIA = 30;
/** Una frase de menos de 4 letras coincidiría con cualquier cosa. */
export const MIN_FRASE = 4;
export const MAX_FRASE = 200;
export const MAX_FRASES = 20;

/** «¡Hola! Quiero info» → «hola quiero info»: para comparar sin mayúsculas, acentos ni signos. */
export const textoSimple = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();

export function campaniaDe(texto: string, linea: { id: string; campania: string } | null, campanias: Campania[]): { nombre: string; por: CampaniaPor } | null {
  const t = ` ${textoSimple(texto)} `;
  let mejor: { nombre: string; largo: number } | null = null;
  for (const c of campanias) {
    if (!c.activa || (c.linea && c.linea !== linea?.id)) continue;
    for (const f of c.frases) {
      const frase = textoSimple(f);
      if (frase.length < MIN_FRASE || !t.includes(` ${frase} `)) continue;
      if (!mejor || frase.length > mejor.largo) mejor = { nombre: c.nombre, largo: frase.length };
    }
  }
  if (mejor) return { nombre: mejor.nombre, por: "frase" };
  const deLinea = linea?.campania.trim();
  return deLinea ? { nombre: deLinea, por: "linea" } : null;
}

/** La etiqueta que se le pone en el CRM al lead nuevo (columna Tags). */
export const etiquetaCampania = (nombre: string) => `Campaña: ${nombre}`.slice(0, 40);

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

/** Revisa una campaña que manda el hub antes de guardarla. */
export function validarCampania(x: unknown, lineas: string[]): Resultado<Omit<Campania, "id">> {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const nombre = typeof o.nombre === "string" ? o.nombre.trim().replace(/\s+/g, " ") : "";
  if (!nombre) return { ok: false, error: "Poné un nombre a la campaña." };
  if (nombre.length > MAX_NOMBRE_CAMPANIA) return { ok: false, error: `El nombre de la campaña va hasta ${MAX_NOMBRE_CAMPANIA} letras (queda como etiqueta en el CRM).` };
  const linea = o.linea == null || o.linea === "" ? null : String(o.linea);
  if (linea && !lineas.includes(linea)) return { ok: false, error: "Esa línea no existe." };
  const crudas = Array.isArray(o.frases) ? o.frases : typeof o.frases === "string" ? o.frases.split("\n") : [];
  const frases = [...new Set(crudas.map((f) => String(f ?? "").trim().replace(/\s+/g, " ")).filter(Boolean))];
  if (frases.length > MAX_FRASES) return { ok: false, error: `Hasta ${MAX_FRASES} frases por campaña.` };
  const corta = frases.find((f) => textoSimple(f).length < MIN_FRASE);
  if (corta) return { ok: false, error: `«${corta}» es muy corta: con menos de ${MIN_FRASE} letras coincidiría con cualquier mensaje.` };
  const larga = frases.find((f) => f.length > MAX_FRASE);
  if (larga) return { ok: false, error: `Cada frase va hasta ${MAX_FRASE} letras.` };
  return { ok: true, valor: { nombre, linea, frases, activa: o.activa !== false } };
}
