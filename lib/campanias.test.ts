import { describe, expect, it } from "vitest";
import { campaniaDe, etiquetaCampania, validarCampania, type Campania } from "./campanias";

const meta: Campania = { id: 1, nombre: "Meta Lerma nov", linea: null, frases: ["Quiero más información sobre Lerma 439"], activa: true };
const mdp: Campania = { id: 2, nombre: "Meta MdP", linea: "linea-4", frases: ["Hola, vi el anuncio", "más información"], activa: true };
const apagada: Campania = { id: 3, nombre: "Vieja", linea: null, frases: ["hola"], activa: false };
const linea3 = { id: "linea-3", campania: "" };
const linea4 = { id: "linea-4", campania: "Leads 2 (general)" };

describe("de qué campaña viene cada lead", () => {
  it("por la frase del anuncio, sin importar mayúsculas, acentos ni signos", () => {
    expect(campaniaDe("¡Hola! Quiero mas informacion sobre LERMA 439.", linea3, [meta, mdp, apagada])).toEqual({ nombre: "Meta Lerma nov", por: "frase" });
  });

  it("una campaña de otra línea no cuenta; si coinciden varias, gana la frase más larga", () => {
    // «más información» es de la línea 4: en la 3 no cuenta.
    expect(campaniaDe("Hola, más información", linea3, [mdp])).toBeNull();
    expect(campaniaDe("Quiero más información sobre Lerma 439", linea4, [meta, mdp])).toEqual({ nombre: "Meta Lerma nov", por: "frase" });
  });

  it("sin frase que coincida, la campaña de la línea; sin eso, ninguna", () => {
    expect(campaniaDe("Buenas, ¿tienen 2 ambientes?", linea4, [meta, mdp])).toEqual({ nombre: "Leads 2 (general)", por: "linea" });
    expect(campaniaDe("Buenas", linea3, [meta])).toBeNull();
    expect(campaniaDe("Buenas", null, [])).toBeNull();
  });

  it("palabras enteras: «información» no coincide adentro de otra palabra", () => {
    const c: Campania = { id: 4, nombre: "X", linea: null, frases: ["info lerma"], activa: true };
    expect(campaniaDe("quiero info lermatica", linea3, [c])).toBeNull();
    expect(campaniaDe("quiero info Lerma!", linea3, [c])).toMatchObject({ nombre: "X" });
  });

  it("la etiqueta del CRM entra en 40 letras", () => {
    expect(etiquetaCampania("Meta Lerma nov")).toBe("Campaña: Meta Lerma nov");
    expect(etiquetaCampania("x".repeat(30)).length).toBeLessThanOrEqual(40);
  });

  it("revisa la campaña antes de guardarla", () => {
    expect(validarCampania({ nombre: "  Meta  Lerma ", frases: "Quiero info de Lerma\n\nQuiero info de Lerma\nVi el anuncio", linea: "" }, ["linea-3"])).toEqual({
      ok: true,
      valor: { nombre: "Meta Lerma", linea: null, frases: ["Quiero info de Lerma", "Vi el anuncio"], activa: true },
    });
    expect(validarCampania({ nombre: "" }, [])).toMatchObject({ ok: false });
    expect(validarCampania({ nombre: "x".repeat(31) }, [])).toMatchObject({ ok: false });
    expect(validarCampania({ nombre: "A", linea: "linea-9" }, ["linea-3"])).toMatchObject({ ok: false, error: "Esa línea no existe." });
    expect(validarCampania({ nombre: "A", frases: ["hol"] }, [])).toMatchObject({ ok: false });
  });
});
