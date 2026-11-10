import { execFileSync } from "node:child_process";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearAlmacen } from "../datos/postgres";
import { datosPanel } from "./datos";
import type { FichaEditable } from "./validar";

/**
 * Lo que lee y escribe el panel, contra un Postgres de verdad (como lib/datos/postgres.test.ts).
 * Usa su propio esquema para no pisarse con esas pruebas si corren a la vez.
 */
const url = process.env.PRUEBA_DATABASE_URL;
const ESQUEMA = "prueba_panel";

describe.skipIf(!url)("datos del panel (Postgres real)", () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query(`drop schema if exists ${ESQUEMA} cascade; create schema ${ESQUEMA};`);
    await admin.end();
    const conEsquema = `${url}${url!.includes("?") ? "&" : "?"}options=-c%20search_path%3D${ESQUEMA}`;
    // Las migraciones crean en «public.»: se aplican con el esquema de prueba como «public» lógico.
    execFileSync("node", ["-e", MIGRAR_EN_ESQUEMA], { env: { ...process.env, URL_PRUEBA: url, ESQUEMA }, encoding: "utf8" });
    pool = new pg.Pool({ connectionString: conEsquema });
  });
  afterAll(() => pool?.end());

  const ficha = (cambios: Partial<FichaEditable> = {}): FichaEditable => ({
    id: "guemes-4676",
    nombre: "Güemes 4676",
    activo: true,
    palabras_clave: ["guemes"],
    descripcion: "Departamentos.",
    ubicacion: "Palermo.",
    etapa_obra: "",
    entrega: "",
    tipologias: "",
    precios: "",
    financiacion: "",
    disponibilidad: "",
    amenities: "",
    preguntas_frecuentes: "",
    links: "",
    notas_internas: "Solo para el equipo.",
    ...cambios,
  });

  it("fichas: alta, cambio y quién la tocó; las inactivas no le llegan al agente", async () => {
    const d = datosPanel(pool);
    await d.guardarProyecto(ficha(), "Tadeo");
    await d.guardarProyecto(ficha({ precios: "Desde USD 120.000", activo: false }), "Mati");
    expect(await d.proyecto("guemes-4676")).toMatchObject({ precios: "Desde USD 120.000", activo: false, notas_internas: "Solo para el equipo." });
    const { rows } = await pool.query("select actualizado_por from proyectos where id = 'guemes-4676'");
    expect(rows[0].actualizado_por).toBe("Mati");
    expect((await d.proyectos()).map((p) => p.id)).toEqual(["lerma-439", "guemes-4676"]);
    expect((await crearAlmacen(pool).proyectosActivos()).map((p) => p.id)).toEqual(["lerma-439"]);
  });

  it("tono y ejemplos", async () => {
    const d = datosPanel(pool);
    await d.guardarTono({ instrucciones: "Voseo.", criterios_comerciales: "Primero entender.", cuando_pasar_a_persona: "Si pide visita." }, "Tadeo");
    expect(await d.tono()).toMatchObject({ instrucciones: "Voseo.", actualizado_por: "Tadeo" });
    await d.agregarEjemplo({ titulo: "Uno", conversacion: "Hola" });
    await d.agregarEjemplo({ titulo: "Dos", conversacion: "Chau" });
    const [uno, dos] = await d.ejemplos();
    await d.activarEjemplo(uno.id, false);
    await d.borrarEjemplo(dos.id);
    expect(await d.ejemplos()).toEqual([{ id: uno.id, titulo: "Uno", conversacion: "Hola", activo: false }]);
    expect(await crearAlmacen(pool).ejemplos()).toEqual([]);
  });

  it("reglas: versiones solas, medición por regla y no se borra una que ya se mandó", async () => {
    const d = datosPanel(pool);
    const base = { etapa: "Nuevo", paso: 1, dias_sin_respuesta: 2, proyecto: null, mensaje: "Hola", estado: "activa" as const };
    const v1 = await d.agregarRegla(base);
    const v2 = await d.agregarRegla({ ...base, mensaje: "Hola de nuevo", estado: "a_prueba" });
    const otraEtapa = await d.agregarRegla({ ...base, etapa: "Seguimiento" });
    await pool.query("insert into seguimientos_enviados (conversacion, regla, etapa, paso, version, texto, respondio) values (1, $1, 'Nuevo', 1, 1, 'Hola', now()), (2, $1, 'Nuevo', 1, 1, 'Hola', null)", [v1]);

    const reglas = await d.reglas();
    expect(reglas.map((r) => [r.id, r.version, r.enviados, r.respondieron])).toEqual([
      [v1, 1, 2, 1],
      [v2, 2, 0, 0],
      [otraEtapa, 1, 0, 0],
    ]);
    expect(await d.borrarRegla(v1)).toBe(false);
    expect(await d.borrarRegla(v2)).toBe(true);
    await d.cambiarEstadoRegla(v1, "archivada");
    expect((await crearAlmacen(pool).reglasVigentes()).map((r) => r.id)).toEqual([otraEtapa]);
  });

  it("conversaciones con su último mensaje, el historial, el registro y el resumen", async () => {
    const d = datosPanel(pool);
    const a = crearAlmacen(pool);
    const ahora = new Date().toISOString();
    await a.guardarMensaje({ id: 1, conversacion: 50, rol: "interesado", texto: "Hola", fecha: ahora });
    await a.guardarMensaje({ id: 2, conversacion: 50, rol: "bot", texto: "¡Hola! ¿En qué te ayudo?", fecha: new Date(Date.now() + 1000).toISOString() });
    await a.guardarConversacion({ chatwoot_id: 50, nombre: "Ana Prueba", telefono: "5491155550000" });
    await a.registrar({ tipo: "respuesta", conversacion: 50, detalle: "¡Hola!" });
    await a.registrar({ tipo: "error", conversacion: null, detalle: "CRM caído" });

    expect((await d.conversaciones())[0]).toMatchObject({ chatwoot_id: 50, nombre: "Ana Prueba", ultimo_texto: "¡Hola! ¿En qué te ayudo?", ultimo_rol: "bot" });
    expect((await d.mensajes(50)).map((m) => m.rol)).toEqual(["interesado", "bot"]);
    expect((await d.registro({ conversacion: 50 })).map((r) => r.tipo)).toEqual(["respuesta"]);
    expect((await d.registro()).map((r) => r.tipo)).toEqual(["error", "respuesta"]);
    expect(await d.resumen()).toMatchObject({ respuesta: 1, error: 1, conversaciones: 1, seguimiento: 0 });
  });
});

/** Aplica las migraciones en otro esquema: cambia «public.» por el esquema de prueba. */
const MIGRAR_EN_ESQUEMA = `
const { readdirSync, readFileSync } = require("node:fs");
const pg = require("pg");
(async () => {
  const c = new pg.Client({ connectionString: process.env.URL_PRUEBA });
  await c.connect();
  for (const f of readdirSync("db/migraciones").filter((f) => f.endsWith(".sql")).sort()) {
    await c.query(readFileSync("db/migraciones/" + f, "utf8").replaceAll("public.", process.env.ESQUEMA + "."));
  }
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
`;
