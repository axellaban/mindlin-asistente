import { describe, expect, it } from "vitest";
import { claveCorrecta, crearToken, DURACION_SESION_MS, leerToken } from "./sesion";
import { queFalta } from "./listo";
import { coincideElContenido, idDesdeNombre, validarArchivo, validarEjemplo, validarProyecto, validarRegla, validarReglaEtapa, validarTono } from "./validar";

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
    expect(validarTono(form({ instrucciones: "Voseo, cálido." }))).toEqual({
      ok: true,
      valor: { instrucciones: "Voseo, cálido.", criterios_comerciales: "", cuando_pasar_a_persona: "", sobre_la_empresa: "", objeciones: "", pasar_al_responder: false, horario_equipo: { dias: [1, 2, 3, 4, 5], desde: 9, hasta: 20 } },
    });
    expect(validarTono(form({ instrucciones: "x", pasar_al_responder: "on" }))).toMatchObject({ valor: { pasar_al_responder: true } });
    expect(validarTono(form({ criterios_comerciales: "x" })).ok).toBe(false);
    expect(validarEjemplo(form({ titulo: "Consulta por 2 ambientes", conversacion: "Interesado: Hola\r\nMindlin: ¡Hola!" }))).toEqual({
      ok: true,
      valor: { titulo: "Consulta por 2 ambientes", conversacion: "Interesado: Hola\nMindlin: ¡Hola!" },
    });
    expect(validarEjemplo(form({ titulo: "Sin conversación" })).ok).toBe(false);
  });

  it("el horario del equipo: una casilla por día (o la lista que manda el hub) y horas enteras", () => {
    const casillas = form({ instrucciones: "x", equipo_dia_1: "on", equipo_dia_3: "on", equipo_dia_6: "on", equipo_desde: "10", equipo_hasta: "18" });
    expect(validarTono(casillas)).toMatchObject({ ok: true, valor: { horario_equipo: { dias: [1, 3, 6], desde: 10, hasta: 18 } } });
    expect(validarTono(form({ instrucciones: "x", equipo_dias: "0, 6", equipo_desde: "9", equipo_hasta: "13" }))).toMatchObject({ valor: { horario_equipo: { dias: [6, 0], desde: 9, hasta: 13 } } });
    expect(validarTono(form({ instrucciones: "x", equipo_desde: "9", equipo_hasta: "20" }))).toEqual({ ok: false, error: "Marcá al menos un día en el horario del equipo." });
    expect(validarTono(form({ instrucciones: "x", equipo_dias: "1", equipo_desde: "20", equipo_hasta: "9" })).ok).toBe(false);
    expect(validarTono(form({ instrucciones: "x", equipo_dias: "1", equipo_desde: "9", equipo_hasta: "25" })).ok).toBe(false);
    expect(validarTono(form({ instrucciones: "x", equipo_dias: "8", equipo_desde: "9", equipo_hasta: "20" }))).toEqual({ ok: false, error: expect.stringContaining("de 0 (domingo) a 6 (sábado)") });
  });

  it("una regla de seguimiento: etapa del CRM, paso, días, proyecto existente y solo las variables que hay", () => {
    const base = { etapa: "Nuevo", paso: "1", dias_sin_respuesta: "2", proyecto: "", mensaje: "Hola {{nombre}}, ¿viste lo de {{ proyecto }}?" };
    expect(validarRegla(form(base), ["lerma-439"])).toEqual({
      ok: true,
      valor: { etapa: "Nuevo", paso: 1, dias_sin_respuesta: 2, proyecto: null, mensaje: "Hola {{nombre}}, ¿viste lo de {{ proyecto }}?", estado: "activa", linea: null },
    });
    expect(validarRegla(form({ ...base, proyecto: "lerma-439", estado: "a_prueba" }), ["lerma-439"])).toMatchObject({ valor: { proyecto: "lerma-439", estado: "a_prueba" } });
    expect(validarRegla(form({ ...base, etapa: "Vendido" }), [])).toEqual({ ok: false, error: "Elegí una etapa del CRM." });
    expect(validarRegla(form({ ...base, paso: "6" }), []).ok).toBe(false);
    expect(validarRegla(form({ ...base, dias_sin_respuesta: "0" }), []).ok).toBe(false);
    expect(validarRegla(form({ ...base, proyecto: "no-existe" }), []).ok).toBe(false);
    expect(validarRegla(form({ ...base, mensaje: "Hola {{apellido}}" }), [])).toEqual({ ok: false, error: "Solo se pueden usar {{nombre}} y {{proyecto}} (no {{apellido}})." });
  });
});

