import { describe, expect, it } from "vitest";
import {
  CONFIG_OUTREACH_DE_FABRICA as F,
  enBuenosAires,
  enFranja,
  masDiasHabiles,
  primerNombre,
  proximaFranja,
  puedeTomar,
  siguienteDesde,
  textoDelPaso,
  topeVigente,
  validarConfigOutreach,
  type ConfigOutreach,
  type EstadoLinea,
} from "./reglas";

// El 16/11/2026 es lunes. Buenos Aires es UTC−3.
const ba = (fechaHora: string) => new Date(`${fechaHora}:00-03:00`);
const lista: ConfigOutreach = { ...F, textos_revisados: true };
const libre: EstadoLinea = { pausada: false, frenado: null, forzar_dia: null, siguiente_desde: null, enviados_hoy: 0, tope: 20, toma: null };

describe("configuración", () => {
  it("la de fábrica es válida y arranca en borrador", () => {
    const r = validarConfigOutreach(F);
    expect("config" in r && r.config.textos_revisados).toBe(false);
  });

  it("completa con lo de fábrica lo que no viene", () => {
    const r = validarConfigOutreach({ tope_inicial: 10 });
    expect("config" in r && r.config.tope_inicial).toBe(10);
    expect("config" in r && r.config.tanda).toBe(5);
  });

  it.each([
    [{ mensajes_max: 4 }, "Mensajes sin respuesta: tiene que ser un número entre 1 y 3."],
    [{ tope_inicial: 30, tope_max: 20 }, "Tope máximo: no puede ser menor que el tope diario."],
    [{ pausa_waha: [30, 60] }, "Pausa (WAHA): la mínima es de 60 segundos."],
    [{ pausa_agente: [90, 45] }, "Pausa (computer use): la mínima no puede ser mayor que la máxima."],
    [{ franjas: [{ dias: [1], desde: "08:00", hasta: "12:00" }] }, "Franjas: solo de 9 a 20 (la regla de WhatsApp del asistente)."],
    [{ franjas: [{ dias: [1], desde: "13:00", hasta: "12:00" }] }, "Franjas: «desde» y «hasta» van como 10:00 y 13:00, y «desde» antes que «hasta»."],
    [{ saludo: [] }, "Saludo: escribí al menos un texto."],
    [{ saludo: ["Hola {nombre}, mirá https://ejemplo.com"] }, "Saludo: va sin links (el link, si hace falta, va después de que responda)."],
    [{ seguimiento: ["Hola {apellido}"] }, "Seguimiento: «{apellido}» no es una variable. Se pueden usar {nombre}, {proyecto} y {proyecto_en}."],
    [{ excluidos: ["4567-8901"] }, "Excluidos: «4567-8901» falta el código de área."],
    [{ modos: { waha: false, computer_use: false } }, "Modos: elegí al menos uno (WAHA nativo o computer use)."],
  ])("rechaza %j", (cambio, error) => {
    expect(validarConfigOutreach({ ...F, ...cambio })).toEqual({ error });
  });

  it("normaliza los excluidos", () => {
    const r = validarConfigOutreach({ ...F, excluidos: ["011 15 1234-5678", "+5491112345678"] });
    expect("config" in r && r.config.excluidos).toEqual(["5491112345678"]);
  });
});

