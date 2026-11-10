import { describe, expect, it } from "vitest";
import { claveCorrecta, crearToken, DURACION_SESION_MS, leerToken } from "./sesion";
import { queFalta } from "./listo";
import { idDesdeNombre, validarEjemplo, validarProyecto, validarRegla, validarTono } from "./validar";

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

describe("sesión del panel", () => {
  const AHORA = Date.parse("2026-11-10T14:00:00Z");

  it("entra solo con la clave del panel (y sin clave cargada, nadie)", () => {
    expect(claveCorrecta("la-clave", "la-clave")).toBe(true);
    expect(claveCorrecta("la-clave", " la-clave ")).toBe(true);
    expect(claveCorrecta("otra", "la-clave")).toBe(false);
    expect(claveCorrecta("", "la-clave")).toBe(false);
    expect(claveCorrecta("x", undefined)).toBe(false);
  });

  it("la cookie dice quién entró, vence a los 30 días y no sirve si se cambia la clave o se toca", () => {
    const token = crearToken("  Tadeo  ", "clave", AHORA);
    expect(leerToken(token, "clave", AHORA)).toBe("Tadeo");
    expect(leerToken(token, "clave", AHORA + DURACION_SESION_MS + 1)).toBeNull();
    expect(leerToken(token, "clave-nueva", AHORA)).toBeNull();
    const [datos, firma] = token.split(".");
    const otro = Buffer.from(JSON.stringify({ n: "Mati", e: AHORA + 1e9 })).toString("base64url");
    expect(leerToken(`${otro}.${firma}`, "clave", AHORA)).toBeNull();
    expect(leerToken(`${datos}.${firma}.x`, "clave", AHORA)).toBeNull();
    expect(leerToken(undefined, "clave", AHORA)).toBeNull();
    expect(leerToken("basura", "clave", AHORA)).toBeNull();
  });
});

describe("validaciones del panel", () => {
  it("una ficha: arma el id desde el nombre, limpia las palabras clave y marca si está activa", () => {
    const r = validarProyecto(form({ nombre: "Güemes 4676", palabras_clave: "Güemes, guemes\nPalermo, ", precios: "Desde USD 100.000", activo: "on" }));
    expect(r).toMatchObject({ ok: true, valor: { id: "guemes-4676", nombre: "Güemes 4676", palabras_clave: ["güemes", "guemes", "palermo"], precios: "Desde USD 100.000", activo: true, ubicacion: "" } });
    expect(validarProyecto(form({ nombre: "Lerma", id: "Lerma 439" }))).toEqual({ ok: false, error: expect.stringContaining("minúsculas") });
    expect(validarProyecto(form({ nombre: "" })).ok).toBe(false);
    expect(validarProyecto(form({ nombre: "Lerma", precios: "x".repeat(8001) }))).toEqual({ ok: false, error: expect.stringContaining("Precios") });
    expect(validarProyecto(form({ nombre: "Lerma 439" }))).toMatchObject({ valor: { activo: false } });
    expect(idDesdeNombre("  Torre Ñandú (etapa 2) ")).toBe("torre-nandu-etapa-2");
    expect(validarProyecto(form({ nombre: "Nuevo" }))).toEqual({ ok: false, error: expect.stringContaining("«nuevo»") });
  });

  it("el tono necesita al menos cómo habla; un ejemplo, título y conversación", () => {
    expect(validarTono(form({ instrucciones: "Voseo, cálido." }))).toEqual({ ok: true, valor: { instrucciones: "Voseo, cálido.", criterios_comerciales: "", cuando_pasar_a_persona: "", pasar_al_responder: false } });
    expect(validarTono(form({ instrucciones: "x", pasar_al_responder: "on" }))).toMatchObject({ valor: { pasar_al_responder: true } });
    expect(validarTono(form({ criterios_comerciales: "x" })).ok).toBe(false);
    expect(validarEjemplo(form({ titulo: "Consulta por 2 ambientes", conversacion: "Interesado: Hola\r\nMindlin: ¡Hola!" }))).toEqual({
      ok: true,
      valor: { titulo: "Consulta por 2 ambientes", conversacion: "Interesado: Hola\nMindlin: ¡Hola!" },
    });
    expect(validarEjemplo(form({ titulo: "Sin conversación" })).ok).toBe(false);
  });

  it("una regla de seguimiento: etapa del CRM, paso, días, proyecto existente y solo las variables que hay", () => {
    const base = { etapa: "Nuevo", paso: "1", dias_sin_respuesta: "2", proyecto: "", mensaje: "Hola {{nombre}}, ¿viste lo de {{ proyecto }}?" };
    expect(validarRegla(form(base), ["lerma-439"])).toEqual({
      ok: true,
      valor: { etapa: "Nuevo", paso: 1, dias_sin_respuesta: 2, proyecto: null, mensaje: "Hola {{nombre}}, ¿viste lo de {{ proyecto }}?", estado: "activa" },
    });
    expect(validarRegla(form({ ...base, proyecto: "lerma-439", estado: "a_prueba" }), ["lerma-439"])).toMatchObject({ valor: { proyecto: "lerma-439", estado: "a_prueba" } });
    expect(validarRegla(form({ ...base, etapa: "Vendido" }), [])).toEqual({ ok: false, error: "Elegí una etapa del CRM." });
    expect(validarRegla(form({ ...base, paso: "6" }), []).ok).toBe(false);
    expect(validarRegla(form({ ...base, dias_sin_respuesta: "0" }), []).ok).toBe(false);
    expect(validarRegla(form({ ...base, proyecto: "no-existe" }), []).ok).toBe(false);
    expect(validarRegla(form({ ...base, mensaje: "Hola {{apellido}}" }), [])).toEqual({ ok: false, error: "Solo se pueden usar {{nombre}} y {{proyecto}} (no {{apellido}})." });
  });
});