describe("archivos de los flujos: el contenido tiene que ser lo que dice el tipo", () => {
  const bytes = (...b: (number | string)[]) => new Uint8Array(b.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));
  const base64 = (d: Uint8Array) => Buffer.from(d).toString("base64");

  it("reconoce la firma de cada tipo permitido", () => {
    expect(coincideElContenido("image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe(true);
    expect(coincideElContenido("image/png", bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(true);
    expect(coincideElContenido("image/webp", bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 "))).toBe(true);
    expect(coincideElContenido("audio/ogg", bytes("OggS", 0))).toBe(true);
    expect(coincideElContenido("audio/mpeg", bytes("ID3", 4, 0))).toBe(true);
    expect(coincideElContenido("audio/mpeg", bytes(0xff, 0xfb, 0x90, 0x64))).toBe(true);
    expect(coincideElContenido("audio/mp4", bytes(0, 0, 0, 0x20, "ftypM4A "))).toBe(true);
    expect(coincideElContenido("video/mp4", bytes(0, 0, 0, 0x18, "ftypmp42"))).toBe(true);
    expect(coincideElContenido("application/pdf", bytes("%PDF-1.7\n"))).toBe(true);
    // Unos bytes antes de «%PDF-», como dejan algunos programas.
    expect(coincideElContenido("application/pdf", bytes(0xef, 0xbb, 0xbf, "%PDF-1.4"))).toBe(true);
  });

  it("un archivo con otro contenido no entra, aunque el navegador diga que es una foto", () => {
    const programa = bytes("MZ", 0x90, 0, 3, 0);
    expect(coincideElContenido("image/jpeg", programa)).toBe(false);
    expect(coincideElContenido("application/pdf", bytes("<html><body>hola</body></html>"))).toBe(false);
    expect(coincideElContenido("image/png", bytes(0xff, 0xd8, 0xff))).toBe(false);
    const r = validarArchivo({ nombre: "foto.jpg", tipo: "image/jpeg", datos: base64(programa) });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/no es lo que dice ser/) });
    expect(validarArchivo({ nombre: "foto.jpg", tipo: "image/jpeg", datos: base64(bytes(0xff, 0xd8, 0xff, 0xe0)) })).toMatchObject({ ok: true, valor: { nombre: "foto.jpg", tipo: "image/jpeg" } });
  });
});

describe("reglas de etapas", () => {
  it("un evento que existe, hacia una etapa a la que el asistente puede mandar (o a ninguna)", () => {
    expect(validarReglaEtapa("respondio", "Seguimiento")).toEqual({ ok: true, valor: { evento: "respondio", etapa: "Seguimiento" } });
    expect(validarReglaEtapa("respondio", "")).toEqual({ ok: true, valor: { evento: "respondio", etapa: null } });
    expect(validarReglaEtapa("respondio", null)).toEqual({ ok: true, valor: { evento: "respondio", etapa: null } });
    expect(validarReglaEtapa("respondio", "Vendido")).toMatchObject({ ok: false, error: expect.stringContaining("Reserva y Vendido los decide una persona") });
    expect(validarReglaEtapa("inventado", "Seguimiento").ok).toBe(false);
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
