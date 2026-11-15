/**
 * Mensajes automáticos espaciados (idea traída de DeskcommCRM, 15/11; docs/seguimientos.md).
 *
 * El cron corre una vez por día, a las 10, y puede tener hasta 20 mensajes para mandar (flujos y
 * seguimientos). Si salen todos en el mismo segundo desde el mismo número, WhatsApp lo ve como un
 * envío masivo: con WAHA, que no es oficial, es la manera más rápida de que bloqueen la línea. Por
 * eso entre un mensaje automático y el siguiente pasan unos segundos al azar, como si los mandara
 * una persona, y la corrida se fija en no pasarse del tiempo que tiene la función de Vercel (300
 * segundos): lo que no entra, sale en la corrida del día siguiente.
 */

/** Entre un seguimiento y el siguiente, entre 4 y 9 segundos al azar. */
export const PAUSA_MIN_MS = 4_000;
export const PAUSA_MAX_MS = 9_000;

/** Los flujos arrancan escalonados dentro de este tiempo (después cada uno tiene sus pausas, hasta 120 s). */
export const ESCALON_FLUJOS_MS = 90_000;

/** Hasta acá manda seguimientos la corrida (contando desde que arrancó): la función corta a los 300 s. */
export const PRESUPUESTO_MS = 240_000;

/** Una pausa al azar entre PAUSA_MIN_MS y PAUSA_MAX_MS. Puro (con `azar` de 0 a 1). */
export function pausaAlAzar(azar: () => number = Math.random): number {
  return Math.round(PAUSA_MIN_MS + azar() * (PAUSA_MAX_MS - PAUSA_MIN_MS));
}

/**
 * Cuándo arranca cada uno de `n` flujos, en milisegundos desde el principio: el primero enseguida y
 * cada uno unos segundos al azar después del anterior. Si no entran en `tope`, se achican las
 * pausas parejo. Puro.
 */
export function escalonar(n: number, azar: () => number = Math.random, tope = ESCALON_FLUJOS_MS): number[] {
  if (n <= 0) return [];
  const pausas = Array.from({ length: n - 1 }, () => pausaAlAzar(azar));
  const total = pausas.reduce((a, b) => a + b, 0);
  const escala = total > tope ? tope / total : 1;
  const inicios = [0];
  let suma = 0;
  for (const p of pausas) inicios.push(Math.round((suma += p) * escala));
  return inicios;
}
