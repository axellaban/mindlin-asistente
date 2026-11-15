import { describe, expect, it } from "vitest";
import { lerma, otroProyecto } from "../../test/fixtures";
import { archivosDe, describirPasos, elegirFlujo, margenDeEspera, pasoEn, proyectoNombrado, rama, siguiente, textoHoras, ubicar, validarPasos, type Paso } from "./modelo";
import { PLANTILLAS } from "./plantillas";

/** El bot de Kommo de «17 y 43», resumido: presenta, espera 24 h y, si no responde, sigue. */
const kommo = (): Paso[] => [
  { tipo: "mensaje", texto: "¡Hola! Te escribimos desde Mindlin Developers.", archivo: null },
  { tipo: "pausa", segundos: 5 },
  { tipo: "mensaje", texto: "Te cuento de {{proyecto}}.", archivo: 7 },
  {
    tipo: "esperar",
    horas: 24,
    si_responde: [{ tipo: "etapa", etapa: "Seguimiento" }, { tipo: "equipo", nota: "Respondió." }],
    si_no: [{ tipo: "etapa", etapa: "En pausa" }, { tipo: "mensaje", texto: "¿Pudiste verlo, {{nombre}}?", archivo: null }, { tipo: "esperar", horas: 24, si_responde: [{ tipo: "equipo", nota: "" }], si_no: [{ tipo: "fin" }] }],
  },
];

