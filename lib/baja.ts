/**
 * «No me escriban más» (docs/baja.md): una sola regla para reconocer cuando alguien pide que no le
 * escriban, la misma para el webhook y para la IA (idea traída de DeskcommCRM).
 *
 * Es a propósito estricta: reconoce pedidos claros («no me escriban más», «dame de baja», «dejen de
 * mandarme mensajes», «STOP» solo) y no frases que se parecen («no me interesa el de 2 ambientes»,
 * «no me molesta esperar»). Un «no me interesa» suelto lo decide la IA con su señal
 * (`no_le_interesa`), que además lo pasa a Descartado.
 *
 * Lo que pasa cuando alguien pide la baja: no le salen más seguimientos ni flujos automáticos en esa
 * conversación (aunque vuelva a escribir o el equipo se la devuelva al asistente). El asistente le
 * contesta una vez, corto, y si la persona vuelve a escribir, le responde como siempre: lo que se
 * frena es lo que sale solo. El equipo puede seguir escribiéndole a mano.
 */

/** En minúsculas, sin tildes ni signos, con un espacio entre palabras. Puro. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Solo pedidos («escriban», «mandes», «envíe»): «no me mandaste más fotos» es un reclamo, no una baja.
const PIDE = "(escrib(an|as|a)|mand(en|es|e)|envi(en|es|e)|contact(en|es|e)|llam(en|es|e))";
// Para «no quiero que me…»: sin «llamen» («no quiero que me llamen, prefiero WhatsApp»).
const PIDE_ESCRITO = "(escrib(an|as|a)|mand(en|es|e)|envi(en|es|e)|contact(en|es|e))";

const PEDIDOS: RegExp[] = [
  // «no me escriban más», «no me manden nada más», «no nos contacten nunca más», «no me escribas mas por favor»
  new RegExp(`\\bno (me|nos) ${PIDE}( nada| ningun mensaje| mensajes| nunca)? mas\\b`),
  // «nunca más me escriban»
  new RegExp(`\\bnunca mas (me|nos) ${PIDE}\\b`),
  // «dejen de escribirme», «dejá de mandarme mensajes», «deje de molestar», «quiero dejar de recibir mensajes»
  /\bdej(en|a|e|ar|ame|enme) de (escribir|mandar|enviar|contactar|llamar|molestar|recibir)[a-z]*\b/,
  // «dame de baja», «denme de baja», «quiero darme de baja», «me doy de baja»
  /\b(dame|denme|darme|deme|me doy|me di|quiero la) (de )?baja\b/,
  // «borrame de la lista», «sáquenme de su base», «eliminame de los contactos» (solo «-me»: «sacá de la lista la 2C» no)
  /\b(borr|sac|saqu|elimin|quit)(ame|enme|eme|arme) de (la|las|su|sus|tu|tus|esta|este|los|el) (lista|listas|base|bases|listado|difusion|contactos|grupo)\b/,
  // «no quiero recibir más mensajes», «no quiero más nada»
  /\bno quiero (recibir )?(mas|ningun|ninguna) (mensaje|mensajes|info|informacion|nada)\b/,
  // «no quiero que me escriban», «no quiero que me sigan mandando»
  new RegExp(`\\bno quiero que (me|nos) (sigan |vuelvan a )?(${PIDE_ESCRITO}|(escribiendo|mandando|enviando|contactando)|(escribir|mandar|enviar|contactar)(me|nos)?)\\b`),
  // «basta de mensajes», «basta de escribirme»
  /\bbasta de (mensajes|escribir|mandar)[a-z]*\b/,
  // «no molesten más», «no me molesten» («no me molestás» es lo contrario)
  /\bno (me |nos )?molest(en|es)\b/,
];

/** El mensaje entero es una sola palabra de baja («STOP», «Baja», «Basta»). */
const SOLO = /^(stop|baja|basta|unsubscribe|desuscribir|desuscribirme|cancelar suscripcion)$/;

/** ¿Este mensaje pide que no le escriban más? Puro. */
export function pidioNoEscribir(texto: string): boolean {
  const t = normalizar(texto);
  if (!t) return false;
  if (SOLO.test(t)) return true;
  return PEDIDOS.some((r) => r.test(t));
}

/** Lo que tiene que hacer la IA con el mensaje en que la persona pidió la baja. */
export const CONSIGNA_BAJA =
  "La persona pidió que no le escribamos más (o algo muy parecido). Si es eso, contestale en una sola línea, con respeto, que no le vamos a escribir más y que si algún día quiere información puede escribir por acá. No ofrezcas nada, no preguntes nada y no insistas. Marcá la señal «no_le_interesa». Si en realidad pide otra cosa (que lo llamen, que le escriban por mail), respondé a eso.";

/** La nota para el CRM y el registro. */
export const NOTA_BAJA = "Pidió que no le escriban más por WhatsApp: el asistente no le manda más seguimientos ni flujos automáticos.";