describe("el reloj", () => {
  it("lee la hora de Buenos Aires", () => {
    expect(enBuenosAires(new Date("2026-11-16T13:30:00Z"))).toEqual({ fecha: "2026-11-16", dia: 1, minuto: 10 * 60 + 30 });
    expect(enBuenosAires(new Date("2026-11-17T02:00:00Z")).fecha).toBe("2026-11-16");
  });

  it("franjas y feriados", () => {
    expect(enFranja(F, ba("2026-11-16T10:00"))).toBe(true);
    expect(enFranja(F, ba("2026-11-16T13:00"))).toBe(false);
    expect(enFranja(F, ba("2026-11-16T14:59"))).toBe(false);
    expect(enFranja(F, ba("2026-11-21T11:00"))).toBe(false); // sábado
    expect(enFranja({ ...F, feriados: ["2026-11-16"] }, ba("2026-11-16T11:00"))).toBe(false);
  });

  it("la próxima franja", () => {
    expect(proximaFranja(F, ba("2026-11-16T13:30"))).toEqual(ba("2026-11-16T15:00"));
    expect(proximaFranja(F, ba("2026-11-20T19:30"))).toEqual(ba("2026-11-23T10:00")); // viernes → lunes
  });

  it("días hábiles, sin fines de semana ni feriados", () => {
    expect(masDiasHabiles(ba("2026-11-19T11:00"), 2, [])).toEqual(ba("2026-11-23T00:00")); // jueves → lunes
    expect(masDiasHabiles(ba("2026-11-19T11:00"), 2, ["2026-11-20"])).toEqual(ba("2026-11-24T00:00"));
  });
});

describe("el tope", () => {
  const sinFrenos = () => false;
  it("arranca en el inicial", () => {
    expect(topeVigente({ tope: null, tope_desde: null }, F, ba("2026-11-16T10:00"), sinFrenos)).toEqual({ tope: 20, guardar: { tope: 20, tope_desde: "2026-11-16" } });
  });
  it("sube después de una semana sin frenos, hasta el máximo", () => {
    expect(topeVigente({ tope: 20, tope_desde: "2026-11-16" }, F, ba("2026-11-22T10:00"), sinFrenos)).toEqual({ tope: 20 });
    expect(topeVigente({ tope: 20, tope_desde: "2026-11-16" }, F, ba("2026-11-23T10:00"), sinFrenos)).toEqual({ tope: 25, guardar: { tope: 25, tope_desde: "2026-11-23" } });
    expect(topeVigente({ tope: 58, tope_desde: "2026-11-16" }, F, ba("2026-11-23T10:00"), sinFrenos).tope).toBe(60);
  });
  it("con un freno en la semana, no sube y vuelve a contar", () => {
    expect(topeVigente({ tope: 20, tope_desde: "2026-11-16" }, F, ba("2026-11-23T10:00"), () => true)).toEqual({ tope: 20, guardar: { tope: 20, tope_desde: "2026-11-23" } });
  });
  it("si bajan el máximo en el hub, manda lo nuevo", () => {
    expect(topeVigente({ tope: 40, tope_desde: "2026-11-16" }, { ...F, tope_max: 30 }, ba("2026-11-17T10:00"), sinFrenos).tope).toBe(30);
  });
});

describe("los textos", () => {
  it("primer nombre prolijo, o nada", () => {
    expect(primerNombre("MARÍA JOSÉ pérez")).toBe("María");
    expect(primerNombre("juan")).toBe("Juan");
    expect(primerNombre("")).toBe("");
    expect(primerNombre("Cliente 123")).toBe("Cliente");
    expect(primerNombre("1234")).toBe("");
  });

  it("arma el saludo y alterna variantes por persona", () => {
    const a = textoDelPaso(F, 0, { id: 3, nombre: "ana gómez", proyecto_nombre: null });
    const b = textoDelPaso(F, 0, { id: 4, nombre: "ana gómez", proyecto_nombre: null });
    expect(a.texto.startsWith("Hola Ana, ¿cómo estás?")).toBe(true);
    expect(a.version).toBe(1);
    expect(b.version).toBe(2);
    expect(textoDelPaso(F, 0, { id: 3, nombre: "Ana", proyecto_nombre: null })).toEqual(a);
    expect(textoDelPaso(F, 0, { id: 5, nombre: "Ana", proyecto_nombre: null }).texto.startsWith("Buenas Ana, ¿qué tal?")).toBe(true);
  });

  it("sin nombre no queda «Hola ,»", () => {
    expect(textoDelPaso(F, 0, { id: 3, nombre: "", proyecto_nombre: null }).texto.startsWith("Hola, ¿cómo estás?")).toBe(true);
    expect(textoDelPaso(F, 0, { id: 4, nombre: "", proyecto_nombre: null }).texto.startsWith("¡Hola! Soy de Mindlin")).toBe(true);
    expect(textoDelPaso(F, 1, { id: 2, nombre: "", proyecto_nombre: null }).texto.startsWith("Te escribo de nuevo")).toBe(true);
    expect(textoDelPaso(F, 1, { id: 1, nombre: "", proyecto_nombre: null }).texto.startsWith("Último mensaje de mi parte")).toBe(true);
  });

  it("el proyecto, si lo hay", () => {
    expect(textoDelPaso(F, 1, { id: 2, nombre: "Ana", proyecto_nombre: "Lerma 439" }).texto).toContain("lo que tenemos hoy en Lerma 439.");
    expect(textoDelPaso(F, 1, { id: 2, nombre: "Ana", proyecto_nombre: null }).texto).toContain("lo que tenemos hoy.");
  });
});

