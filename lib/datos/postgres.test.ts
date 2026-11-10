import { execFileSync } from "node:child_process";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REGLAS_POR_DEFECTO } from "../etapas/reglas";
import { crearAlmacen } from "./postgres";

/**
 * Contra un Postgres de verdad (en GitHub, el servicio del control Verificar). Sin
 * PRUEBA_DATABASE_URL se saltean. La base se vacía antes de empezar: usar una de prueba.
 */
const url = process.env.PRUEBA_DATABASE_URL;

describe.skipIf(!url)("almacén en Postgres (migraciones y consultas reales)", () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query("drop schema public cascade; create schema public;");
    const migrar = () => execFileSync("node", ["scripts/migrar.mjs"], { env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: "" }, encoding: "utf8" });
    expect(migrar()).toContain("aplicada 202611100004_pausa.sql");
    // La segunda vez no aplica nada.
    expect(migrar()).not.toContain("aplicada");
  });
  afterAll(() => pool?.end());

  it("trae Lerma 439 y el borrador del tono que deja la migración", async () => {
    const a = crearAlmacen(pool);
    expect((await a.proyectosActivos()).map((p) => p.id)).toEqual(["lerma-439"]);
    expect((await a.tono()).instrucciones).toContain("Mindlin Developers");
    expect(await a.ejemplos()).toEqual([]);
  });

  it("los borradores de Kommo: Lerma completa lo vacío; los demás proyectos y los seguimientos quedan apagados", async () => {
    const a = crearAlmacen(pool);
    const [lerma] = await a.proyectosActivos();
    expect(lerma.palabras_clave).toEqual(["lerma", "lerma 439", "queens", "villa crespo"]);
    expect(lerma.precios).toContain("USD 88.000");
    expect(lerma.presentacion).toContain("entre Villa Crespo y Palermo");
    expect(lerma.links).toBe("Brochure: https://drive.google.com/file/d/1ZtdTA8n5gqpvP3_DbxAZpiI_SD7CF12q/view?usp=sharing");
    // Cinco proyectos más, apagados: el asistente no los ofrece hasta que alguien los active.
    const { rows } = await pool.query("select id, activo from proyectos order by id");
    expect(rows).toEqual([
      { id: "17-y-43", activo: false },
      { id: "guemes", activo: false },
      { id: "lerma-439", activo: true },
      { id: "ramblas-del-plata", activo: false },
      { id: "torre-cuatro-vientos", activo: false },
      { id: "via-53", activo: false },
    ]);
    // Un seguimiento por proyecto, archivado: no sale ninguno.
    expect((await pool.query("select count(*)::int as n from reglas_seguimiento where estado = 'archivada' and dias_sin_respuesta = 1")).rows[0].n).toBe(6);
    expect(await a.reglasVigentes()).toEqual([]);
    expect((await a.tono()).criterios_comerciales).toContain("solo vende");
  });

  it("las etapas automáticas de fábrica y la base comercial que deja la migración", async () => {
    const a = crearAlmacen(pool);
    expect(await a.reglasEtapa()).toEqual(REGLAS_POR_DEFECTO);
    const tono = await a.tono();
    expect(tono.sobre_la_empresa).toContain("más de 100.000 m² construidos");
    expect(tono.objeciones).toContain("«Me parece caro»");
    expect((await pool.query("select tipologias from proyectos where id = '17-y-43'")).rows[0].tipologias).toContain("Tipo C");
    // El registro acepta el tipo nuevo.
    await a.registrar({ tipo: "etapa", conversacion: 1, detalle: "Nuevo → Contacto inicial", datos: { evento: "primer_contacto" } });
  });

  it("guarda el historial sin repetir y devuelve los últimos en orden", async () => {
    const a = crearAlmacen(pool);
    for (let i = 1; i <= 5; i++) await a.guardarMensaje({ id: 100 + i, conversacion: 9, rol: i % 2 ? "interesado" : "bot", texto: `m${i}`, fecha: `2026-11-07T21:0${i}:00.000Z` });
    await a.guardarMensaje({ id: 101, conversacion: 9, rol: "interesado", texto: "repetido", fecha: "2026-11-07T21:09:00.000Z" });
    const h = await a.historial(9, 3);
    expect(h.map((m) => m.texto)).toEqual(["m3", "m4", "m5"]);
    expect(h[0]).toEqual({ id: 103, conversacion: 9, rol: "interesado", texto: "m3", fecha: "2026-11-07T21:03:00.000Z" });
  });

  it("reclama cada mensaje una sola vez", async () => {
    const a = crearAlmacen(pool);
    expect(await a.reclamarMensaje(500, 9)).toBe(true);
    expect(await a.reclamarMensaje(500, 9)).toBe(false);
  });

  it("guarda la conversación sin borrar lo que no se manda", async () => {
    const a = crearAlmacen(pool);
    expect(await a.conversacion(19)).toBeNull();
    await a.guardarConversacion({ chatwoot_id: 19, telefono: "5491155550000", nombre: "Ana" });
    await a.guardarConversacion({ chatwoot_id: 19, proyecto: "lerma-439" });
    await a.guardarConversacion({ chatwoot_id: 19, crm_contacto_id: "c1" });
    expect(await a.conversacion(19)).toEqual({ chatwoot_id: 19, proyecto: "lerma-439", crm_contacto_id: "c1", telefono: "5491155550000", nombre: "Ana", interesado: {}, ultimo_seguimiento: null });
    // Lo que anotó el asistente (jsonb) va y vuelve igual, y no borra lo demás.
    await a.guardarConversacion({ chatwoot_id: 19, interesado: { nombre: "Ana Prueba", presupuesto_usd: "90000" } });
    expect(await a.conversacion(19)).toMatchObject({ proyecto: "lerma-439", interesado: { nombre: "Ana Prueba", presupuesto_usd: "90000" } });
  });

  it("arranca sin pausa y acepta los tipos nuevos del registro", async () => {
    const a = crearAlmacen(pool);
    expect(await a.pausado()).toBe(false);
    await pool.query("update asistente_estado set pausado = true");
    expect(await a.pausado()).toBe(true);
    await pool.query("update asistente_estado set pausado = false");
    await a.registrar({ tipo: "volvio_al_bot", conversacion: 9, detalle: "x" });
    await pool.query("delete from registro");
  });

  it("registra lo que hizo el bot", async () => {
    const a = crearAlmacen(pool);
    await a.registrar({ tipo: "respuesta", conversacion: 9, detalle: "hola", datos: { fin: "respuesta" } });
    const { rows } = await pool.query("select tipo, detalle, datos from registro");
    expect(rows).toEqual([{ tipo: "respuesta", detalle: "hola", datos: { fin: "respuesta" } }]);
  });

  it("cambia el texto de un mensaje (la transcripción de un audio)", async () => {
    const a = crearAlmacen(pool);
    await a.guardarMensaje({ id: 300, conversacion: 30, rol: "interesado", texto: "[audio]", fecha: "2026-11-07T21:00:00.000Z" });
    await a.actualizarTextoMensaje(300, "[audio: «¿Tienen cochera?»]");
    expect((await a.historial(30, 5))[0].texto).toBe("[audio: «¿Tienen cochera?»]");
  });

  it("seguimientos: candidatos, reclamo sin repetir, respuesta y corte cuando escribe el equipo", async () => {
    const a = crearAlmacen(pool);
    const ahora = "2026-11-10T14:00:00.000Z";
    const msg = (id: number, conversacion: number, rol: "interesado" | "bot" | "persona", fecha: string) => a.guardarMensaje({ id, conversacion, rol, texto: rol, fecha });
    // 40: el bot le contestó hace 3 días y no respondió. 41: escribió último. 42: lo tomó el equipo.
    await msg(400, 40, "interesado", "2026-11-07T13:00:00.000Z");
    await msg(401, 40, "bot", "2026-11-07T13:01:00.000Z");
    await a.guardarConversacion({ chatwoot_id: 40, telefono: "5491155550000", nombre: "Ana", proyecto: "lerma-439" });
    await msg(410, 41, "bot", "2026-11-07T13:01:00.000Z");
    await msg(411, 41, "interesado", "2026-11-07T13:05:00.000Z");
    await msg(420, 42, "interesado", "2026-11-07T13:00:00.000Z");
    await msg(421, 42, "persona", "2026-11-07T13:01:00.000Z");

    expect(await a.candidatosSeguimiento(ahora)).toEqual([
      { chatwoot_id: 40, nombre: "Ana", nombre_anotado: null, telefono: "5491155550000", proyecto: "lerma-439", crm_contacto_id: null, paso_seguimiento: 0, ultima_salida: "2026-11-07T13:01:00.000Z" },
    ]);

    const { rows } = await pool.query(
      "insert into reglas_seguimiento (etapa, paso, dias_sin_respuesta, mensaje) values ('Nuevo', 1, 2, 'Hola {{nombre}}'), ('Nuevo', 1, 2, 'Archivada') returning id",
    );
    await pool.query("update reglas_seguimiento set estado = 'archivada' where id = $1", [rows[1].id]);
    const reglas = await a.reglasVigentes();
    expect(reglas).toEqual([{ id: Number(rows[0].id), etapa: "Nuevo", paso: 1, dias_sin_respuesta: 2, version: 1, estado: "activa", proyecto: null, mensaje: "Hola {{nombre}}" }]);

    const regla = reglas[0].id;
    expect(await a.reclamarSeguimiento({ conversacion: 40, pasoAnterior: 0, regla, ahora })).toBe(true);
    expect(await a.reclamarSeguimiento({ conversacion: 40, pasoAnterior: 0, regla, ahora })).toBe(false);
    await a.anotarSeguimiento({ conversacion: 40, regla, etapa: "Nuevo", paso: 1, version: 1, texto: "Hola Ana", mensaje_id: 402, enviado: ahora });
    // Recién se mandó: hasta dentro de un día no vuelve a ser candidata.
    expect(await a.candidatosSeguimiento(ahora)).toEqual([]);
    expect((await a.candidatosSeguimiento("2026-11-11T14:01:00.000Z"))[0]).toMatchObject({ chatwoot_id: 40, paso_seguimiento: 1, ultima_salida: ahora });

    // Responde: queda anotado en el seguimiento y el paso vuelve a cero.
    await msg(403, 40, "interesado", "2026-11-10T15:00:00.000Z");
    const enviado = await pool.query("select respondio from seguimientos_enviados where conversacion = 40");
    expect(new Date(enviado.rows[0].respondio).toISOString()).toBe("2026-11-10T15:00:00.000Z");
    expect((await pool.query("select paso_seguimiento from conversaciones where chatwoot_id = 40")).rows[0].paso_seguimiento).toBe(0);

    await a.sinSeguimientos(40);
    await msg(404, 40, "bot", "2026-11-10T15:01:00.000Z");
    expect(await a.candidatosSeguimiento("2026-11-20T14:00:00.000Z")).toEqual([]);
    expect(await a.reclamarSeguimiento({ conversacion: 40, pasoAnterior: 0, regla, ahora })).toBe(false);

    // El equipo se la devuelve al bot: vuelve a ser candidata (una sola vez cuenta como cambio).
    expect(await a.volvioAlBot(40)).toBe(true);
    expect(await a.volvioAlBot(40)).toBe(false);
    expect((await a.candidatosSeguimiento("2026-11-20T14:00:00.000Z"))[0]).toMatchObject({ chatwoot_id: 40, paso_seguimiento: 0 });
  });
});
