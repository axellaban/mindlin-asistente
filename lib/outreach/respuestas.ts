/**
 * Qué significa lo que contesta alguien de las bases de outreach (docs/outreach.md, «Las
 * respuestas»). Lo usa el webhook en la línea 1 (lib/outreach/webhook.ts).
 *
 * - automática: «Gracias por comunicarte con…», el horario, el aviso de Meta. No cuenta como respuesta.
 * - baja: pidió que no le escriban más (la regla de siempre, lib/baja.ts).
 * - equivocado: «número equivocado», «no soy yo».
 * - no: «no me interesa», «ya compré», «no estoy buscando».
 * - respuesta: todo lo demás (lo atiende el equipo o la IA, según la línea).
 *
 * Es estricta a propósito: ante la duda, «respuesta» (que la vea una persona).
 *
 * Puro.
 */

import { normalizar, pidioNoEscribir } from "../baja";

export type Clasificacion = "automatica" | "baja" | "equivocado" | "no" | "respuesta";

const AUTOMATICAS = [
  /gracias por (comunicarte|comunicarse|contactarte|contactarse|escribirnos|tu mensaje|su mensaje)/,
  /^(hola[!,. ]*)?(bienvenid[oa]s? a|te damos la bienvenida)/,
  /nuestro horario( de atencion)? es/,
  /en este momento no (estamos disponibles|podemos atenderte|podemos responder)/,
  /(te|le) (responderemos|contestaremos|respondemos) (a la brevedad|lo antes posible|en breve)/,
  /esta empresa usa un servicio seguro de meta/,
  /mensaje automatico|respuesta automatica/,
  /fuera (del|de) horario/,
];

const EQUIVOCADO = [/numero equivocado/, /te equivocaste de numero/, /se equivocaron de numero/, /no soy (yo|esa persona|el|ella)\b/, /no conozco a/, /no es (mi|este) numero/];

const NO = [
  /^no[!,. ]*(gracias|muchas gracias)?[!. ]*$/,
  /\bno me interesa\b/,
  /\bno estoy (buscando|interesad[oa])\b/,
  /\bya no (busco|estoy buscando|me interesa)\b/,
  /\bya (compre|alquile|consegui|encontre)\b/,
  /\bno,? gracias\b/,
];

export function clasificarRespuesta(texto: string): Clasificacion {
  const t = normalizar(texto);
  if (!t) return "respuesta";
  if (AUTOMATICAS.some((r) => r.test(t))) return "automatica";
  if (pidioNoEscribir(texto)) return "baja";
  if (EQUIVOCADO.some((r) => r.test(t))) return "equivocado";
  if (NO.some((r) => r.test(t))) return "no";
  return "respuesta";
}

/** Lo que se le contesta a quien pide la baja en la línea 1 (una sola vez). */
export const RESPUESTA_BAJA = "Listo, no te escribimos más. ¡Gracias por avisar! Si algún día querés información, escribinos por acá.";
