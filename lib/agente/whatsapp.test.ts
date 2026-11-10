import { describe, expect, it } from "vitest";
import { sumarAnotado, describirAnotado } from "./anotado";
import { paraWhatsApp } from "./whatsapp";

describe("el texto para WhatsApp", () => {
  it("pasa el Markdown al formato de WhatsApp", () => {
    expect(paraWhatsApp("Son **USD 100.000** y __en pesos__ no.")).toBe("Son *USD 100.000* y *en pesos* no.");
    expect(paraWhatsApp("### Precios\nDesde USD 100.000")).toBe("*Precios*\nDesde USD 100.000");
    expect(paraWhatsApp("Mirá [los planos](https://ejemplo.com/p.pdf) o https://ejemplo.com")).toBe("Mirá los planos: https://ejemplo.com/p.pdf o https://ejemplo.com");
    expect(paraWhatsApp("[https://ejemplo.com](https://ejemplo.com)")).toBe("https://ejemplo.com");
    expect(paraWhatsApp("Opciones:\n* 2 ambientes\n* 3 ambientes")).toBe("Opciones:\n- 2 ambientes\n- 3 ambientes");
    expect(paraWhatsApp("Hola\n\n\n\n---\nChau  ")).toBe("Hola\n\nChau");
  });

  it("no toca lo que ya está bien ni copia la marca del equipo", () => {
    const bien = "¡Hola! Hay *2 ambientes* de 45 m², _a estrenar_. ¿Para vivir o invertir?";
    expect(paraWhatsApp(bien)).toBe(bien);
    expect(paraWhatsApp("[Equipo] Te paso los planos")).toBe("Te paso los planos");
    expect(paraWhatsApp("5 * 3 = 15")).toBe("5 * 3 = 15");
  });
});

describe("lo que el asistente ya anotó", () => {
  it("suma lo nuevo, lo vacío no borra y dice qué cambió", () => {
    const a = sumarAnotado({}, { nombre: "Ana", para: "", ambientes: "2", presupuesto_usd: "", forma_de_pago: "", plazo: "", resumen: "Busca 2." });
    expect(a).toEqual({ anotado: { nombre: "Ana", ambientes: "2", resumen: "Busca 2." }, cambios: ["nombre: Ana", "ambientes: 2"] });
    const b = sumarAnotado(a.anotado, { nombre: "ana", para: "Invertir", ambientes: "2", presupuesto_usd: "90000", resumen: "" });
    expect(b.cambios).toEqual(["para: Invertir", "presupuesto: USD 90000"]);
    expect(b.anotado).toEqual({ nombre: "Ana", ambientes: "2", para: "Invertir", presupuesto_usd: "90000", resumen: "Busca 2." });
    expect(describirAnotado(b.anotado)).toBe("nombre: Ana; para: Invertir; ambientes: 2; presupuesto (USD): 90000");
    expect(describirAnotado(null)).toBe("");
  });
});
