/**
 * Modelos para arrancar un flujo sin empezar de cero. Salen de cómo trabajaban los bots de Kommo
 * (el documento «BOTS de Kommo» que pasó Mindlin; ver docs/kommo.md). Los textos son de ejemplo:
 * Mindlin los cambia por los de cada proyecto. Puro.
 */

import type { Paso } from "./modelo";

export interface Plantilla {
  id: string;
  nombre: string;
  /** Para qué sirve, en una línea. */
  descripcion: string;
  pasos: Paso[];
}

const seguimiento = (etapaSiResponde: "Seguimiento" | "Visita / reunión" = "Seguimiento"): Paso => ({
  tipo: "esperar",
  horas: 24,
  si_responde: [
    { tipo: "etapa", etapa: etapaSiResponde },
    { tipo: "equipo", nota: "Respondió a la presentación." },
  ],
  si_no: [
    { tipo: "etapa", etapa: "En pausa" },
    {
      tipo: "mensaje",
      texto:
        "¡Hola {{nombre}}! Espero que estés teniendo un buen día. Te escribo para saber si tenés alguna duda sobre {{proyecto}}. Si lo que ves no es lo que buscás, tenemos otras alternativas que podrían interesarte en distintas ubicaciones.",
      archivo: null,
    },
    { tipo: "pausa", segundos: 15 },
    { tipo: "mensaje", texto: "Me encantaría ayudarte a encontrar la mejor opción. ¡Quedo a disposición, saludos!", archivo: null },
    {
      tipo: "esperar",
      horas: 24,
      si_responde: [
        { tipo: "etapa", etapa: "Seguimiento" },
        { tipo: "equipo", nota: "Respondió al seguimiento." },
      ],
      si_no: [{ tipo: "fin" }],
    },
  ],
});

export const PLANTILLAS: Plantilla[] = [
  {
    id: "presentacion-y-seguimiento",
    nombre: "Presentación, brochure y un seguimiento (como Kommo)",
    descripcion: "Saluda, presenta el proyecto en varios mensajes con pausas, pide que responda y, si no responde en 24 horas, hace un seguimiento y lo pasa a «En pausa».",
    pasos: [
      { tipo: "mensaje", texto: "¡Hola! ¿Cómo estás? Te escribimos desde Mindlin Developers.", archivo: null },
      { tipo: "pausa", segundos: 5 },
      { tipo: "mensaje", texto: "Entiendo que te interesa saber más sobre {{proyecto}}. (Contá acá qué es, quién lo construye y dónde está.)", archivo: null },
      { tipo: "pausa", segundos: 10 },
      { tipo: "mensaje", texto: "(Las tipologías disponibles, con el link a cada ficha.)", archivo: null },
      { tipo: "pausa", segundos: 10 },
      { tipo: "mensaje", texto: "(La forma de pago, por ejemplo: un aporte inicial y cuotas ajustadas por CAC.)", archivo: null },
      { tipo: "pausa", segundos: 15 },
      { tipo: "mensaje", texto: "¡Te dejo el enlace al brochure para que lo veas! (link)", archivo: null },
      { tipo: "pausa", segundos: 10 },
      { tipo: "mensaje", texto: "¡Contame qué te parece el proyecto y las dudas que tengas! Desde ya, muchísimas gracias.", archivo: null },
      seguimiento(),
    ],
  },
  {
    id: "presentacion-con-ia",
    nombre: "La IA presenta y sigue la charla",
    descripcion: "Saluda, la IA presenta el proyecto con su ficha y, si responde, conversa la IA. Si no responde en 24 horas, un seguimiento.",
    pasos: [
      { tipo: "mensaje", texto: "¡Hola! ¿Cómo estás? Te escribimos desde Mindlin Developers.", archivo: null },
      { tipo: "pausa", segundos: 5 },
      { tipo: "ia", consigna: "Presentá el proyecto con lo que dice su ficha (qué es, dónde está y lo que lo hace distinto), en un mensaje corto, y preguntale qué está buscando." },
      {
        tipo: "esperar",
        horas: 24,
        si_responde: [{ tipo: "seguir_ia" }],
        si_no: [
          { tipo: "mensaje", texto: "¡Hola {{nombre}}! ¿Pudiste ver lo de {{proyecto}}? Si querés, te paso los planos o coordinamos una llamada.", archivo: null },
          { tipo: "esperar", horas: 48, si_responde: [{ tipo: "seguir_ia" }], si_no: [{ tipo: "etapa", etapa: "En pausa" }, { tipo: "fin" }] },
        ],
      },
    ],
  },
  {
    id: "presenta-y-llamada",
    nombre: "Presentación con audio y propuesta de llamada",
    descripcion: "Como el bot de 17 y 43: presenta, manda un audio y propone llamar. Si responde, pasa al equipo para que llame.",
    pasos: [
      { tipo: "mensaje", texto: "¡Hola! ¿Cómo estás? Te escribimos desde Mindlin Developers.", archivo: null },
      { tipo: "pausa", segundos: 5 },
      { tipo: "mensaje", texto: "Entiendo que te interesa saber más sobre {{proyecto}}. (Presentación del proyecto.)", archivo: null },
      { tipo: "pausa", segundos: 10 },
      { tipo: "mensaje", texto: "¡Contame qué te parece el proyecto y las dudas que tengas!", archivo: null },
      { tipo: "pausa", segundos: 30 },
      { tipo: "mensaje", texto: "(Subí un audio corto presentándote: se manda como nota de voz.)", archivo: null },
      { tipo: "pausa", segundos: 7 },
      { tipo: "mensaje", texto: "Te llamo en 5 minutos así te doy más detalles. ¿Dale?", archivo: null },
      seguimiento("Visita / reunión"),
    ],
  },
  {
    id: "cuestionario-lotes",
    nombre: "Cuestionario (búsqueda de lotes)",
    descripcion: "Para dueños de terrenos: pide la ubicación, la superficie y qué quieren hacer, y pasa al equipo cuando responden.",
    pasos: [
      { tipo: "mensaje", texto: "¡Hola! Te hablamos desde Mindlin Developers.", archivo: null },
      { tipo: "pausa", segundos: 20 },
      { tipo: "mensaje", texto: "Entendemos que te interesa saber la viabilidad de tu terreno. Si te parece, ¿podrías responder estas preguntas?", archivo: null },
      { tipo: "pausa", segundos: 20 },
      {
        tipo: "mensaje",
        texto:
          "1. ¿En qué ciudad está la propiedad y cuál es la dirección?\n2. ¿Cuál es la superficie aproximada del lote en m² y las medidas del frente?\n3. ¿Qué estás evaluando hacer: vender, canjear por departamentos, saber el valor o comparar opciones?",
        archivo: null,
      },
      { tipo: "esperar", horas: 72, si_responde: [{ tipo: "mensaje", texto: "Con esta información, pronto nos comunicamos. ¡Gracias!", archivo: null }, { tipo: "equipo", nota: "Respondió el cuestionario del lote." }], si_no: [{ tipo: "fin" }] },
    ],
  },
  {
    id: "solo-ia",
    nombre: "Solo la IA",
    descripcion: "Sin mensajes fijos: la IA atiende desde el primer mensaje (como si no hubiera flujo). Útil como punto de partida.",
    pasos: [{ tipo: "seguir_ia" }],
  },
];
