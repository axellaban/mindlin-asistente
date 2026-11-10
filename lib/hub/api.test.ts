import { execFileSync } from "node:child_process";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearAlmacen } from "../datos/postgres";
import { datosPanel } from "../panel/datos";
import { manejarHub, type DependenciasHub, type PedidoHub } from "./api";

const CLAVE = "clave-del-hub-de-prueba";
const pedido = (metodo: string, ruta: string, cuerpo: unknown = null, extra: Partial<PedidoHub> = {}): PedidoHub => ({
  metodo,
  ruta: ruta.split("/").filter(Boolean),
  cuerpo,
  autorizacion: `Bearer ${CLAVE}`,
  ...extra,
});

describe("API del hub: quién entra", () => {
  it("sin HUB_CLAVE cargada está apagada; con otra clave, no entra nadie", async () => {
    expect((await manejarHub(pedido("GET", "config"), { clave: undefined, datos: null })).status).toBe(503);
    expect((await manejarHub(pedido("GET", "config", null, { autorizacion: "Bearer otra" }), { clave: CLAVE, datos: null })).status).toBe(401);
    expect((await manejarHub(pedido("GET", "config", null, { autorizacion: null }), { clave: CLAVE, datos: null })).status).toBe(401);
    // Con la clave bien pero sin base, avisa qué falta.
    expect(await manejarHub(pedido("GET", "config"), { clave: CLAVE, datos: null })).toEqual({ status: 503, json: { error: "Falta la base de datos (DATABASE_URL) en Vercel." } });
  });
});

/** Contra un Postgres de verdad, en su propio esquema (como lib/panel/datos.test.ts). */
const url = process.env.PRUEBA_DATABASE_URL;
const ESQUEMA = "prueba_hub";

