import { describe, expect, it } from "vitest";
import type { MensajeHistorial } from "../chatwoot/evento";
import { motivoParaFrenar } from "./limites";

const AHORA = new Date("2026-11-10T14:00:00Z");
let id = 0;
/** Un mensaje `segundos` antes de AHORA. */
const m = (rol: MensajeHistorial["rol"], texto: string, segundos: number): MensajeHistorial => ({
  id: ++id,
  conversacion: 7,
  rol,
  texto,
  fecha: new Date(AHORA.getTime() - segundos * 1000).toISOString(),
});

describe("cuándo el asistente deja de responder", () => {
  it("una charla normal sigue", () => {
    expect(motivoParaFrenar([m("interesado", "Hola", 120), m("bot", "¡Hola! ¿En qué te ayudo?", 110), m("interesado", "Quiero info de Lerma", 30)], AHORA)).toBeNull();
  });

  it("un contestador automático que repite el mismo mensaje", () => {
    const auto = "Gracias por escribirnos, en breve te respondemos.";
    const h = [m("interesado", auto, 300), m("bot", "¡Hola!", 290), m("interesado", auto, 200), m("bot", "¿Me contás?", 190), m("interesado", " gracias por ESCRIBIRNOS, en breve te respondemos. ", 10)];
    expect(motivoParaFrenar(h, AHORA)).toContain("contestador automático");
    // Un «hola» repetido es corto: no cuenta.
    expect(motivoParaFrenar([m("interesado", "hola", 30), m("interesado", "hola", 20), m("interesado", "hola", 10)], AHORA)).toBeNull();
  });

  it("alguien que contesta al instante varias veces seguidas", () => {
    const h = [];
    for (let i = 5; i >= 1; i--) h.push(m("bot", `respuesta ${i}`, i * 60), m("interesado", `mensaje ${i}`, i * 60 - 1));
    expect(motivoParaFrenar(h, AHORA)).toContain("al instante");
    // Si una de las respuestas fue lenta, se corta la racha.
    const lenta = [m("bot", "a", 400), m("interesado", "x", 399), m("bot", "b", 300), m("interesado", "y", 250), m("bot", "c", 200), m("interesado", "z", 199)];
    expect(motivoParaFrenar(lenta, AHORA)).toBeNull();
  });

  it("muchos mensajes en media hora, o muchas respuestas del asistente", () => {
    const rafaga = Array.from({ length: 25 }, (_, i) => m("interesado", `mensaje distinto ${i}`, 60 * i + 5));
    expect(motivoParaFrenar(rafaga, AHORA)).toContain("más de 24 mensajes");
    const respuestas = Array.from({ length: 20 }, (_, i) => [m("interesado", `pregunta ${i}`, 80 * i + 40), m("bot", `respuesta ${i}`, 80 * i + 20)]).flat().reverse();
    expect(motivoParaFrenar(respuestas, AHORA)).toContain("respondió 20 veces");
  });
});
