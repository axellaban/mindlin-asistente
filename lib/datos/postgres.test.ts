import { execFileSync } from "node:child_process";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
    expect(migrar()).toContain("aplicada 202611070002_mensajes.sql");
    // La segunda vez no aplica nada.
    expect(migrar()).not.toContain("aplicada");
  });
  afterAll(() => pool?.end());

  it("trae Lerma 439 y el borrador del tono que deja la migración", async () => {
    const a = crearAlmacen(pool);
    expect((await a.proyectosActivos()).map((p) => p.id)).toEqual(["lerma-439"]);
    expect((await a.proyectosActivos())[0].palabras_clave).toEqual(["lerma", "lerma 439"]);
    expect((await a.tono()).instrucciones).toContain("Mindlin Developers");
    expect(await a.ejemplos()).toEqual([]);
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
    expect(await a.conversacion(9)).toBeNull();
    await a.guardarConversacion({ chatwoot_id: 9, telefono: "5491155550000", nombre: "Ana" });
    await a.guardarConversacion({ chatwoot_id: 9, proyecto: "lerma-439" });
    await a.guardarConversacion({ chatwoot_id: 9, crm_contacto_id: "c1" });
    expect(await a.conversacion(9)).toEqual({ chatwoot_id: 9, proyecto: "lerma-439", crm_contacto_id: "c1", telefono: "5491155550000", nombre: "Ana" });
  });

  it("registra lo que hizo el bot", async () => {
    const a = crearAlmacen(pool);
    await a.registrar({ tipo: "respuesta", conversacion: 9, detalle: "hola", datos: { fin: "respuesta" } });
    const { rows } = await pool.query("select tipo, detalle, datos from registro");
    expect(rows).toEqual([{ tipo: "respuesta", detalle: "hola", datos: { fin: "respuesta" } }]);
  });

  it("deja las reglas sugeridas archivadas: no manda nada hasta que Mindlin las active", async () => {
    const a = crearAlmacen(pool);
    const { rows } = await pool.query("select etapa, paso, estado from reglas_seguimiento order by paso");
    expect(rows).toEqual([
      { etapa: "Nuevo", paso: 1, estado: "archivada" },
      { etapa: "Nuevo", paso: 2, estado: "archivada" },
    ]);
    expect(await a.reglasSeguimiento()).toEqual([]);
    await pool.query("update reglas_seguimiento set estado = 'activa' where paso = 1");
    expect((await a.reglasSeguimiento()).map((r) => [r.id > 0, r.etapa, r.paso, r.dias_sin_respuesta, r.proyecto])).toEqual([[true, "Nuevo", 1, 1, null]]);
  });

  it("elige para seguimiento solo las conversaciones del bot sin respuesta ni intervención del equipo", async () => {
    const a = crearAlmacen(pool);
    const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();
    const conv = async (n: number, roles: ("interesado" | "bot" | "persona")[]) => {
      await a.guardarConversacion({ chatwoot_id: n, telefono: `54911555500${n}`, nombre: "Ana", proyecto: "lerma-439" });
      for (const [i, rol] of roles.entries()) await a.guardarMensaje({ id: n * 100 + i, conversacion: n, rol, texto: rol, fecha: hace(5 - i * 0.1) });
    };
    await conv(31, ["interesado", "bot"]); // sí
    await conv(32, ["interesado", "bot", "interesado"]); // no: le toca al bot contestar
    await conv(33, ["interesado", "persona", "bot"]); // no: escribió el equipo
    await conv(34, ["interesado", "bot"]); // no: la tomó el equipo
    await a.permitirSeguimientos(34, false);
    await conv(35, ["bot"]); // no: la persona nunca escribió

    const hasta = new Date(Date.now() - 86_400_000);
    const candidatos = await a.candidatosSeguimiento(hasta);
    expect(candidatos.map((c) => c.chatwoot_id)).toEqual([31]);
    expect(candidatos[0]).toMatchObject({ nombre: "Ana", telefono: "5491155550031", proyecto: "lerma-439", paso: 0 });
    // Demasiado reciente para el corte.
    expect(await a.candidatosSeguimiento(new Date(Date.now() - 10 * 86_400_000))).toEqual([]);

    // Después del primer seguimiento queda en el paso 1…
    await a.anotarSeguimiento(31, 1, 1, hace(1));
    expect((await a.candidatosSeguimiento(new Date()))[0]).toMatchObject({ chatwoot_id: 31, paso: 1 });
    // …y si la persona vuelve a escribir, vuelve a 0.
    await a.guardarMensaje({ id: 3190, conversacion: 31, rol: "interesado", texto: "hola de nuevo", fecha: hace(0.5) });
    await a.guardarMensaje({ id: 3191, conversacion: 31, rol: "bot", texto: "¡Hola!", fecha: hace(0.4) });
    expect((await a.candidatosSeguimiento(new Date()))[0]).toMatchObject({ chatwoot_id: 31, paso: 0 });

    // Si el equipo la toma y después vuelve al bot, se permiten de nuevo (la 31 tiene un mensaje reciente).
    await a.permitirSeguimientos(34, true);
    expect((await a.candidatosSeguimiento(hasta)).map((c) => c.chatwoot_id)).toEqual([34]);
  });
});
