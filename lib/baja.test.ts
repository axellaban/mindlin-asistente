import { describe, expect, it } from "vitest";
import { pidioNoEscribir } from "./baja";

describe("«No me escriban más» (lib/baja.ts)", () => {
  it("reconoce los pedidos claros, con o sin tildes, mayúsculas ni signos", () => {
    for (const t of [
      "No me escriban más",
      "no me escribas mas por favor",
      "NO ME MANDEN MÁS MENSAJES!!!",
      "Por favor no me manden nada más",
      "no nos contacten nunca más",
      "No me escribás más",
      "no me llamen más",
      "Nunca más me escriban",
      "Dejen de escribirme",
      "dejá de mandarme mensajes",
      "Quiero dejar de recibir mensajes",
      "Dame de baja",
      "quiero darme de baja",
      "Borrame de la lista",
      "Sáquenme de su base",
      "No quiero recibir más mensajes",
      "no quiero más nada, gracias",
      "No quiero que me escriban",
      "no quiero que me sigan mandando cosas",
      "Basta de mensajes",
      "no molesten más",
      "STOP",
      "Baja.",
      "No me interesa, no me escriban más",
    ]) {
      expect(pidioNoEscribir(t), t).toBe(true);
    }
  });

  it("no confunde frases parecidas (reclamos, preguntas, un «no me interesa» suelto)", () => {
    for (const t of [
      "",
      "Hola, ¿me mandás más info?",
      "No me mandaste más fotos",
      "no me escribiste más",
      "Mandame más info de la 2C",
      "No me interesa el de 2 ambientes, busco 3",
      "No me interesa",
      "No, no me molestás para nada",
      "no me molesta esperar",
      "No quiero que me llamen, prefiero WhatsApp",
      "Sacá de la lista la 2C que ya la vi",
      "¿Hay baja de precio?",
      "Basta, ¡me encantó!",
      "Stop motion",
    ]) {
      expect(pidioNoEscribir(t), t).toBe(false);
    }
  });
});
