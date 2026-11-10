import { describe, expect, it } from "vitest";
import { describirIA, eleccionTranscripcion, elegirIA } from "./proveedor";

describe("qué IA responde", () => {
  it("usa la que tenga clave; con las dos, Claude", () => {
    expect(elegirIA({})).toBeNull();
    expect(elegirIA({ OPENAI_API_KEY: "o" })).toEqual({ proveedor: "openai", clave: "o", modelo: "gpt-6.1-sol", esfuerzo: "medium" });
    expect(elegirIA({ ANTHROPIC_API_KEY: "a" })).toEqual({ proveedor: "anthropic", clave: "a", modelo: "claude-opus-5-5", esfuerzo: "medium" });
    expect(elegirIA({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" })?.proveedor).toBe("anthropic");
  });

  it("ASISTENTE_PROVEEDOR lo fija, y sin su clave no arranca", () => {
    expect(elegirIA({ ASISTENTE_PROVEEDOR: "OpenAI", ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" })?.proveedor).toBe("openai");
    expect(elegirIA({ ASISTENTE_PROVEEDOR: "openai", ANTHROPIC_API_KEY: "a" })).toBeNull();
  });

  it("toma el modelo y el esfuerzo de las variables (un esfuerzo desconocido vuelve al de siempre)", () => {
    expect(elegirIA({ OPENAI_API_KEY: "o", ASISTENTE_MODELO: "gpt-6-astra", ASISTENTE_ESFUERZO: "high" })).toMatchObject({ modelo: "gpt-6-astra", esfuerzo: "high" });
    expect(elegirIA({ OPENAI_API_KEY: "o", ASISTENTE_ESFUERZO: "muchisimo" })?.esfuerzo).toBe("medium");
  });

  it("los audios necesitan la clave de OpenAI, aunque responda Claude", () => {
    expect(eleccionTranscripcion({ ANTHROPIC_API_KEY: "a" })).toBeNull();
    expect(eleccionTranscripcion({ OPENAI_API_KEY: "o" })).toEqual({ clave: "o", modelo: "gpt-transcribe" });
    expect(describirIA({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" })).toEqual({ proveedor: "anthropic", modelo: "claude-opus-5-5", audios: true });
  });
});
