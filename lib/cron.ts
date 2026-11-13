import { timingSafeEqual } from "node:crypto";

/** Que solo el cron pueda disparar los seguimientos: pide «Authorization: Bearer <CRON_SECRET>». */
export function autorizado(cabecera: string | null, clave: string | undefined): boolean {
  if (!clave?.trim() || !cabecera) return false;
  const esperado = Buffer.from(`Bearer ${clave.trim()}`);
  const recibido = Buffer.from(cabecera.trim());
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}