describe("lo que falta para salir", () => {
  const ficha = (cambios: Record<string, unknown> = {}) =>
    ({ id: "lerma-439", nombre: "Lerma 439", activo: true, palabras_clave: [], descripcion: "", ubicacion: "Villa Crespo", etapa_obra: "", entrega: "", tipologias: "2 amb", precios: "", financiacion: "", disponibilidad: "", amenities: "", preguntas_frecuentes: "", links: "", notas_internas: "", ...cambios }) as never;
  const tono = { instrucciones: "Voseo.", criterios_comerciales: "", cuando_pasar_a_persona: "" };

  it("dice qué falta, en orden y con a dónde ir", () => {
    const pasos = queFalta({ tono, proyectos: [ficha(), ficha({ id: "viejo", nombre: "Viejo", activo: false })], reglas: 0, faltan: ["CRON_SECRET"] });
    expect(pasos.map((p) => [p.listo, p.link ?? ""])).toEqual([
      [false, ""],
      [false, "/panel/tono"],
      [false, "/panel/proyectos/lerma-439"],
      [false, "/panel/seguimientos"],
    ]);
    expect(pasos[2].texto).toBe("A la ficha de Lerma 439 le falta: precios, disponibilidad, financiación. Sin eso, el asistente pasa esas consultas al equipo.");
  });

  it("con todo cargado, todo listo", () => {
    const completa = ficha({ precios: "x", disponibilidad: "x", financiacion: "x" });
    expect(queFalta({ tono: { ...tono, criterios_comerciales: "x" }, proyectos: [completa], reglas: 2, faltan: [] }).every((p) => p.listo)).toBe(true);
    expect(queFalta({ tono, proyectos: [], reglas: 1, faltan: [] }).find((p) => p.link === "/panel/proyectos")?.listo).toBe(false);
    // Reglas cargadas pero archivadas (los borradores de Kommo): no es lo mismo que no tener ninguna.
    expect(queFalta({ tono, proyectos: [], reglas: 0, archivadas: 6, faltan: [] }).at(-1)).toMatchObject({ listo: false, texto: expect.stringContaining("6 reglas de seguimiento cargadas, pero están archivadas") });
  });
});
