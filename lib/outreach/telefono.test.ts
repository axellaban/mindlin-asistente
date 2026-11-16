import { describe, expect, it } from "vitest";
import { mostrarTelefono, normalizarTelefono, telefonoParaComparar } from "./telefono";

// Números inventados.
describe("normalizarTelefono", () => {
  it.each([
    ["011 15 1234-5678", "5491112345678"],
    ["(011) 1234-5678", "5491112345678"],
    ["11 1234 5678", "5491112345678"],
    ["11 15 1234 5678", "5491112345678"],
    ["+54 9 11 1234-5678", "5491112345678"],
    ["+54 11 1234-5678", "5491112345678"],
    ["+54 9 11 15 1234 5678", "5491112345678"],
    ["0054 9 11 1234 5678", "5491112345678"],
    ["5491112345678", "5491112345678"],
    ["541112345678", "5491112345678"],
    ["0221 15 456-7890", "5492214567890"],
    ["(0223) 15-4567890", "5492234567890"],
    ["0261 4567890", "5492614567890"],
    ["02254 15 456789", "5492254456789"],
    ["+54 (0351) 456-7890", "5493514567890"],
  ])("%s → %s", (original, esperado) => {
    expect(normalizarTelefono(original)).toEqual({ telefono: esperado });
  });

  it.each([
    ["", "sin teléfono"],
    ["1234", "el número es muy corto"],
    ["4567-8901", "falta el código de área"],
    ["15 4567 8901", "falta el código de área"],
    ["+598 99 123 456", "no es un número de Argentina"],
    ["+1 305 555 0101", "no es un número de Argentina"],
  ])("%s queda por revisar (%s)", (original, motivo) => {
    expect(normalizarTelefono(original)).toEqual({ telefono: null, motivo });
  });

  it("si sobran o faltan cifras, no adivina", () => {
    expect(normalizarTelefono("0 2915 15 12345")).toEqual({ telefono: null, motivo: "no se puede saber cuál es el código de área" });
    expect(normalizarTelefono("011 15 1234-56789").telefono).toBeNull();
  });

  it("compara números escritos distinto", () => {
    expect(telefonoParaComparar("+5491112345678")).toBe(telefonoParaComparar("011 15 1234-5678"));
    expect(telefonoParaComparar(null)).toBeNull();
  });

  it("lo muestra legible", () => {
    expect(mostrarTelefono("5491112345678")).toBe("+54 9 11 1234-5678");
    expect(mostrarTelefono("5492214567890")).toBe("+54 9 221 456-7890");
  });
});