describe.skipIf(!url)("API del hub (Postgres real)", () => {
  let pool: pg.Pool;
  let deps: DependenciasHub;
  const hub = (metodo: string, ruta: string, cuerpo?: unknown, extra?: Partial<PedidoHub>) => manejarHub(pedido(metodo, ruta, cuerpo, extra), deps);

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query(`drop schema if exists ${ESQUEMA} cascade; create schema ${ESQUEMA};`);
    await admin.end();
    const conEsquema = `${url}${url!.includes("?") ? "&" : "?"}options=-c%20search_path%3D${ESQUEMA}`;
    execFileSync("node", ["-e", MIGRAR_EN_ESQUEMA], { env: { ...process.env, URL_PRUEBA: url, ESQUEMA }, encoding: "utf8" });
    pool = new pg.Pool({ connectionString: conEsquema });
    deps = { clave: CLAVE, datos: datosPanel(pool), faltan: ["CRON_SECRET"], ia: { proveedor: "anthropic" } };
  });
  afterAll(() => pool?.end());

  it("lee toda la configuración de una vez, con las opciones para armar los formularios", async () => {
    const r = await hub("GET", "config");
    expect(r.status).toBe(200);
    const j = r.json as { proyectos: { id: string }[]; tono: { instrucciones: string }; opciones: { campos_ficha: { campo: string }[]; etapas_seguimiento: string[] }; falta: { listo: boolean }[] };
    expect(j.proyectos.map((p) => p.id)).toContain("lerma-439");
    expect(j.tono.instrucciones).toContain("Mindlin");
    expect(j.opciones.campos_ficha.map((c) => c.campo)).toContain("presentacion");
    expect(j.opciones.etapas_seguimiento).toContain("Nuevo");
    expect(j.falta[0].listo).toBe(false);
  });

  it("una ficha: crea, cambia solo lo que viene y revisa como el panel; el asistente la usa enseguida", async () => {
    const alta = await hub("PUT", "proyectos/torre-nueva", { nombre: "Torre Nueva", palabras_clave: ["Vía 53", "torre 53"], precios: "2 ambientes desde USD 108.000" }, { usuario: "  Tadeo " });
    expect(alta.status).toBe(201);
    expect(alta.json.proyecto).toMatchObject({ id: "torre-nueva", nombre: "Torre Nueva", activo: true, palabras_clave: ["vía 53", "torre 53"], precios: "2 ambientes desde USD 108.000", presentacion: "" });
    expect((await pool.query("select actualizado_por from proyectos where id = 'torre-nueva'")).rows[0].actualizado_por).toBe("Tadeo");

    const cambio = await hub("PUT", "proyectos/torre-nueva", { presentacion: "La torre frente al Teatro Argentino.", activo: false });
    expect(cambio.status).toBe(200);
    expect(cambio.json.proyecto).toMatchObject({ nombre: "Torre Nueva", precios: "2 ambientes desde USD 108.000", presentacion: "La torre frente al Teatro Argentino.", activo: false, palabras_clave: ["vía 53", "torre 53"] });
    // Apagado: el asistente no lo ofrece.
    expect((await crearAlmacen(pool).proyectosActivos()).map((p) => p.id)).not.toContain("torre-nueva");

    expect(await hub("PUT", "proyectos/Con Espacios", { nombre: "x" })).toMatchObject({ status: 400 });
    expect(await hub("PUT", "proyectos/sin-nombre", { precios: "x" })).toMatchObject({ status: 400, json: { error: expect.stringContaining("nombre") } });
    expect((await hub("PUT", "proyectos/torre-nueva", { precios: "x".repeat(8001) })).status).toBe(400);
  });

  it("el tono: cambia lo que viene, incluido el modo «presenta y pasa»", async () => {
    const r = await hub("PUT", "tono", { pasar_al_responder: true, criterios_comerciales: "Solo vendemos: si piden alquiler, decirlo con amabilidad." });
    expect(r.status).toBe(200);
    expect(r.json.tono).toMatchObject({ pasar_al_responder: true, criterios_comerciales: "Solo vendemos: si piden alquiler, decirlo con amabilidad." });
    const tono = await crearAlmacen(pool).tono();
    expect(tono.pasar_al_responder).toBe(true);
    expect(tono.instrucciones).toContain("Mindlin"); // lo que no vino, quedó
    expect((await hub("PUT", "tono", { instrucciones: "" })).status).toBe(400);
  });

  it("reglas de seguimiento: alta, cambio de estado y borrado (solo si nunca se mandó)", async () => {
    const mala = await hub("POST", "reglas", { etapa: "Vendido", paso: 1, dias_sin_respuesta: 1, mensaje: "Hola" });
    expect(mala).toMatchObject({ status: 400, json: { error: "Elegí una etapa del CRM." } });
    const alta = await hub("POST", "reglas", { etapa: "Nuevo", paso: 1, dias_sin_respuesta: 1, proyecto: "lerma-439", mensaje: "Hola {{nombre}}, ¿pudiste ver lo de {{proyecto}}?", estado: "a_prueba" });
    expect(alta.status).toBe(201);
    const id = alta.json.id as number;
    expect((alta.json.reglas as { id: number; estado: string; enviados: number }[]).find((x) => x.id === id)).toMatchObject({ estado: "a_prueba", enviados: 0 });

    expect((await hub("PATCH", `reglas/${id}`, { estado: "cualquiera" })).status).toBe(400);
    expect((await hub("PATCH", `reglas/${id}`, { estado: "activa" })).status).toBe(200);
    expect((await crearAlmacen(pool).reglasVigentes()).find((x) => x.id === id)?.estado).toBe("activa");
    expect((await hub("DELETE", `reglas/${id}`)).status).toBe(200);
    expect((await hub("DELETE", `reglas/${id}`)).status).toBe(409);
  });

  it("ejemplos, pausa y resumen", async () => {
    const alta = await hub("POST", "ejemplos", { titulo: "Consulta por 2 ambientes", conversacion: "Interesado: Hola\nMindlin: ¡Hola!" });
    expect(alta.status).toBe(201);
    const [{ id }] = alta.json.ejemplos as { id: number }[];
    expect((await hub("PATCH", `ejemplos/${id}`, { activo: false })).json.ejemplos).toMatchObject([{ id, activo: false }]);
    expect((await hub("DELETE", `ejemplos/${id}`)).json.ejemplos).toEqual([]);

    expect((await hub("PUT", "estado", { pausado: "sí" })).status).toBe(400);
    expect((await hub("PUT", "estado", { pausado: true }, { usuario: "Mati" })).json.estado).toMatchObject({ pausado: true, cambiado_por: "Mati" });
    expect(await crearAlmacen(pool).pausado()).toBe(true);
    await hub("PUT", "estado", { pausado: false });

    const resumen = await hub("GET", "resumen");
    expect(resumen.json.ultimos_7_dias).toMatchObject({ pausa: 2 });
  });

  it("probar: usa la prueba del asistente; sin IA avisa; lo que no existe, 404 o 405", async () => {
    expect((await hub("POST", "probar", { texto: "Hola" })).status).toBe(503);
    const pedidos: unknown[] = [];
    const conIA: DependenciasHub = { ...deps, probar: async (estado, texto) => (pedidos.push({ estado, texto }), { estado: { mensajes: [], proyecto: null, anotado: {}, pasada: false }, acciones: ["🏢 Eligió el proyecto Lerma 439"] }) };
    const r = await manejarHub(pedido("POST", "probar", { texto: " Hola ", proyecto: "lerma-439" }), conIA);
    expect(r).toMatchObject({ status: 200, json: { acciones: ["🏢 Eligió el proyecto Lerma 439"] } });
    expect(pedidos).toEqual([{ estado: { mensajes: [], proyecto: "lerma-439", anotado: {}, pasada: false }, texto: "Hola" }]);
    expect((await manejarHub(pedido("POST", "probar", {}), conIA)).status).toBe(400);

    expect((await hub("GET", "no-existe")).status).toBe(404);
    expect((await hub("DELETE", "config")).status).toBe(405);
    expect((await hub("GET", "proyectos/lerma-439/extra")).status).toBe(404);
  });
});

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
