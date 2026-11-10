import { timingSafeEqual } from "node:crypto";

/** ¿El encabezado es «Authorization: Bearer <clave>»? Sin clave cargada, nunca. Compara sin filtrar tiempos. */
export function bearerCorrecto(autorizacion: string | null, clave: string | undefined): boolean {
  const s = clave?.trim();
  if (!s || !autorizacion) return false;
  const esperado = Buffer.from(`Bearer ${s}`);
  const recibido = Buffer.from(autorizacion);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

/**
 * ¿El pedido viene del cron de Vercel? Vercel manda «Authorization: Bearer <CRON_SECRET>».
 * Sin CRON_SECRET cargado, nadie puede disparar los seguimientos.
 */
export function esElCron(autorizacion: string | null, secreto: string | undefined): boolean {
  return bearerCorrecto(autorizacion, secreto);
}
