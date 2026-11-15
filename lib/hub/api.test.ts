import { execFileSync } from "node:child_process";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearAlmacen } from "../datos/postgres";
import { datosPanel } from "../panel/datos";
import { enlacesChatwoot, manejarHub, type DependenciasHub, type PedidoHub } from "./api";

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

describe("API del hub: el link a Chatwoot", () => {
  it("se arma con CHATWOOT_URL y la cuenta; si falta algo, no hay link", () => {
    expect(enlacesChatwoot({ CHATWOOT_URL: "https://chat.ejemplo.test/", CHATWOOT_ACCOUNT_ID: " 1 " })?.(7)).toBe("https://chat.ejemplo.test/app/accounts/1/conversations/7");
    expect(enlacesChatwoot({ CHATWOOT_URL: "https://chat.ejemplo.test" })).toBeNull();
    expect(enlacesChatwoot({ CHATWOOT_URL: "chat.ejemplo.test", CHATWOOT_ACCOUNT_ID: "1" })).toBeNull();
  });
});

describe("API del hub: probar las conexiones", () => {
  it("GET /chequeo devuelve el resultado; solo con GET y con la clave", async () => {
    const chequeo = { ok: false, fecha: "2026-11-13T18:30:00.000Z", pruebas: [{ que: "Chatwoot", estado: "falla" as const, detalle: "No se llega." }] };
    const datos = {} as DependenciasHub["datos"];
    expect(await manejarHub(pedido("GET", "chequeo"), { clave: CLAVE, datos, chequear: async () => chequeo })).toEqual({ status: 200, json: { chequeo } });
    expect((await manejarHub(pedido("POST", "chequeo"), { clave: CLAVE, datos, chequear: async () => chequeo })).status).toBe(405);
    expect((await manejarHub(pedido("GET", "chequeo", null, { autorizacion: null }), { clave: CLAVE, datos, chequear: async () => chequeo })).status).toBe(401);
    expect((await manejarHub(pedido("GET", "chequeo"), { clave: CLAVE, datos })).status).toBe(503);
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

  it("el horario del equipo: se lee con el tono y se cambia entero o de a una parte", async () => {
    const j = (await hub("GET", "config")).json as { tono: { horario_equipo: unknown }; opciones: { horario_equipo: unknown; dias_semana: string[]; horario_seguimientos: { corre: string } } };
    expect(j.tono.horario_equipo).toEqual({ dias: [1, 2, 3, 4, 5], desde: 9, hasta: 20 });
    expect(j.opciones.dias_semana[0]).toBe("domingo");
    expect(j.opciones.horario_seguimientos.corre).toBe("una vez por día, a las 10");
    const r = await hub("PUT", "tono", { horario_equipo: { dias: [1, 2, 3, 4, 5, 6], desde: 10 } });
    expect(r).toMatchObject({ status: 200, json: { tono: { horario_equipo: { dias: [1, 2, 3, 4, 5, 6], desde: 10, hasta: 20 } } } });
    // Lo demás del tono no se tocó.
    expect((await crearAlmacen(pool).tono()).instrucciones).toContain("Mindlin");
    expect((await hub("PUT", "tono", { horario_equipo: { hasta: 19 } })).json.tono).toMatchObject({ horario_equipo: { dias: [1, 2, 3, 4, 5, 6], desde: 10, hasta: 19 } });
    expect(await hub("PUT", "tono", { horario_equipo: { dias: [] } })).toMatchObject({ status: 400, json: { error: "Marcá al menos un día en el horario del equipo." } });
    expect((await hub("PUT", "tono", { horario_equipo: { desde: 21 } })).status).toBe(400);
    expect((await hub("PUT", "tono", { horario_equipo: "de 9 a 20" })).status).toBe(400);
    // El asistente lo usa desde el mensaje siguiente.
    expect((await crearAlmacen(pool).tono()).horario_equipo).toEqual({ dias: [1, 2, 3, 4, 5, 6], desde: 10, hasta: 19 });
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

  it("etapas automáticas: las de fábrica, cambiar una, sacarla y la base comercial en el tono", async () => {
    const j = (await hub("GET", "config")).json as { etapas: { evento: string; etapa: string | null; titulo: string }[]; opciones: { etapas_destino: string[]; eventos_de_etapa: { evento: string }[] }; tono: { sobre_la_empresa: string } };
    expect(j.etapas.map((e) => [e.evento, e.etapa])).toEqual([
      ["primer_contacto", "Contacto inicial"],
      ["respondio", "Seguimiento"],
      ["seguimiento_enviado", null],
      ["respondio_seguimiento", "Seguimiento"],
      ["sin_respuesta", "En pausa"],
      ["quiere_visita", "Visita / reunión"],
      ["senal_de_compra", null],
      ["no_le_interesa", "Descartado"],
      ["paso_al_equipo", null],
    ]);
    expect(j.etapas[0].titulo).toBe("El asistente le respondió por primera vez");
    expect(j.opciones.etapas_destino).toEqual(["Contacto inicial", "Seguimiento", "Visita / reunión", "Negociación", "En pausa", "Descartado"]);
    expect(j.opciones.eventos_de_etapa).toHaveLength(9);
    expect(j.tono.sobre_la_empresa).toContain("Borok Construcciones");

    const cambio = await hub("PUT", "etapas/senal_de_compra", { etapa: "Negociación" }, { usuario: "Mati" });
    expect((cambio.json.etapas as { evento: string; etapa: string | null; actualizado_por: string }[]).find((e) => e.evento === "senal_de_compra")).toMatchObject({ etapa: "Negociación", actualizado_por: "Mati" });
    expect((await crearAlmacen(pool).reglasEtapa()).senal_de_compra).toBe("Negociación");
    // «No mover»: etapa vacía o null.
    await hub("PUT", "etapas/no_le_interesa", { etapa: null });
    expect((await crearAlmacen(pool).reglasEtapa()).no_le_interesa).toBeNull();
    expect((await hub("PUT", "etapas/respondio", { etapa: "Vendido" })).status).toBe(400);
    expect((await hub("PUT", "etapas/inventado", { etapa: "Seguimiento" })).status).toBe(400);
    // El tono guarda también la base comercial.
    expect((await hub("PUT", "tono", { objeciones: "«Me parece caro»: poner en contexto." })).json.tono).toMatchObject({ objeciones: "«Me parece caro»: poner en contexto." });
    expect((await crearAlmacen(pool).tono()).sobre_la_empresa).toContain("Borok Construcciones");
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

    // Con una línea: va en el estado y se revisa que exista. «Simular que no respondió» sin flujo: 400.
    const linea = await manejarHub(pedido("POST", "probar", { texto: "Hola", linea: "linea-4" }), conIA);
    expect(linea.status).toBe(200);
    expect(pedidos.at(-1)).toEqual({ estado: { mensajes: [], proyecto: null, anotado: {}, pasada: false, linea: "linea-4", flujo: null }, texto: "Hola" });
    expect((await manejarHub(pedido("POST", "probar", { texto: "Hola", linea: "linea-9" }), conIA)).status).toBe(404);
    const sinEspera: DependenciasHub = { ...deps, probar: async () => Promise.reject(new Error("No hay un flujo esperando respuesta.")) };
    expect(await manejarHub(pedido("POST", "probar", { vencer: true, linea: "linea-3" }), sinEspera)).toEqual({ status: 400, json: { error: "No hay un flujo esperando respuesta." } });
  });

  it("líneas: se leen las cuatro, se cambian de a una y dos no pueden tener la misma bandeja", async () => {
    const config = (await hub("GET", "config")).json as { lineas: { id: string; bandeja: number | null }[]; opciones: { tipos_linea: unknown[]; tipos_de_paso: { tipo: string }[]; plantillas_flujo: unknown[] } };
    expect(config.lineas.map((l) => [l.id, l.bandeja])).toEqual([
      ["linea-1", null],
      ["linea-2", null],
      ["linea-3", 1],
      ["linea-4", null],
    ]);
    expect(config.opciones.tipos_linea).toHaveLength(3);
    expect(config.opciones.tipos_de_paso.map((t) => t.tipo)).toEqual(["mensaje", "pausa", "ia", "esperar", "etapa", "equipo", "seguir_ia", "fin"]);
    expect(config.opciones.plantillas_flujo.length).toBeGreaterThan(2);

    const r = await hub("PUT", "lineas/linea-4", { bandeja: 2, telefono: "+54 9 11 0000-0000", proyectos: ["lerma-439"], instrucciones: "Vienen de la campaña de Meta.", pasar_al_responder: true }, { usuario: "Tadeo" });
    expect(r.status).toBe(200);
    expect(r.json.linea).toMatchObject({ id: "linea-4", nombre: "Leads entrantes 2", bandeja: 2, proyectos: ["lerma-439"], pasar_al_responder: true, actualizado_por: "Tadeo" });
    // Lo que no viene queda como estaba.
    expect((await hub("PUT", "lineas/linea-4", { pausada: true })).json.linea).toMatchObject({ bandeja: 2, pausada: true, instrucciones: "Vienen de la campaña de Meta." });
    const almacen = crearAlmacen(pool);
    expect((await almacen.lineas()).find((l) => l.id === "linea-4")).toMatchObject({ bandeja: 2, pausada: true, pasar_al_responder: true });

    expect(await hub("PUT", "lineas/linea-1", { bandeja: 2 })).toEqual({ status: 409, json: { error: "La bandeja 2 ya es de la línea «Leads entrantes 2». Cada línea tiene su propia bandeja en Chatwoot." } });
    expect((await hub("PUT", "lineas/linea-4", { proyectos: ["no-existe"] })).status).toBe(400);
    expect((await hub("PUT", "lineas/linea-4", { bandeja: "dos" })).status).toBe(400);
    expect((await hub("PUT", "lineas/linea-9", {})).status).toBe(404);
    await hub("PUT", "lineas/linea-4", { pausada: false, bandeja: null });
    // Una regla de seguimiento para una sola línea.
    const regla = await hub("POST", "reglas", { etapa: "Nuevo", paso: 1, dias_sin_respuesta: 2, mensaje: "Hola {{nombre}}", linea: "linea-4" });
    expect((regla.json.reglas as { id: number; linea: string | null }[]).find((x) => x.id === regla.json.id)?.linea).toBe("linea-4");
    expect((await hub("POST", "reglas", { etapa: "Nuevo", paso: 1, dias_sin_respuesta: 2, mensaje: "Hola", linea: "linea-9" })).status).toBe(400);
  });

  it("flujos: alta, cambio, uno activo por línea y proyecto, y archivos que no se borran si se usan", async () => {
    const subida = await hub("POST", "archivos", { nombre: "audio de Mati.ogg", tipo: "audio/ogg", datos: Buffer.from("OggS fake").toString("base64") }, { usuario: "Mati" });
    expect(subida.status).toBe(201);
    const archivo = (subida.json.archivo as { id: number; tamano: number; creado_por: string; en_uso: number[] });
    expect(archivo).toMatchObject({ tamano: 9, creado_por: "Mati", en_uso: [] });
    expect((await hub("POST", "archivos", { nombre: "x.exe", tipo: "application/x-msdownload", datos: "AAAA" })).status).toBe(400);
    expect((await hub("GET", `archivos/${archivo.id}`)).json.archivo).toMatchObject({ nombre: "audio de Mati.ogg", datos: Buffer.from("OggS fake").toString("base64") });

    const pasos = [
      { tipo: "mensaje", texto: "¡Hola {{nombre}}!", archivo: null },
      { tipo: "mensaje", texto: "", archivo: archivo.id },
      { tipo: "esperar", horas: 24, si_responde: [{ tipo: "equipo", nota: "" }], si_no: [{ tipo: "fin" }] },
    ];
    const alta = await hub("POST", "flujos", { linea: "linea-3", nombre: "Presentación", pasos, activo: true }, { usuario: "Tadeo" });
    expect(alta.status).toBe(201);
    const primero = alta.json.id as number;
    expect((alta.json.flujos as { id: number; activo: boolean; corridas: number }[]).find((f) => f.id === primero)).toMatchObject({ activo: true, corridas: 0 });
    expect(await crearAlmacen(pool).flujosActivos("linea-3")).toMatchObject([{ id: primero, nombre: "Presentación" }]);

    // Un segundo general para la misma línea: al activarlo se apaga el primero.
    const segundo = (await hub("POST", "flujos", { linea: "linea-3", nombre: "Versión 2", pasos: [{ tipo: "seguir_ia" }] })).json.id as number;
    const activos = async () => (await crearAlmacen(pool).flujosActivos("linea-3")).map((f) => f.id);
    expect(await activos()).toEqual([primero]);
    await hub("PATCH", `flujos/${segundo}`, { activo: true });
    expect(await activos()).toEqual([segundo]);
    // Uno del proyecto convive con el general.
    await hub("PUT", `flujos/${primero}`, { proyecto: "lerma-439" });
    await hub("PATCH", `flujos/${primero}`, { activo: true });
    expect((await activos()).sort()).toEqual([primero, segundo].sort());

    // Revisa los pasos como el asistente; lo que no viene queda.
    expect(await hub("PUT", `flujos/${primero}`, { pasos: [{ tipo: "fin" }, { tipo: "mensaje", texto: "x" }] })).toMatchObject({ status: 400, json: { error: expect.stringContaining("tiene que ser el último") } });
    expect((await hub("PUT", `flujos/${primero}`, { nombre: "Presentación Lerma" })).json.flujos).toContainEqual(expect.objectContaining({ id: primero, nombre: "Presentación Lerma", pasos }));
    expect((await hub("POST", "flujos", { linea: "linea-1", nombre: "x", pasos: [{ tipo: "fin" }] })).status).toBe(400);
    expect((await hub("POST", "flujos", { linea: "linea-3", nombre: "x", pasos: [{ tipo: "mensaje", texto: "", archivo: 9999 }] })).status).toBe(400);

    // El archivo está en uso: no se borra.
    expect((await hub("GET", "archivos")).json.archivos).toContainEqual(expect.objectContaining({ id: archivo.id, en_uso: [primero] }));
    expect((await hub("DELETE", `archivos/${archivo.id}`)).status).toBe(409);
    await hub("DELETE", `flujos/${primero}`);
    expect((await hub("DELETE", `archivos/${archivo.id}`)).status).toBe(200);
    expect((await hub("GET", `flujos/${primero}`)).status).toBe(404);

    // El resumen de una línea.
    expect((await hub("GET", "resumen/linea-3")).status).toBe(200);
    expect((await hub("GET", "resumen/linea-9")).status).toBe(404);
  });

  it("conversaciones: de una línea o de un contacto del CRM, con sus mensajes, quién la atiende, el flujo y el link a Chatwoot", async () => {
    const a = crearAlmacen(pool);
    deps = { ...deps, enlaceChatwoot: enlacesChatwoot({ CHATWOOT_URL: "https://chat.ejemplo.test/", CHATWOOT_ACCOUNT_ID: "1" }) };
    // Ana: línea 3, en el CRM, con un flujo esperando. Beto: línea 4, sin CRM, la tomó el equipo.
    await a.guardarConversacion({ chatwoot_id: 501, nombre: "Ana Prueba", telefono: "5491155550001", linea: "linea-3", crm_contacto_id: "cprueba1" });
    await a.guardarConversacion({ chatwoot_id: 502, nombre: "Beto Prueba", telefono: "+54 9 11 5555-0002", linea: "linea-4" });
    await a.guardarMensaje({ id: 9001, conversacion: 501, rol: "interesado", texto: "Hola, quiero info de Lerma", fecha: "2026-11-16T13:00:00.000Z" });
    await a.guardarMensaje({ id: 9002, conversacion: 501, rol: "bot", texto: "¡Hola Ana! Te cuento.", fecha: "2026-11-16T13:00:10.000Z" });
    await a.guardarMensaje({ id: 9003, conversacion: 502, rol: "interesado", texto: "Hola", fecha: "2026-11-16T14:00:00.000Z" });
    await a.guardarMensaje({ id: 9004, conversacion: 502, rol: "persona", texto: "Hola Beto, soy Tadeo", fecha: "2026-11-16T14:05:00.000Z" });
    await a.registrar({ tipo: "la_tomo_una_persona", conversacion: 502, detalle: "Escribió Tadeo." });
    const pasos = [{ tipo: "mensaje", texto: "Hola", archivo: null }, { tipo: "esperar", horas: 24, si_responde: [{ tipo: "seguir_ia" }], si_no: [{ tipo: "fin" }] }];
    const c = await a.iniciarCorrida({ conversacion: 501, linea: "linea-3", flujo: null as never, nombre: "Presentación", pasos: pasos as never, ahora: "2026-11-16T13:00:00.000Z" });
    await a.guardarCorrida(c!.id, { estado: "esperando", posicion: "1", espera_desde: "2026-11-16T13:00:00.000Z", vence: "2026-11-17T13:00:00.000Z" }, "2026-11-16T13:00:00.000Z");

    const todas = (await hub("GET", "conversaciones")).json.conversaciones as { chatwoot_id: number }[];
    expect(todas.slice(0, 2).map((x) => x.chatwoot_id)).toEqual([502, 501]);
    const linea3 = await hub("GET", "conversaciones/linea-3");
    expect(linea3.json.conversaciones).toEqual([
      expect.objectContaining({
        chatwoot_id: 501,
        linea: "linea-3",
        linea_nombre: "Leads entrantes",
        nombre: "Ana Prueba",
        crm_contacto_id: "cprueba1",
        ultimo_texto: "¡Hola Ana! Te cuento.",
        ultimo_rol: "bot",
        mensajes: 2,
        atiende: "asistente",
        flujo: expect.objectContaining({ nombre: "Presentación", estado: "esperando", paso: "Paso 2: Esperar respuesta", vence: "2026-11-17T13:00:00.000Z" }),
        enlace: "https://chat.ejemplo.test/app/accounts/1/conversations/501",
      }),
    ]);
    expect((await hub("GET", "conversaciones/linea-9")).status).toBe(404);

    // Una conversación entera.
    const una = await hub("GET", "conversacion/502");
    expect(una.json.conversacion).toMatchObject({ chatwoot_id: 502, linea: "linea-4", atiende: "equipo", flujo: null, enlace: "https://chat.ejemplo.test/app/accounts/1/conversations/502" });
    expect((una.json.mensajes as { rol: string }[]).map((m) => m.rol)).toEqual(["interesado", "persona"]);
    expect((una.json.registro as { tipo: string }[])[0].tipo).toBe("la_tomo_una_persona");
    expect((await hub("GET", "conversacion/999")).status).toBe(404);

    // Las de un contacto del CRM: por el ID que anotó el asistente o por el teléfono (como lo guarde el CRM).
    const porId = await hub("POST", "contacto", { id: "cprueba1" });
    expect((porId.json.conversaciones as { chatwoot_id: number; historial: { texto: string }[] }[]).map((x) => [x.chatwoot_id, x.historial.map((m) => m.texto)])).toEqual([
      [501, ["Hola, quiero info de Lerma", "¡Hola Ana! Te cuento."]],
    ]);
    const porTelefono = await hub("POST", "contacto", { id: "otro-id", telefono: "11 5555-0002" });
    expect((porTelefono.json.conversaciones as { chatwoot_id: number }[]).map((x) => x.chatwoot_id)).toEqual([502]);
    // Escrito a la antigua, con el 15: igual coincide (los últimos 8 números, como el CRM del hub).
    const conQuince = await hub("POST", "contacto", { telefono: "011 15 5555-0002" });
    expect((conQuince.json.conversaciones as { chatwoot_id: number }[]).map((x) => x.chatwoot_id)).toEqual([502]);
    expect((await hub("POST", "contacto", { telefono: "123" })).json.conversaciones).toEqual([]);
    expect((await hub("POST", "contacto", {})).status).toBe(400);
    expect((await hub("GET", "contacto")).status).toBe(405);
  });

  it("campañas: alta, cambio y baja; la campaña de una línea; de dónde vinieron las conversaciones", async () => {
    const alta = await hub("POST", "campanias", { nombre: "Meta Lerma nov", frases: "Quiero más información sobre Lerma\nVi el anuncio de Lerma" }, { usuario: "Mati" });
    expect(alta.status).toBe(201);
    const id = alta.json.id as number;
    expect(alta.json.campanias).toEqual([expect.objectContaining({ id, nombre: "Meta Lerma nov", linea: null, frases: ["Quiero más información sobre Lerma", "Vi el anuncio de Lerma"], activa: true, actualizado_por: "Mati" })]);
    // El asistente la usa enseguida.
    expect((await crearAlmacen(pool).campanias()).map((c) => c.nombre)).toEqual(["Meta Lerma nov"]);
    // Solo cambia lo que viene.
    const cambio = await hub("PUT", `campanias/${id}`, { linea: "linea-3", activa: false });
    expect((cambio.json.campanias as { linea: string; activa: boolean; frases: string[] }[])[0]).toMatchObject({ linea: "linea-3", activa: false, frases: ["Quiero más información sobre Lerma", "Vi el anuncio de Lerma"] });
    expect(await crearAlmacen(pool).campanias()).toEqual([]);
    // Lo que no se puede.
    expect((await hub("POST", "campanias", { nombre: "" })).status).toBe(400);
    expect((await hub("POST", "campanias", { nombre: "X", frases: ["hol"] })).status).toBe(400);
    expect((await hub("PUT", `campanias/${id}`, { linea: "linea-9" })).status).toBe(400);
    expect((await hub("PUT", "campanias/999", { nombre: "X" })).status).toBe(404);
    // En la configuración, con las opciones.
    const config = await hub("GET", "config");
    expect((config.json.campanias as unknown[]).length).toBe(1);
    expect((config.json.opciones as { limites_campania: { nombre: number } }).limites_campania.nombre).toBe(30);

    // La campaña de la línea (y el panel no la borra si no la manda: se cambia solo lo que viene).
    const linea = await hub("PUT", "lineas/linea-4", { campania: " Meta  MdP " });
    expect(linea.json.linea).toMatchObject({ campania: "Meta MdP" });
    expect((await hub("PUT", "lineas/linea-4", { instrucciones: "De la campaña de Mar del Plata." })).json.linea).toMatchObject({ campania: "Meta MdP" });
    expect((await hub("PUT", "lineas/linea-4", { campania: "x".repeat(31) })).status).toBe(400);

    // De dónde vinieron las conversaciones nuevas: por campaña, y en cada conversación.
    const a = crearAlmacen(pool);
    await a.guardarConversacion({ chatwoot_id: 601, linea: "linea-4", campania: "Meta MdP", campania_por: "linea" });
    await a.guardarMensaje({ id: 9101, conversacion: 601, rol: "interesado", texto: "Hola", fecha: new Date().toISOString() });
    const resumen = await hub("GET", "resumen/linea-4");
    // La de Beto (de la prueba de arriba) es de la línea 4 y no tiene campaña: va al final, como «sin campaña».
    expect(resumen.json.por_campania_30_dias).toEqual([
      { campania: "Meta MdP", conversaciones: 1 },
      { campania: null, conversaciones: 1 },
    ]);
    const conversaciones = (await hub("GET", "conversaciones/linea-4")).json.conversaciones as { chatwoot_id: number; campania: string }[];
    expect(conversaciones.find((c) => c.chatwoot_id === 601)?.campania).toBe("Meta MdP");

    expect((await hub("DELETE", `campanias/${id}`)).json.campanias).toEqual([]);
  });

  it("resultados: cuántos llegaron a visita, negociación y reserva por flujo y por versión de seguimiento; sin CRM, lo dice", async () => {
    const a = crearAlmacen(pool);
    const pasos = [{ tipo: "mensaje", texto: "Hola", archivo: null }, { tipo: "fin" }];
    const { rows } = await pool.query("insert into flujos (linea, nombre, activo, pasos) values ('linea-3', 'Para medir', false, $1) returning id", [JSON.stringify(pasos)]);
    const flujo = Number(rows[0].id);
    const ahora = new Date().toISOString();
    // Ana (en el CRM, hoy en Negociación) y Beto (lo movió el asistente a Visita y después lo descartaron).
    await a.guardarConversacion({ chatwoot_id: 701, crm_contacto_id: "cmedir1", telefono: "5491166660001", linea: "linea-3" });
    await a.guardarConversacion({ chatwoot_id: 702, telefono: "5491166660002", linea: "linea-3" });
    for (const conv of [701, 702]) {
      const c = await a.iniciarCorrida({ conversacion: conv, linea: "linea-3", flujo, nombre: "Para medir", pasos: pasos as never, ahora });
      await a.guardarCorrida(c!.id, { estado: "terminado", resultado: "fin" }, ahora);
    }
    await a.registrar({ tipo: "etapa", conversacion: 702, detalle: "Seguimiento → Visita / reunión: pidió visita.", datos: { etapa: "Visita / reunión" } });
    const { rows: regla } = await pool.query("insert into reglas_seguimiento (etapa, paso, dias_sin_respuesta, version, estado, mensaje) values ('Nuevo', 1, 1, 2, 'activa', 'Hola') returning id");
    await pool.query("insert into seguimientos_enviados (conversacion, regla, etapa, paso, version, texto) values (701, $1, 'Nuevo', 1, 2, 'Hola')", [regla[0].id]);
    const crm = [
      { id: "cmedir1", nombre: "Ana", telefono: "+54 9 11 6666-0001", etapa: "Negociación" },
      { id: "cmedir2", nombre: "Beto", telefono: "011 15 6666-0002", etapa: "Descartado" },
    ] as never[];
    deps = { ...deps, contactosCRM: async () => crm };
    const r = await hub("GET", "resultados");
    expect(r.json).toMatchObject({ dias: 90, crm: true });
    expect((r.json.flujos as { flujo: number }[]).find((f) => f.flujo === flujo)).toEqual({ flujo, leads: 2, visita: 2, negociacion: 1, reserva: 0 });
    expect((r.json.seguimientos as { regla: number }[]).find((x) => x.regla === Number(regla[0].id))).toEqual({ regla: Number(regla[0].id), version: 2, leads: 1, visita: 1, negociacion: 1, reserva: 0 });

    // Sin CRM, o si el CRM falla, lo dice (no muestra ceros como si nadie hubiera llegado).
    deps = { ...deps, contactosCRM: null };
    expect((await hub("GET", "resultados")).json).toMatchObject({ crm: false, flujos: [], error: expect.stringMatching(/^El CRM no está conectado/) });
    deps = { ...deps, contactosCRM: async () => { throw new Error("cuota de Google"); } };
    expect((await hub("GET", "resultados")).json).toMatchObject({ crm: false, error: "No se pudo leer el CRM: cuota de Google" });
    expect((await hub("POST", "resultados")).status).toBe(405);
  });

  it("corridas: quiénes están adentro de un flujo y en qué paso; sacar a una persona o reiniciarla (lo retoma el cron)", async () => {
    const a = crearAlmacen(pool);
    const viejos = [{ tipo: "mensaje", texto: "Hola", archivo: null }, { tipo: "esperar", horas: 24, si_responde: [{ tipo: "seguir_ia" }], si_no: [{ tipo: "fin" }] }];
    const { rows } = await pool.query("insert into flujos (linea, nombre, activo, pasos) values ('linea-4', 'Para sacar', false, $1) returning id", [JSON.stringify(viejos)]);
    const flujo = Number(rows[0].id);
    const ahora = new Date().toISOString();
    await a.guardarConversacion({ chatwoot_id: 801, nombre: "Ana Prueba", telefono: "5491177770001", linea: "linea-4" });
    const c = await a.iniciarCorrida({ conversacion: 801, linea: "linea-4", flujo, nombre: "Para sacar", pasos: viejos as never, ahora });
    await a.guardarCorrida(c!.id, { estado: "esperando", posicion: "1", espera_desde: ahora, vence: new Date(Date.now() + 86_400_000).toISOString() }, ahora);

    const lista = await hub("GET", "corridas");
    expect((lista.json.corridas as { id: number }[]).find((x) => x.id === c!.id)).toMatchObject({ flujo, nombre_flujo: "Para sacar", conversacion: 801, nombre: "Ana Prueba", estado: "esperando", paso: "Paso 2: Esperar respuesta" });

    // Sacarla: termina, desde ahí conversa la IA, y queda en el registro.
    const sacar = await hub("PATCH", `corridas/${c!.id}`, { accion: "sacar" }, { usuario: "Mati" });
    expect(sacar.json.hecho).toMatch(/^La sacaste del flujo/);
    expect(await a.ultimaCorrida(801)).toMatchObject({ estado: "terminado", resultado: "cancelado" });
    expect((await pool.query("select detalle from registro where conversacion = 801 order by id desc limit 1")).rows[0].detalle).toBe("Mati la sacó del flujo «Para sacar» desde el hub: desde ahora conversa la IA.");
    expect((await hub("PATCH", `corridas/${c!.id}`, { accion: "sacar" })).status).toBe(404);

    // Reiniciarla: vuelve al primer paso con los pasos de hoy del flujo; la retoma el cron.
    const nuevos = [{ tipo: "mensaje", texto: "Hola de nuevo", archivo: null }, { tipo: "fin" }];
    await pool.query("update flujos set pasos = $2 where id = $1", [flujo, JSON.stringify(nuevos)]);
    const reiniciar = await hub("PATCH", `corridas/${c!.id}`, { accion: "reiniciar" });
    expect(reiniciar.json.hecho).toMatch(/^Reiniciado/);
    expect(await a.corridaViva(801)).toMatchObject({ estado: "en_curso", posicion: "0", pasos: nuevos });
    expect((await a.corridasParaRetomar(new Date().toISOString())).map((x) => x.id)).toContain(c!.id);

    // Con otro flujo vivo en la misma conversación, no se puede reiniciar el viejo.
    await a.cancelarCorridas(801);
    await a.iniciarCorrida({ conversacion: 801, linea: "linea-4", flujo, nombre: "Otro", pasos: nuevos as never, ahora });
    expect((await hub("PATCH", `corridas/${c!.id}`, { accion: "reiniciar" })).status).toBe(409);
    expect((await hub("PATCH", "corridas/999999", { accion: "reiniciar" })).status).toBe(404);
    expect((await hub("PATCH", `corridas/${c!.id}`, { accion: "otra" })).status).toBe(400);
    expect((await hub("POST", "corridas")).status).toBe(405);
  });

  it("responder desde el hub: con texto, a una conversación que existe y diciendo quién; si falta Chatwoot, lo dice", async () => {
    const a = crearAlmacen(pool);
    await a.guardarConversacion({ chatwoot_id: 901, nombre: "Ana Prueba", linea: "linea-3" });
    const enviados: [number, string, string][] = [];
    deps = { ...deps, responder: async (c, t, por) => (enviados.push([c, t, por]), { id: 1, conversacion: c, rol: "persona" as const, texto: t, fecha: "2026-11-16T13:00:00.000Z" }) };
    const r = await hub("POST", "responder/901", { texto: "  Hola Ana, soy Mati  " }, { usuario: "Mati" });
    expect(r).toMatchObject({ status: 200, json: { mensaje: { conversacion: 901, rol: "persona", texto: "Hola Ana, soy Mati" } } });
    expect(enviados).toEqual([[901, "Hola Ana, soy Mati", "Mati"]]);
    expect((await hub("POST", "responder/901", { texto: "" }, { usuario: "Mati" })).status).toBe(400);
    expect((await hub("POST", "responder/901", { texto: "x".repeat(4001) }, { usuario: "Mati" })).status).toBe(400);
    expect((await hub("POST", "responder/999999", { texto: "Hola" }, { usuario: "Mati" })).status).toBe(404);
    expect((await hub("POST", "responder/901", { texto: "Hola" })).status).toBe(400);
    expect((await hub("GET", "responder/901")).status).toBe(405);
    deps = { ...deps, responder: null };
    expect((await hub("POST", "responder/901", { texto: "Hola" }, { usuario: "Mati" })).status).toBe(503);
    expect(enviados).toHaveLength(1);
  });

  it("revisar respuestas reales: las que faltan (con lo de antes y el borrador sin datos), marcar mala con nota o buena como ejemplo", async () => {
    const a = crearAlmacen(pool);
    await a.guardarConversacion({ chatwoot_id: 1001, nombre: "Ana Prueba", linea: "linea-3", proyecto: "lerma-439" });
    const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    await a.guardarMensaje({ id: 10001, conversacion: 1001, rol: "interesado", texto: "Hola, soy Ana, quiero info de Lerma", fecha: hace(30) });
    await a.guardarMensaje({ id: 10002, conversacion: 1001, rol: "bot", texto: "¡Hola Ana! Lerma 439 tiene 1 y 2 ambientes.", fecha: hace(29) });
    await a.guardarMensaje({ id: 10003, conversacion: 1001, rol: "interesado", texto: "¿Precio del 2 ambientes?", fecha: hace(20) });
    await a.guardarMensaje({ id: 10004, conversacion: 1001, rol: "bot", texto: "Desde USD 105.000.", fecha: hace(19) });

    const r = await hub("GET", "revisar");
    const pendientes = r.json.pendientes as { mensaje: number; antes: unknown[]; borrador: string; linea_nombre: string }[];
    const ultima = pendientes.find((p) => p.mensaje === 10004)!;
    expect(ultima.antes).toHaveLength(3);
    expect(ultima.linea_nombre).toBe("Leads entrantes");
    expect(ultima.borrador).toBe("Interesado: Hola, soy [nombre], quiero info de Lerma\nAsistente: ¡Hola [nombre]! Lerma 439 tiene 1 y 2 ambientes.\nInteresado: ¿Precio del 2 ambientes?\nAsistente: Desde USD 105.000.");

    // Una mala tiene que decir qué corregir.
    expect((await hub("POST", "revisar/10002", { veredicto: "mala" })).status).toBe(400);
    const mala = await hub("POST", "revisar/10002", { veredicto: "mala", nota: "Tenía que preguntar para qué busca antes de contar." }, { usuario: "Mindlin" });
    expect(mala.json.hecho).toBe("Anotada como mala, con qué corregir.");
    expect((mala.json.malas as { mensaje: number; nota: string; creado_por: string }[])[0]).toMatchObject({ mensaje: 10002, nota: "Tenía que preguntar para qué busca antes de contar.", creado_por: "Mindlin" });
    expect((mala.json.pendientes as { mensaje: number }[]).map((p) => p.mensaje)).not.toContain(10002);

    // Una buena, con el ejemplo corregido: queda en los ejemplos y el asistente lo usa.
    const buena = await hub("POST", "revisar/10004", { veredicto: "buena", titulo: "Precio directo", conversacion: "Interesado: ¿Precio del 2 ambientes?\nAsistente: Desde USD 105.000." });
    expect(buena.json.hecho).toMatch(/^Buena: quedó como ejemplo/);
    expect((await a.ejemplos()).map((e) => e.titulo)).toContain("Precio directo");
    expect(buena.json.revisadas_7_dias).toEqual({ buenas: 1, malas: 1 });

    // Lo que no se puede.
    expect((await hub("POST", "revisar/10003", { veredicto: "buena" })).status).toBe(404);
    expect((await hub("POST", "revisar/10004", { veredicto: "regular" })).status).toBe(400);
    expect((await hub("POST", "revisar/10004", { veredicto: "buena", titulo: "", conversacion: "x" })).status).toBe(400);
  });

  it("adjuntos: sin el token del usuario «Hub» lo dice; con él, los de la conversación; si Chatwoot falla, 502", async () => {
    const a = crearAlmacen(pool);
    await a.guardarConversacion({ chatwoot_id: 1101, nombre: "Ana Prueba", linea: "linea-3" });
    deps = { ...deps, adjuntos: null };
    expect((await hub("GET", "adjuntos/1101")).json).toMatchObject({ disponible: false, adjuntos: [], motivo: expect.stringMatching(/CHATWOOT_HUB_TOKEN/) });
    deps = { ...deps, adjuntos: async (c) => [{ mensaje: 5, tipo: "foto", url: `https://chat.ejemplo.test/${c}.jpg`, miniatura: null }] };
    expect((await hub("GET", "adjuntos/1101")).json).toEqual({ disponible: true, adjuntos: [{ mensaje: 5, tipo: "foto", url: "https://chat.ejemplo.test/1101.jpg", miniatura: null }] });
    expect((await hub("GET", "adjuntos/999999")).status).toBe(404);
    deps = { ...deps, adjuntos: async () => { throw new Error("Chatwoot respondió 500 al leer los mensajes."); } };
    expect(await hub("GET", "adjuntos/1101")).toEqual({ status: 502, json: { error: "Chatwoot respondió 500 al leer los mensajes." } });
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