describe("flujos: la forma de los pasos", () => {
  it("un flujo como los de Kommo pasa, limpio y sin campos de más", () => {
    const conBasura = kommo().map((p) => ({ ...p, inventado: "x" }));
    const r = validarPasos(conBasura, { archivos: new Set([7]) });
    expect(r).toEqual({ ok: true, valor: kommo() });
  });

  it("todos los modelos para arrancar son flujos válidos", () => {
    for (const p of PLANTILLAS) expect(validarPasos(p.pasos), p.id).toMatchObject({ ok: true });
  });

  it("dice qué está mal y dónde, en castellano", () => {
    const error = (pasos: unknown, archivos?: Set<number>) => {
      const r = validarPasos(pasos, { archivos });
      return r.ok ? "" : r.error;
    };
    expect(error([])).toBe("El flujo necesita al menos un paso.");
    expect(error([{ tipo: "fin" }, { tipo: "mensaje", texto: "x" }])).toContain("«Terminar» (paso 1) tiene que ser el último de su camino");
    expect(error([{ tipo: "mensaje", texto: "" }])).toContain("está vacío");
    expect(error([{ tipo: "mensaje", texto: "Hola {{apellido}}" }])).toContain("no {{apellido}}");
    expect(error([{ tipo: "mensaje", texto: "Hola", archivo: 3 }], new Set([1]))).toContain("ya no existe");
    expect(error([{ tipo: "pausa", segundos: 61 }])).toContain("de 1 a 60 segundos");
    expect(error([{ tipo: "pausa", segundos: 60 }, { tipo: "pausa", segundos: 60 }, { tipo: "pausa", segundos: 1 }])).toContain("suman más de 120 segundos");
    expect(error([{ tipo: "ia", consigna: "a" }, { tipo: "ia", consigna: "b" }, { tipo: "ia", consigna: "c" }, { tipo: "seguir_ia" }])).toContain("más de 3 veces seguidas");
    expect(error([{ tipo: "ia", consigna: "" }])).toContain("necesita una consigna");
    expect(error([{ tipo: "etapa", etapa: "Vendido" }])).toContain("solo puede mover a");
    expect(error([{ tipo: "esperar", horas: 0, si_responde: [], si_no: [] }])).toContain("de 1 hora a 30 días");
    expect(error([{ tipo: "esperar", horas: 24, si_responde: [{ tipo: "pausa", segundos: 0 }], si_no: [] }])).toContain("«Si responde» del paso 1");
    expect(error([{ tipo: "saltar" }])).toContain("no es un paso");
    // Cada camino es un tramo nuevo: las pausas se cuentan de nuevo.
    expect(validarPasos([{ tipo: "pausa", segundos: 60 }, { tipo: "esperar", horas: 1, si_responde: [{ tipo: "pausa", segundos: 60 }, { tipo: "pausa", segundos: 60 }], si_no: [] }]).ok).toBe(true);
  });

  it("no deja anidar esperas sin fin ni pasarse de pasos", () => {
    let anidado: Paso[] = [{ tipo: "fin" }];
    for (let i = 0; i < 5; i++) anidado = [{ tipo: "esperar", horas: 1, si_responde: anidado, si_no: [] }];
    expect(validarPasos(anidado)).toMatchObject({ ok: false, error: expect.stringContaining("una adentro de otra") });
    const muchos = Array.from({ length: 61 }, () => ({ tipo: "mensaje", texto: "x" }));
    expect(validarPasos(muchos)).toMatchObject({ ok: false, error: expect.stringContaining("más de 60 pasos") });
  });

  it("posiciones: cada paso tiene su dirección, también adentro de los caminos", () => {
    const pasos = kommo();
    expect(pasoEn(pasos, "0")).toMatchObject({ tipo: "mensaje" });
    expect(pasoEn(pasos, "3")).toMatchObject({ tipo: "esperar" });
    expect(pasoEn(pasos, rama("3", "si"))).toEqual({ tipo: "etapa", etapa: "Seguimiento" });
    expect(pasoEn(pasos, "3.no.2.no.0")).toEqual({ tipo: "fin" });
    expect(siguiente("3.no.1")).toBe("3.no.2");
    expect(pasoEn(pasos, "4")).toBeNull();
    expect(ubicar(pasos, "4")).toMatchObject({ indice: 4 });
    expect(ubicar(pasos, "0.si.0")).toBeNull();
    expect(ubicar(pasos, "3.quizas.0")).toBeNull();
    expect(archivosDe(pasos)).toEqual([7]);
  });

  it("elige el flujo por el proyecto que nombra la persona, y si no, el general", () => {
    const flujos = [
      { id: 1, nombre: "General", proyecto: null, pasos: kommo() },
      { id: 2, nombre: "Lerma", proyecto: "lerma-439", pasos: kommo() },
    ];
    const proyectos = [lerma(), otroProyecto()];
    expect(elegirFlujo(flujos, proyectos, "Hola, me interesa LERMA")).toMatchObject({ flujo: { id: 2 }, proyecto: "lerma-439" });
    expect(elegirFlujo(flujos, proyectos, "Hola, quiero info de Otro 1")).toMatchObject({ flujo: { id: 1 }, proyecto: "otro-1" });
    expect(elegirFlujo(flujos, proyectos, "Hola")).toMatchObject({ flujo: { id: 1 }, proyecto: null });
    expect(elegirFlujo([flujos[1]], proyectos, "Hola")).toBeNull();
    // Palabras enteras, sin acentos ni mayúsculas; si nombra dos, no adivina.
    const via = { id: "via-53", nombre: "VIA 53", palabras_clave: ["53", "vía 53"] };
    expect(proyectoNombrado("Me pasaron el 1532", [via])).toBeNull();
    expect(proyectoNombrado("info de la torre en 53!", [via])).toBe("via-53");
    expect(proyectoNombrado("Lerma o la de 53", [via, lerma()])).toBeNull();
  });

  it("se puede leer en texto (para el panel)", () => {
    expect(describirPasos(kommo())).toEqual([
      "1. Mensaje: «¡Hola! Te escribimos desde Mindlin Developers.»",
      "2. Pausa de 5 s",
      "3. Mensaje: «Te cuento de {{proyecto}}.» + archivo",
      "4. Esperar respuesta (hasta 1 día)",
      "   Si responde:",
      "     1. Mover a «Seguimiento»",
      "     2. Pasar al equipo: Respondió.",
      "   Si no responde:",
      "     1. Mover a «En pausa»",
      "     2. Mensaje: «¿Pudiste verlo, {{nombre}}?»",
      "     3. Esperar respuesta (hasta 1 día)",
      "        Si responde:",
      "          1. Pasar al equipo",
      "        Si no responde:",
      "          1. Terminar",
    ]);
    expect([1, 12, 24, 72, 168, 336].map(textoHoras)).toEqual(["1 hora", "12 horas", "1 día", "3 días", "1 semana", "2 semanas"]);
  });
});

describe("margen de las esperas para el cron", () => {
  const M = 12 * 3_600_000;
  const espera = (desde: string, horas: number) => ({ espera_desde: desde, vence: new Date(Date.parse(desde) + horas * 3_600_000).toISOString() });
  it("medio día, salvo que la espera sea más corta: entonces la mitad", () => {
    expect(margenDeEspera(espera("2026-11-16T13:00:00Z", 24), M)).toBe(M);
    expect(margenDeEspera(espera("2026-11-16T13:00:00Z", 2), M)).toBe(3_600_000);
    expect(margenDeEspera({ espera_desde: null, vence: "2026-11-16T13:00:00Z" }, M)).toBe(M);
  });
});
