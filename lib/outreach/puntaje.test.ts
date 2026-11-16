import { describe, expect, it } from "vitest";
import { aprendizajes, PESOS_DE_FABRICA as W, puntuar, validarPesos, type ParaPuntaje } from "./puntaje";

const base: ParaPuntaje = { nombre: "", proyecto: null, proyecto_texto: "", fecha_consulta: null, origen: "", crm_etapa: null, tiene_whatsapp: null };
const o = { activos: new Set(["lerma-439"]), hoy: "2026-11-16" };

describe("puntaje", () => {
  it("sin nada, solo lo de «sin fecha»", () => {
    expect(puntuar(base, W, o)).toEqual({
      puntaje: 6,
      detalle: [
        { variable: "antiguedad", valor: "sin fecha", puntos: 6 },
        { variable: "proyecto", valor: "sin proyecto", puntos: 0 },
        { variable: "crm", valor: "no está en el CRM", puntos: 0 },
        { variable: "origen", valor: "sin origen", puntos: 0 },
        { variable: "datos", valor: "sin datos", puntos: 0 },
        { variable: "whatsapp", valor: "sin verificar", puntos: 0 },
      ],
    });
  });

  it("el mejor caso no pasa de 100", () => {
    const r = puntuar({ nombre: "Ana", proyecto: "lerma-439", proyecto_texto: "Lerma", fecha_consulta: "2026-09-01", origen: "Referido de Tade", crm_etapa: "Negociación", tiene_whatsapp: true }, W, o);
    expect(r.puntaje).toBe(100);
    expect(r.detalle.find((p) => p.variable === "origen")).toEqual({ variable: "origen", valor: "referido", puntos: 15 });
  });

  it("la antigüedad por meses", () => {
    const v = (fecha: string) => puntuar({ ...base, fecha_consulta: fecha }, W, o).detalle[0].valor;
    expect(v("2026-05-17")).toBe("menos de 6 meses");
    expect(v("2026-05-16")).toBe("de 6 a 12 meses");
    expect(v("2025-06-01")).toBe("de 1 a 2 años");
    expect(v("2023-01-01")).toBe("más de 2 años");
  });

  it("proyecto apagado, CRM y origen que no coincide", () => {
    const r = puntuar({ ...base, proyecto: "via-53", crm_etapa: "Seguimiento", origen: "Feria" }, W, o);
    expect(r.detalle.slice(1, 4)).toEqual([
      { variable: "proyecto", valor: "con ficha apagada", puntos: 8 },
      { variable: "crm", valor: "llegó a seguimiento", puntos: 12 },
      { variable: "origen", valor: "otro", puntos: 0 },
    ]);
  });

  it("los pesos se validan y lo que falta queda de fábrica", () => {
    const r = validarPesos({ whatsapp: 0, antiguedad: { hasta_6_meses: 40 } });
    expect("pesos" in r && r.pesos.whatsapp).toBe(0);
    expect("pesos" in r && r.pesos.antiguedad).toEqual({ ...W.antiguedad, hasta_6_meses: 40 });
    expect(validarPesos({ whatsapp: 60 })).toEqual({ error: "Puntaje: cada valor va de 0 a 50." });
    expect(validarPesos({ origenes: [{ texto: "x", puntos: 3 }] })).toEqual({ error: "Puntaje: cada origen lleva un texto (de 3 a 40 letras) y puntos de 0 a 50." });
    expect(validarPesos(undefined)).toEqual({ pesos: W });
  });

  it("aprendizajes: tasa por variable y muestra chica", () => {
    const d = (valor: string) => [{ variable: "antiguedad" as const, valor, puntos: 0 }];
    const filas = [
      ...Array.from({ length: 30 }, (_, i) => ({ detalle: d("menos de 6 meses"), respondio: i < 9 })),
      { detalle: d("más de 2 años"), respondio: false },
    ];
    expect(aprendizajes(filas)).toEqual([
      { variable: "antiguedad", valor: "menos de 6 meses", contactados: 30, respondieron: 9, tasa: 0.3, muestra_chica: false },
      { variable: "antiguedad", valor: "más de 2 años", contactados: 1, respondieron: 0, tasa: 0, muestra_chica: true },
    ]);
  });
});
