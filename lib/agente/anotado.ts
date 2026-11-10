/**
 * Lo que el asistente ya sabe de la persona, sumando lo que anota en cada mensaje. Puro.
 *
 * Sirve para dos cosas: que lo tenga a mano en cada respuesta (aunque la charla sea larga y el
 * principio ya no entre en el historial) y no repetir en el CRM lo que ya estaba anotado.
 */

import type { Anotado } from "../datos/tipos";
import type { DatosRegistro } from "./agente";

export const CAMPOS_ANOTADOS = [
  ["nombre", "nombre"],
  ["para", "para"],
  ["ambientes", "ambientes"],
  ["presupuesto_usd", "presupuesto (USD)"],
  ["forma_de_pago", "forma de pago"],
  ["plazo", "plazo"],
] as const satisfies readonly (readonly [keyof Anotado & keyof DatosRegistro, string])[];

const limpio = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 300) : "");

/** Suma lo nuevo a lo que ya estaba (lo vacío no borra nada) y dice qué datos cambiaron. */
export function sumarAnotado(antes: Anotado | null | undefined, d: Partial<DatosRegistro>): { anotado: Anotado; cambios: string[] } {
  const anotado: Anotado = { ...(antes ?? {}) };
  const cambios: string[] = [];
  for (const [campo, titulo] of CAMPOS_ANOTADOS) {
    const valor = limpio(d[campo]);
    if (valor && valor.toLowerCase() !== (anotado[campo] ?? "").toLowerCase()) {
      anotado[campo] = valor;
      cambios.push(campo === "presupuesto_usd" ? `presupuesto: USD ${valor}` : `${titulo}: ${valor}`);
    }
  }
  const resumen = limpio(d.resumen);
  if (resumen) anotado.resumen = resumen;
  return { anotado, cambios };
}

/** «nombre: Ana; para: Invertir; …», o "" si no sabe nada. */
export function describirAnotado(a: Anotado | null | undefined): string {
  if (!a) return "";
  return CAMPOS_ANOTADOS.filter(([campo]) => a[campo])
    .map(([campo, titulo]) => `${titulo}: ${a[campo]}`)
    .join("; ");
}
