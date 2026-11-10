import { describe, expect, it } from "vitest";
import { claveCorrecta, crearToken, DURACION_SESION_MS, leerToken } from "./sesion";
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
  });

  it("el tono necesita al menos cómo habla; un ejemplo, título y conversación", () => {
    expect(validarTono(form({ instrucciones: "Voseo, cálido." }))).toEqual({ ok: true, valor: { instrucciones: "Voseo, cálido.", criterios_comerciales: "", cuando_pasar_a_persona: "" } });
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
