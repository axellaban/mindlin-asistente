import { describe, expect, it } from "vitest";
import { diaDeAutomaticos, fechaFeriado, HORARIO_EQUIPO_DE_FABRICA as F, horarioValido } from "./horario";
import { validarTono } from "../panel/validar";

describe("los mensajes automáticos y los feriados", () => {
  it("lee las fechas como las escribe el equipo", () => {
    expect(["2026-12-25", "25/12/2026", "8/12/26", "31/02/2026", "mañana"].map(fechaFeriado)).toEqual(["2026-12-25", "2026-12-25", "2026-12-08", null, null]);
  });

  it("el horario guarda la opción y los feriados (sin repetir, en orden); lo que no se entiende queda de fábrica", () => {
    expect(horarioValido({ ...F, automaticos: "dias_del_equipo", feriados: ["25/12/2026", "2026-12-08", "2026-12-25", "x"] })).toEqual({ ...F, automaticos: "dias_del_equipo", feriados: ["2026-12-08", "2026-12-25"] });
    expect(horarioValido({ ...F, automaticos: "cualquiera" })).toEqual(F);
  });

  it("de fábrica salen todos los días; con los días del equipo, ni el fin de semana ni los feriados", () => {
    const sabado = new Date("2026-11-14T13:00:00Z");
    const lunes = new Date("2026-11-16T13:00:00Z");
    expect(diaDeAutomaticos(sabado, F)).toBe(true);
    const equipo = { ...F, automaticos: "dias_del_equipo" as const, feriados: ["2026-11-16"] };
    expect([diaDeAutomaticos(sabado, equipo), diaDeAutomaticos(lunes, equipo), diaDeAutomaticos(new Date("2026-11-17T13:00:00Z"), equipo)]).toEqual([false, false, true]);
    // A las 23 de Buenos Aires del viernes ya es sábado en UTC: cuenta el día de Buenos Aires.
    expect(diaDeAutomaticos(new Date("2026-11-14T02:00:00Z"), equipo)).toBe(true);
  });

  it("el formulario (panel o hub) valida los feriados", () => {
    const f = (x: Record<string, string>) => new Map(Object.entries({ instrucciones: "x", equipo_dias: "1,2,3,4,5", equipo_desde: "9", equipo_hasta: "20", ...x }));
    const ok = validarTono(f({ equipo_automaticos: "dias_del_equipo", equipo_feriados: "25/12/2026\n1/1/2027" }) as never);
    expect(ok.ok && ok.valor.horario_equipo).toMatchObject({ automaticos: "dias_del_equipo", feriados: ["2026-12-25", "2027-01-01"] });
    expect(validarTono(f({ equipo_feriados: "Navidad" }) as never)).toEqual({ ok: false, error: "Feriados: «Navidad» no es una fecha (va como 25/12/2026)." });
  });
});
