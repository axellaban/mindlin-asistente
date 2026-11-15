import { describe, expect, it } from "vitest";
import { lerma, otroProyecto } from "../test/fixtures";
import { elegirRegla } from "./seguimientos/reglas";
import type { ReglaSeguimiento } from "./datos/tipos";
import { LINEAS_DE_FABRICA, lineaDeBandeja, notaLineaSinAsistente, proyectosDeLinea } from "./lineas";

describe("líneas", () => {
  it("vienen las cuatro que pidió Mindlin: la 3 es la que ya andaba (bandeja 1)", () => {
    expect(LINEAS_DE_FABRICA.map((l) => [l.id, l.tipo, l.bandeja])).toEqual([
      ["linea-1", "outreach_frio", null],
      ["linea-2", "equipo", null],
      ["linea-3", "entrada", 1],
      ["linea-4", "entrada", null],
    ]);
  });

  it("la línea sale de la bandeja del aviso; sin bandeja, la por defecto; una bandeja ajena, ninguna", () => {
    expect(lineaDeBandeja(LINEAS_DE_FABRICA, 1)?.id).toBe("linea-3");
    expect(lineaDeBandeja(LINEAS_DE_FABRICA, null)?.id).toBe("linea-3");
    expect(lineaDeBandeja(LINEAS_DE_FABRICA, 7)).toBeNull();
    expect(notaLineaSinAsistente(null, 7)).toContain("bandeja 7");
  });

  it("cada línea atiende sus proyectos (sin elegir ninguno, todos)", () => {
    const todos = [lerma(), otroProyecto()];
    expect(proyectosDeLinea(LINEAS_DE_FABRICA[2], todos).map((p) => p.id)).toEqual(["lerma-439", "otro-1"]);
    expect(proyectosDeLinea({ proyectos: ["otro-1"] }, todos).map((p) => p.id)).toEqual(["otro-1"]);
    expect(proyectosDeLinea(null, todos)).toHaveLength(2);
  });

  it("seguimientos: la regla de la línea va antes que la general, y la de otra línea no cuenta", () => {
    const regla = (id: number, cambios: Partial<ReglaSeguimiento>): ReglaSeguimiento => ({ id, etapa: "Nuevo", paso: 1, dias_sin_respuesta: 1, version: 1, estado: "activa", proyecto: null, mensaje: `regla ${id}`, linea: null, ...cambios });
    const reglas = [regla(1, {}), regla(2, { linea: "linea-4" }), regla(3, { linea: "linea-4", proyecto: "lerma-439" }), regla(4, { proyecto: "lerma-439" })];
    const elegir = (linea: string | null, proyecto: string | null) => elegirRegla(reglas, { etapa: "Nuevo", paso: 1, proyecto, conversacion: 1, linea })?.id;
    expect(elegir("linea-4", "lerma-439")).toBe(3);
    expect(elegir("linea-4", "otro-1")).toBe(2);
    expect(elegir("linea-3", "lerma-439")).toBe(4);
    expect(elegir("linea-3", null)).toBe(1);
    expect(elegir(null, null)).toBe(1);
  });
});