describe("¿puede salir?", () => {
  const lunes11 = ba("2026-11-16T11:00");
  it("con todo en orden, sí", () => {
    expect(puedeTomar(lista, libre, "computer_use", lunes11, "Facu")).toEqual({ ok: true });
  });
  it("en orden: modo, borrador, pausa, freno, horario, tope, ocupada, pausa entre mensajes", () => {
    expect(puedeTomar({ ...lista, modos: { waha: false, computer_use: true } }, libre, "waha", lunes11, "Facu")).toEqual({ motivo: "modo", modo: "waha" });
    expect(puedeTomar(F, libre, "computer_use", lunes11, "Facu")).toEqual({ motivo: "borrador" });
    expect(puedeTomar(lista, { ...libre, pausada: true }, "computer_use", lunes11, "Facu")).toEqual({ motivo: "pausada" });
    expect(puedeTomar(lista, { ...libre, frenado: "3 «no salió» seguidos" }, "computer_use", lunes11, "Facu")).toEqual({ motivo: "frenada", detalle: "3 «no salió» seguidos" });
    expect(puedeTomar(lista, libre, "computer_use", ba("2026-11-16T14:00"), "Facu")).toEqual({ motivo: "fuera_de_horario", abre: ba("2026-11-16T15:00").toISOString() });
    expect(puedeTomar(lista, { ...libre, enviados_hoy: 20 }, "computer_use", lunes11, "Facu")).toEqual({ motivo: "tope", tope: 20 });
    const toma = { por: "Axel", hasta: ba("2026-11-16T11:05").toISOString() };
    expect(puedeTomar(lista, { ...libre, toma }, "computer_use", lunes11, "Facu")).toEqual({ motivo: "ocupada", ...toma });
    expect(puedeTomar(lista, { ...libre, toma }, "computer_use", lunes11, "Axel")).toEqual({ ok: true });
    expect(puedeTomar(lista, { ...libre, toma }, "computer_use", ba("2026-11-16T11:06"), "Facu")).toEqual({ ok: true });
    const hasta = ba("2026-11-16T11:02").toISOString();
    expect(puedeTomar(lista, { ...libre, siguiente_desde: hasta }, "computer_use", lunes11, "Facu")).toEqual({ motivo: "pausa", hasta });
  });
  it("«Mandar igual» vale solo ese día", () => {
    expect(puedeTomar(lista, { ...libre, forzar_dia: "2026-11-16" }, "computer_use", ba("2026-11-16T14:00"), "Facu")).toEqual({ ok: true });
    expect(puedeTomar(lista, { ...libre, forzar_dia: "2026-11-15" }, "computer_use", ba("2026-11-16T14:00"), "Facu")).toMatchObject({ motivo: "fuera_de_horario" });
  });
  it("la pausa queda dentro del rango del modo", () => {
    expect(siguienteDesde(lista, "waha", lunes11, () => 0)).toEqual(new Date(lunes11.getTime() + 180_000));
    expect(siguienteDesde(lista, "waha", lunes11, () => 1)).toEqual(new Date(lunes11.getTime() + 360_000));
    expect(siguienteDesde(lista, "computer_use", lunes11, () => 0.5).getTime() - lunes11.getTime()).toBe(68_000);
  });
});
