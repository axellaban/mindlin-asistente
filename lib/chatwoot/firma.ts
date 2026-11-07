import { createHmac, timingSafeEqual } from "node:crypto";

/** Un aviso con la hora firmada más vieja (o más nueva) que esto se rechaza: evita que lo repitan. */
export const TOLERANCIA_SEGUNDOS = 300;

/**
 * Chatwoot firma cada aviso al Agent Bot con la clave del bot:
 * X-Chatwoot-Signature = "sha256=" + HMAC-SHA256(clave, `${X-Chatwoot-Timestamp}.${cuerpo}`).
 * Confirmado con Chatwoot 4.19.1 (lib/webhooks/trigger.rb).
 */
export function firmaValida(
  cuerpo: string,
  { hora, firma }: { hora: string | null; firma: string | null },
  clave: string,
  ahoraMs = Date.now(),
): boolean {
  if (!hora || !firma || !clave || !/^\d+$/.test(hora)) return false;
  if (Math.abs(ahoraMs / 1000 - Number(hora)) > TOLERANCIA_SEGUNDOS) return false;
  const esperada = Buffer.from(`sha256=${createHmac("sha256", clave).update(`${hora}.${cuerpo}`).digest("hex")}`);
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/** Para las pruebas: la firma que pondría Chatwoot. */
export function firmar(cuerpo: string, clave: string, hora: number): { hora: string; firma: string } {
  return { hora: String(hora), firma: `sha256=${createHmac("sha256", clave).update(`${hora}.${cuerpo}`).digest("hex")}` };
}
