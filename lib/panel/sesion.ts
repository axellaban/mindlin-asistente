/**
 * La sesión del panel: una cookie firmada con quién entró y hasta cuándo.
 *
 * Se entra con PANEL_CLAVE (en Vercel) y el nombre de quien edita (queda en «actualizado_por»).
 * La firma usa una clave derivada de PANEL_CLAVE: si se cambia la clave, se cierran todas las
 * sesiones. Puro (sin red ni cookies): lo usa lib/panel/servidor.ts.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_SESION = "panel_sesion";
/** 30 días: el equipo no tiene que entrar cada vez. */
export const DURACION_SESION_MS = 30 * 86_400_000;

const firmar = (texto: string, clave: string) => createHmac("sha256", `panel:${clave}`).update(texto).digest("base64url");

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** ¿La clave que escribió es la del panel? (sin clave cargada en Vercel, nunca) */
export function claveCorrecta(escrita: string, clave: string | undefined): boolean {
  const c = clave?.trim();
  if (!c || !escrita) return false;
  // Se comparan las firmas (mismo largo) para no revelar el largo de la clave.
  return iguales(firmar(escrita, c), firmar(c, c));
}

/** El nombre como queda en la base: sin espacios de más, hasta 60 letras. */
export const limpiarNombre = (n: string) => n.replace(/\s+/g, " ").trim().slice(0, 60);

export function crearToken(nombre: string, clave: string, ahoraMs = Date.now()): string {
  const datos = Buffer.from(JSON.stringify({ n: limpiarNombre(nombre), e: ahoraMs + DURACION_SESION_MS })).toString("base64url");
  return `${datos}.${firmar(datos, clave)}`;
}

/** Quién entró, o null si la cookie no es válida, venció o se cambió la clave. */
export function leerToken(token: string | undefined, clave: string | undefined, ahoraMs = Date.now()): string | null {
  const c = clave?.trim();
  if (!token || !c) return null;
  const [datos, firma, ...resto] = token.split(".");
  if (!datos || !firma || resto.length || !iguales(firma, firmar(datos, c))) return null;
  try {
    const { n, e } = JSON.parse(Buffer.from(datos, "base64url").toString("utf8")) as { n?: unknown; e?: unknown };
    if (typeof n !== "string" || !n || typeof e !== "number" || e < ahoraMs) return null;
    return n;
  } catch {
    return null;
  }
}
