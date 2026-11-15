import { describe, expect, it } from "vitest";
import { borradorDeEjemplo } from "./revisiones";

describe("revisar respuestas reales", () => {
  it("el borrador del ejemplo: diálogo con lo de antes, sin el nombre de la persona ni sus números", () => {
    const b = borradorDeEjemplo(
      [
        { rol: "interesado", texto: "Hola, soy Ana Prueba, mi cel es +54 9 11 5555-0000" },
        { rol: "bot", texto: "¡Hola Ana! ¿Buscás para vivir o invertir?" },
        { rol: "interesado", texto: "Invertir, 2 ambientes" },
      ],
      "Perfecto, Ana. En Lerma 439 hay 2 ambientes desde USD 105.000.",
      "Ana Prueba",
    );
    expect(b).toBe(
      [
        "Interesado: Hola, soy [nombre] [nombre], mi cel es [número]",
        "Asistente: ¡Hola [nombre]! ¿Buscás para vivir o invertir?",
        "Interesado: Invertir, 2 ambientes",
        "Asistente: Perfecto, [nombre]. En Lerma 439 hay 2 ambientes desde USD 105.000.",
      ].join("\n"),
    );
    // Sin nombre: igual saca los números largos, y no toca los precios ni el «439».
    expect(borradorDeEjemplo([], "Llamame al 11 4444 0000. Lerma 439, USD 88.000", null)).toBe("Asistente: Llamame al [número]. Lerma 439, USD 88.000");
  });
});
