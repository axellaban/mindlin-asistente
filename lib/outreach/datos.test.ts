import { execFileSync } from "node:child_process";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ContactoCRM } from "../crm/planilla";
import { datosOutreach } from "./datos";
import { crearAlmacen } from "../datos/postgres";
import { mensajeDeOutreach } from "./webhook";
import { RESPUESTA_BAJA } from "./respuestas";
import type { Linea } from "../lineas";
import { CONFIG_OUTREACH_DE_FABRICA as F } from "./reglas";

/**
 * El outreach contra un Postgres de verdad (como lib/panel/datos.test.ts), en su propio esquema.
 * Datos inventados. El 16/11/2026 es lunes; Buenos Aires es UTC−3.
 */
const url = process.env.PRUEBA_DATABASE_URL;
const ESQUEMA = "prueba_outreach";
const ba = (fechaHora: string) => new Date(`${fechaHora}:00-03:00`);
const L = "linea-1";

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

const crm = (telefono: string, etapa: string): ContactoCRM =>
  ({ id: `crm-${telefono}`, nombre: "", telefono, etapa, responsable: "", proyectos: [], ultimoContacto: "", notas: "", para: "", ambientes: "", presupuestoUsd: "", formaDePago: "", plazo: "", proximoPaso: "", fechaProximoPaso: "" }) as ContactoCRM;

describe.skipIf(!url)("outreach (Postgres real)", () => {
  let pool: pg.Pool;
  // Sin azar: la cola sale siempre por puntaje (la parte al azar se prueba aparte).
  const d = () => datosOutreach(pool, { azar: () => 1 });

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query(`drop schema if exists ${ESQUEMA} cascade; create schema ${ESQUEMA};`);
    await admin.end();
    execFileSync("node", ["-e", MIGRAR_EN_ESQUEMA], { env: { ...process.env, URL_PRUEBA: url, ESQUEMA }, encoding: "utf8" });
    pool = new pg.Pool({ connectionString: `${url}${url!.includes("?") ? "&" : "?"}options=-c%20search_path%3D${ESQUEMA}` });
  });
  afterAll(() => pool?.end());

  beforeEach(async () => {
    await pool.query("delete from outreach_eventos; delete from outreach_contactos; delete from outreach_lotes; delete from outreach_estado; delete from outreach_config; delete from bajas; delete from conversaciones; delete from registro;");
    await d().guardarConfig(L, { ...F, textos_revisados: true, tope_inicial: 3, tope_max: 10, freno_fallas: 2 }, "Axel");
  });

  const BASE = ["Nombre\tCelular\tProyecto\tFecha", "Ana Gómez\t011 15 1111-1111\tLerma\t10/01/2024", "Beto\t11 2222 2222\t\t05/03/2025", "Caro\t4567-8901\t\t", "Dani\t11 3333 3333\t\t"].join("\n");

  it("carga una base: entran los buenos, quedan por revisar los dudosos y no se repiten", async () => {
    await pool.query("insert into conversaciones (chatwoot_id, telefono, pidio_baja) values (900, '+5491133333333', now())");
    const previa = await d().vistaPrevia(L, BASE, { incluir_descartados: false }, [crm("1122222222", "Seguimiento")]);
    expect("totales" in previa && previa.totales).toEqual({ entra: 2, por_revisar: 1, repetido: 0, excluido: 1 });

    const r = await d().crearLote(L, "Leads 2024", BASE, { incluir_descartados: false }, null, "Mati");
    expect(r).toMatchObject({ guardados: 3, totales: { entra: 2, por_revisar: 1, excluido: 1 } });
    const lotes = await d().lotes(L);
    expect(lotes).toMatchObject([{ nombre: "Leads 2024", creado_por: "Mati", etapas: { por_contactar: 2, por_revisar: 1 } }]);

    // La misma base otra vez: ya estaban.
    expect(await d().crearLote(L, "Otra vez", BASE, { incluir_descartados: false }, null, "Mati")).toEqual({ error: "Ninguna fila entra: todas están repetidas o excluidas (mirá la vista previa)." });

    const [caro] = await d().contactos(L, { etapa: "por_revisar" });
    expect(caro).toMatchObject({ nombre: "Caro", telefono: null, motivo: "falta el código de área" });
    expect(await d().corregirTelefono(caro.id, "4567-8901")).toEqual({ error: "Ese teléfono no sirve: falta el código de área." });
    expect(await d().corregirTelefono(caro.id, "011 15 1111-1111")).toEqual({ error: "Ese teléfono ya está cargado en esta línea." });
    expect(await d().corregirTelefono(caro.id, "0221 15 444-4444")).toMatchObject({ contacto: { telefono: "5492214444444", etapa: "por_contactar" } });
    expect((await d().contactos(L, { buscar: "4444" })).map((c) => c.nombre)).toEqual(["Caro"]);
  });

  it("la cola: tomar, confirmar una sola vez, la pausa, el seguimiento y el tope", async () => {
    await d().crearLote(L, "Leads", BASE, { incluir_descartados: false }, null, "Mati");
    const lunes = ba("2026-11-16T11:00");

    // Por puntaje: Ana consultó por Lerma 439 (ficha activa) y con nombre (32); Beto, solo más reciente (14).
    const cola = await d().cola(L, lunes);
    expect(cola.map((c) => [c.nombre, c.puntaje])).toEqual([["Ana Gómez", 32], ["Beto", 14], ["Dani", 10]]);
    expect(cola[0].puntaje_detalle.find((p) => p.variable === "proyecto")).toEqual({ variable: "proyecto", valor: "con ficha activa", puntos: 20 });
    const t = await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    if (!("tarjeta" in t)) throw new Error(JSON.stringify(t));
    expect(t.tarjeta).toMatchObject({ paso: 0, contacto: { nombre: "Ana Gómez", telefono: "5491111111111" } });
    expect(t.tarjeta.texto).toMatch(/^(Hola|¡Hola!?|Buenas) Ana/);
    expect(t.tarjeta.whatsapp_web).toContain("web.whatsapp.com/send?phone=5491111111111&text=");

    // Mientras Facu la tiene, Axel espera; Facu, si recarga, recibe la misma.
    const otro = await d().tomar(L, { modo: "computer_use", por: "Axel" }, lunes);
    expect(otro).toMatchObject({ espera: { motivo: "ocupada", por: "Facu" } });
    const deNuevo = await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    expect("tarjeta" in deNuevo && deNuevo.tarjeta.clave).toBe(t.tarjeta.clave);

    // Confirmar dos veces cuenta una.
    const c1 = await d().confirmar(t.tarjeta.contacto.id, { clave: t.tarjeta.clave, modo: "computer_use", por: "Facu", ejecutor: "bot" }, lunes);
    const c2 = await d().confirmar(t.tarjeta.contacto.id, { clave: t.tarjeta.clave, modo: "computer_use", por: "Facu", ejecutor: "bot" }, lunes);
    expect(c1).toMatchObject({ ok: true, ya_estaba: false, contacto: { etapa: "saludado", mensajes: 1, proxima_accion: ba("2026-11-18T00:00").toISOString() } });
    expect(c2).toMatchObject({ ok: true, ya_estaba: true });
    expect((await pool.query("select count(*)::int as n from outreach_eventos where tipo = 'envio'")).rows[0].n).toBe(1);
    expect(await d().confirmar(t.tarjeta.contacto.id, { clave: "otra", modo: "computer_use", por: "Facu", ejecutor: "bot" }, lunes)).toEqual({
      error: "Ese envío no es el que estaba tomado. Volvé a la cola y tomalo de nuevo.",
    });

    // Pausa entre mensajes (computer use: de 45 a 90 segundos).
    expect(await d().tomar(L, { modo: "computer_use", por: "Facu" }, new Date(lunes.getTime() + 30_000))).toMatchObject({ espera: { motivo: "pausa" } });
    const mas2 = new Date(lunes.getTime() + 120_000);
    const t2 = await d().tomar(L, { modo: "computer_use", por: "Facu" }, mas2);
    if (!("tarjeta" in t2)) throw new Error(JSON.stringify(t2));
    expect(t2.tarjeta.contacto.nombre).toBe("Beto");
    expect(t2.tarjeta.texto).toContain("Beto");
    await d().confirmar(t2.tarjeta.contacto.id, { clave: t2.tarjeta.clave, modo: "computer_use", por: "Facu", ejecutor: "persona" }, mas2);

    const mas4 = new Date(lunes.getTime() + 240_000);
    const t3 = await d().tomar(L, { modo: "computer_use", por: "Facu" }, mas4);
    if (!("tarjeta" in t3)) throw new Error(JSON.stringify(t3));
    await d().confirmar(t3.tarjeta.contacto.id, { clave: t3.tarjeta.clave, modo: "computer_use", por: "Facu", ejecutor: "persona" }, mas4);

    // Tope de 3: el cuarto espera a mañana. El miércoles, el seguimiento de Beto ya toca.
    expect(await d().tomar(L, { modo: "computer_use", por: "Facu" }, new Date(lunes.getTime() + 360_000))).toMatchObject({ espera: { motivo: "tope", tope: 3 } });
    expect(await d().tomar(L, { modo: "computer_use", por: "Facu" }, ba("2026-11-17T11:00"))).toEqual({ vacia: true });
    const mie = await d().tomar(L, { modo: "computer_use", por: "Facu" }, ba("2026-11-18T11:00"));
    expect("tarjeta" in mie && mie.tarjeta).toMatchObject({ paso: 1, contacto: { nombre: "Ana Gómez" } });
    if (!("tarjeta" in mie)) return;
    await d().confirmar(mie.tarjeta.contacto.id, { clave: mie.tarjeta.clave, modo: "computer_use", por: "Facu", ejecutor: "bot" }, ba("2026-11-18T11:00"));
    // Con 2 mensajes sin respuesta (el máximo de fábrica), no hay más.
    const [ana] = await d().contactos(L, { buscar: "Ana" });
    expect(ana).toMatchObject({ mensajes: 2, proxima_accion: null });
  });

  it("fuera de horario, «Mandar igual» y el borrador", async () => {
    await d().crearLote(L, "Leads", BASE, { incluir_descartados: false }, null, "Mati");
    expect(await d().tomar(L, { modo: "computer_use", por: "Facu" }, ba("2026-11-16T14:00"))).toMatchObject({ espera: { motivo: "fuera_de_horario" } });
    await d().mandarIgualHoy(L, "Axel", ba("2026-11-16T14:00"));
    expect(await d().tomar(L, { modo: "computer_use", por: "Facu" }, ba("2026-11-16T14:00"))).toHaveProperty("tarjeta");
    await d().guardarConfig(L, F, "Axel");
    const e = await d().estado(L, ba("2026-11-17T11:00"), "Facu");
    expect(e.puede.computer_use).toMatchObject({ motivo: "borrador" });
    expect(e.en_cola).toBe(3);
  });

  it("las fallas seguidas frenan la línea hasta que alguien la revisa", async () => {
    await d().crearLote(L, "Leads", BASE, { incluir_descartados: false }, null, "Mati");
    const lunes = ba("2026-11-16T11:00");
    const t1 = await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    if (!("tarjeta" in t1)) throw new Error("sin tarjeta");
    expect(await d().fallo(t1.tarjeta.contacto.id, { clave: t1.tarjeta.clave, falla: "sin_whatsapp", modo: "computer_use", por: "Facu", ejecutor: "bot" }, lunes)).toEqual({ ok: true, frenada: false });
    const t2 = await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    if (!("tarjeta" in t2)) throw new Error("sin tarjeta");
    expect(t2.tarjeta.contacto.id).not.toBe(t1.tarjeta.contacto.id);
    expect(await d().fallo(t2.tarjeta.contacto.id, { clave: t2.tarjeta.clave, falla: "no_salio", modo: "computer_use", por: "Facu", ejecutor: "bot" }, lunes)).toEqual({ ok: true, frenada: true });
    expect(await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes)).toMatchObject({ espera: { motivo: "frenada" } });
    const [invalido] = await d().contactos(L, { etapa: "invalido" });
    expect(invalido).toMatchObject({ id: t1.tarjeta.contacto.id, tiene_whatsapp: false, motivo: "no tiene WhatsApp" });

    await d().seguir(L, "Axel");
    // El que no salió vuelve al día hábil siguiente: hoy sigue el tercero.
    const t3 = await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    expect("tarjeta" in t3 && [t1.tarjeta.contacto.id, t2.tarjeta.contacto.id].includes(t3.tarjeta.contacto.id)).toBe(false);
    const cola = await d().cola(L, ba("2026-11-17T11:00"));
    expect(cola.map((c) => c.id)).toContain(t2.tarjeta.contacto.id);
    expect(cola.map((c) => c.id)).not.toContain(t1.tarjeta.contacto.id);
  });

  it("saltar, soltar y la baja por teléfono", async () => {
    await d().crearLote(L, "Leads", BASE, { incluir_descartados: false }, null, "Mati");
    const lunes = ba("2026-11-16T11:00");
    const t = await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    if (!("tarjeta" in t)) throw new Error("sin tarjeta");
    expect(await d().saltar(t.tarjeta.contacto.id, "Facu", lunes)).toBe(true);
    const t2 = await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    expect("tarjeta" in t2 && t2.tarjeta.contacto.id).not.toBe(t.tarjeta.contacto.id);
    if (!("tarjeta" in t2)) return;
    expect(await d().soltar(t2.tarjeta.contacto.id, "Axel")).toBe(false);
    expect(await d().soltar(t2.tarjeta.contacto.id, "Facu")).toBe(true);

    await d().baja("+54 9 11 1111-1111", { linea: "linea-3", origen: "pidió por WhatsApp" });
    const cola = await d().cola(L, ba("2026-11-17T11:00"));
    expect(cola.map((c) => c.nombre).sort()).toEqual(["Beto", "Dani"]);
    expect((await d().contactos(L, { etapa: "baja" })).map((c) => c.nombre)).toEqual(["Ana Gómez"]);
  });

  it("una parte sale al azar, queda marcada y cuenta en los aprendizajes", async () => {
    await d().crearLote(L, "Leads", BASE, { incluir_descartados: false }, null, "Mati");
    const lunes = ba("2026-11-16T11:00");
    const conAzar = datosOutreach(pool, { azar: () => 0 });
    const t = await conAzar.tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    if (!("tarjeta" in t)) throw new Error("sin tarjeta");
    await conAzar.confirmar(t.tarjeta.contacto.id, { clave: t.tarjeta.clave, modo: "computer_use", por: "Facu", ejecutor: "bot" }, lunes);
    expect((await pool.query("select al_azar from outreach_eventos where tipo = 'envio'")).rows).toEqual([{ al_azar: true }]);
    await pool.query("update outreach_contactos set respondio = now() where id = $1", [t.tarjeta.contacto.id]);
    const a = await d().aprendizajes(L);
    expect(a.contactados).toBe(1);
    expect(a.al_azar.length).toBeGreaterThan(0);
    expect(a.todos.find((x) => x.variable === "antiguedad")).toMatchObject({ contactados: 1, respondieron: 1, tasa: 1, muestra_chica: true });
    expect(a.por_puntaje.reduce((n, f) => n + f.contactados, 0)).toBe(1);
  });

  it("cambiar los pesos recalcula los puntajes", async () => {
    await d().crearLote(L, "Leads", BASE, { incluir_descartados: false }, null, "Mati");
    const cfg = await d().config(L);
    await d().guardarConfig(L, { ...cfg, puntaje: { ...cfg.puntaje, proyecto: { activo: 0, apagado: 0 } } }, "Axel");
    expect((await d().cola(L, ba("2026-11-16T11:00"))).map((c) => [c.nombre, c.puntaje])).toEqual([["Beto", 14], ["Ana Gómez", 12], ["Dani", 10]]);
  });

  it("las respuestas de la línea 1: confirmar solo, automáticas, una de verdad (CRM y equipo), sin repetir, y la baja", async () => {
    await d().crearLote(L, "Leads 2024", BASE, { incluir_descartados: false }, null, "Mati");
    const lunes = ba("2026-11-16T11:00");
    const hechos: string[] = [];
    const creados: unknown[] = [];
    const chatwoot = {
      enviar: async (c: number, t: string) => (hechos.push(`enviar ${c}: ${t}`), 1),
      notaInterna: async (c: number, t: string) => void hechos.push(`nota ${c}: ${t}`),
      pasarAPersona: async (c: number) => void hechos.push(`abierta ${c}`),
    };
    const crm = {
      buscar: async () => null,
      crearContacto: async (datos: unknown, _: string, etapa?: string) => (creados.push({ datos, etapa }), { id: "crm-ana", responsable: "Tade" }),
      anotarActividad: async () => {},
    };
    const avisos: unknown[] = [];
    const s = {
      outreach: d(),
      almacen: crearAlmacen(pool),
      chatwoot: chatwoot as never,
      crm: crm as never,
      avisarAlEquipo: async (a: unknown) => void avisos.push(a),
      ahora: () => lunes,
    };
    const linea = { id: L, nombre: "Outreach frío", tipo: "outreach_frio" } as Linea;
    const responder = { tipo: "responder" } as never;
    const ana = { nombre: "Ana", telefono: "5491111111111" };

    // Sale el saludo desde WhatsApp Web: llega como mensaje del equipo y se confirma solo.
    const t = await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    if (!("tarjeta" in t)) throw new Error("sin tarjeta");
    const sale = await mensajeDeOutreach(s, linea, { id: 10, conversacion: 50, rol: "persona", texto: t.tarjeta.texto, fecha: lunes.toISOString() }, ana, responder);
    expect(sale).toEqual({ fin: true, json: { accion: "ignorar", motivo: "salió el mensaje del outreach: quedó confirmado" } });
    expect((await d().contactos(L, { buscar: "Ana" }))[0]).toMatchObject({ etapa: "saludado", mensajes: 1 });

    // Una respuesta automática: se anota y nada más.
    const auto = await mensajeDeOutreach(s, linea, { id: 11, conversacion: 50, rol: "interesado", texto: "Gracias por comunicarte con nosotros", fecha: lunes.toISOString() }, ana, responder);
    expect(auto).toMatchObject({ fin: true, json: { motivo: "respuesta automática" } });
    expect((await d().contactos(L, { buscar: "Ana" }))[0]).toMatchObject({ etapa: "saludado", respondio: null });

    // Una de verdad: corta la secuencia, entra al CRM con la etiqueta de la base y pasa al equipo.
    const real = await mensajeDeOutreach(s, linea, { id: 12, conversacion: 50, rol: "interesado", texto: "Hola! sí, sigo buscando", fecha: lunes.toISOString() }, ana, responder);
    if (!real.fin) throw new Error("debía terminar");
    expect(real.json).toEqual({ accion: "pasar_a_persona", motivo: "respondió al outreach", contacto: t.tarjeta.contacto.id });
    await real.tarea?.();
    expect((await d().contactos(L, { buscar: "Ana" }))[0]).toMatchObject({ etapa: "respondio", proxima_accion: null });
    expect(creados).toMatchObject([{ etapa: "Contacto inicial", datos: { telefono: "5491111111111", proyecto: "lerma-439", tags: ["Outreach: Leads 2024"] } }]);
    expect(hechos).toEqual([expect.stringContaining("nota 50: 🙋 Respondió al outreach (base «Leads 2024», había consultado por Lerma)"), "abierta 50"]);
    expect(avisos).toMatchObject([{ conversacion: 50, motivo: "Respondió al outreach", responsable: "Tade", contacto: "crm-ana" }]);
    expect(await d().respuestas(L)).toMatchObject([{ nombre: "Ana Gómez", ultimo_mensaje: null, conversacion: 50 }]);

    // Chatwoot reintenta el mismo aviso: no se anota de nuevo; otro mensaje no vuelve a dar de alta ni a avisar.
    await mensajeDeOutreach(s, linea, { id: 12, conversacion: 50, rol: "interesado", texto: "Hola! sí, sigo buscando", fecha: lunes.toISOString() }, ana, responder);
    const otro = await mensajeDeOutreach(s, linea, { id: 13, conversacion: 50, rol: "interesado", texto: "¿Qué precio tiene?", fecha: lunes.toISOString() }, ana, responder);
    if (otro.fin) await otro.tarea?.();
    expect(creados).toHaveLength(1);
    expect(avisos).toHaveLength(1);
    expect((await pool.query("select count(*)::int as n from outreach_eventos where tipo = 'respuesta'")).rows[0].n).toBe(3);

    // La baja de otro de la base: corta todo y se le contesta una vez.
    hechos.length = 0;
    const beto = { nombre: "Beto", telefono: "5491122222222" };
    const baja = await mensajeDeOutreach(s, linea, { id: 20, conversacion: 60, rol: "interesado", texto: "No me escriban más", fecha: lunes.toISOString() }, beto, responder);
    if (!baja.fin) throw new Error("debía terminar");
    await baja.tarea?.();
    expect(hechos[0]).toBe(`enviar 60: ${RESPUESTA_BAJA}`);
    expect((await d().contactos(L, { buscar: "Beto" }))[0]).toMatchObject({ etapa: "baja" });
    expect((await pool.query("select telefono from bajas")).rows).toEqual([{ telefono: "5491122222222" }]);

    // Alguien que no está en la base: sigue el webhook (pasa al equipo, como antes).
    const nuevo = await mensajeDeOutreach(s, linea, { id: 30, conversacion: 70, rol: "interesado", texto: "Hola", fecha: lunes.toISOString() }, { nombre: "X", telefono: "5491199999999" }, responder);
    expect(nuevo).toEqual({ fin: false, linea: { ...linea, tipo: "outreach_frio" } });

    // Con «al responder: IA», una respuesta de verdad sigue como una línea de leads.
    const cfg = await d().config(L);
    await d().guardarConfig(L, { ...cfg, al_responder: "ia" }, "Axel");
    const dani = await mensajeDeOutreach(s, linea, { id: 40, conversacion: 80, rol: "interesado", texto: "Sí, contame", fecha: lunes.toISOString() }, { nombre: "Dani", telefono: "5491133333333" }, responder);
    expect(dani).toEqual({ fin: false, linea: { ...linea, tipo: "entrada" } });
  });

  it("WAHA nativo: manda y confirma, salta los que no tienen WhatsApp sin frenar, y frena si la sesión se cae", async () => {
    await d().crearLote(L, "Leads", BASE, { incluir_descartados: false }, null, "Mati");
    const lunes = ba("2026-11-16T11:00");
    const enviados: [string, string, string][] = [];
    let estado = "WORKING";
    let falla = false;
    const sinWhatsApp = new Set(["5491122222222"]);
    const waha = {
      estado: async () => estado,
      existe: async (_: string, t: string) => ({ existe: !sinWhatsApp.has(t), chatId: `${t}@c.us` }),
      enviarTexto: async (sesion: string, chatId: string, texto: string) => {
        if (falla) throw new Error("WAHA respondió 500");
        enviados.push([sesion, chatId, texto]);
      },
    };
    const o = { por: "Facu", ejecutor: "persona" as const };

    const r1 = await d().enviarPorWaha(L, waha, o, lunes);
    expect(r1).toMatchObject({ enviado: { contacto: { nombre: "Ana Gómez" } } });
    expect(enviados).toEqual([["linea1", "5491111111111@c.us", expect.stringMatching(/Ana/)]]);
    expect((await pool.query("select modo, ejecutor from outreach_eventos where tipo = 'envio'")).rows).toEqual([{ modo: "waha", ejecutor: "persona" }]);

    // Pausa de WAHA: de 3 a 6 minutos.
    expect(await d().enviarPorWaha(L, waha, o, new Date(lunes.getTime() + 120_000))).toMatchObject({ espera: { motivo: "pausa" } });

    // Beto no tiene WhatsApp: queda inválido y no cuenta como falla.
    const mas7 = new Date(lunes.getTime() + 7 * 60_000);
    expect(await d().enviarPorWaha(L, waha, o, mas7)).toMatchObject({ sin_whatsapp: { nombre: "Beto", etapa: "invalido" } });
    expect((await d().estado(L, mas7, "Facu")).fallas_seguidas).toBe(0);

    // Si no sale, cuenta como falla; si la sesión se cae, frena la línea.
    falla = true;
    expect(await d().enviarPorWaha(L, waha, o, mas7)).toMatchObject({ no_salio: { nombre: "Dani" }, error: "WAHA respondió 500", frenada: false });
    falla = false;
    estado = "SCAN_QR_CODE";
    await d().seguir(L, "Axel");
    expect(await d().enviarPorWaha(L, waha, o, ba("2026-11-17T11:00"))).toMatchObject({ espera: { motivo: "frenada", detalle: "la sesión de WhatsApp «linea1» no está conectada (SCAN_QR_CODE)" } });
    expect((await d().cola(L, ba("2026-11-17T11:00"))).map((c) => c.nombre)).toEqual(["Dani"]);
  });

  it("WAHA: verificar números y mandarme una prueba", async () => {
    await d().crearLote(L, "Leads", BASE, { incluir_descartados: false }, null, "Mati");
    const enviados: string[] = [];
    const waha = {
      estado: async () => "WORKING",
      existe: async (_: string, t: string) => ({ existe: t !== "5491122222222", chatId: null }),
      enviarTexto: async (_: string, chatId: string, texto: string) => void enviados.push(`${chatId}: ${texto}`),
    };
    expect(await d().verificarNumeros(L, waha, { por: "Facu", pausaMs: 0 }, ba("2026-11-16T11:00"))).toEqual({ verificados: 3, con_whatsapp: 2, sin_whatsapp: 1 });
    const [ana] = await d().contactos(L, { buscar: "Ana" });
    expect(ana).toMatchObject({ tiene_whatsapp: true, puntaje: 40 });
    expect(await d().verificarNumeros(L, waha, { por: "Facu", pausaMs: 0 }, ba("2026-11-16T11:00"))).toEqual({ verificados: 0, con_whatsapp: 0, sin_whatsapp: 0 });
    expect(enviados).toEqual([]);

    expect(await d().prueba(L, waha, "4567")).toEqual({ error: "Ese teléfono no sirve: el número es muy corto." });
    expect(await d().prueba(L, waha, "011 15 9999-0000")).toMatchObject({ ok: true });
    expect(enviados).toEqual([expect.stringMatching(/^5491199990000@c\.us: 🧪 Prueba del outreach:\n\n(Hola|¡Hola!) Prueba/)]);
  });

  it("los resultados: embudo con el CRM de hoy, por base y por versión", async () => {
    await d().crearLote(L, "Leads 2024", BASE, { incluir_descartados: false }, null, "Mati");
    const lunes = ba("2026-11-16T11:00");
    const t = await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    if (!("tarjeta" in t)) throw new Error("sin tarjeta");
    await d().confirmar(t.tarjeta.contacto.id, { clave: t.tarjeta.clave, modo: "computer_use", por: "Facu", ejecutor: "bot" }, lunes);
    await d().anotarRespuesta(t.tarjeta.contacto.id, { clasificacion: "respuesta", conversacion: 50, mensaje: 1 }, ba("2026-11-17T10:00"));
    await d().anotarCRM(t.tarjeta.contacto.id, "crm-ana");
    const crm = [{ id: "crm-ana", telefono: "1111111111", etapa: "Visita / reunión" }] as ContactoCRM[];
    const r = await d().resultados(L, { dias: null }, crm, ba("2026-11-17T12:00"));
    expect(r.embudo.pasos.map((p) => [p.paso, p.cantidad])).toEqual([
      ["cargados", 3],
      ["con_whatsapp", 1],
      ["contactados", 1],
      ["respondieron", 1],
      ["interesados", 1],
      ["visita", 1],
      ["reserva", 0],
    ]);
    expect(r.por_base).toEqual([{ clave: "Leads 2024", contactados: 1, respondieron: 1, tasa: 1, muestra_chica: true }]);
    expect(r.por_version).toHaveLength(1);
    expect(r.por_dia).toEqual([{ dia: "2026-11-16", tipo: "envio", modo: "computer_use", ejecutor: "bot", n: 1 }]);
  });

  it("el tope sube después de una semana sin frenos", async () => {
    await pool.query("insert into outreach_estado (linea, tope, tope_desde) values ($1, 3, '2026-11-09')", [L]);
    const e = await d().estado(L, ba("2026-11-16T11:00"), "Facu");
    expect(e.tope).toBe(8);
    expect((await pool.query("select detalle from outreach_eventos where tipo = 'tope'")).rows).toEqual([{ detalle: "El tope sube a 8 por día." }]);
  });

  it("borrar un lote borra sus contactos y deja los envíos sin datos personales", async () => {
    const r = await d().crearLote(L, "Leads", BASE, { incluir_descartados: false }, null, "Mati");
    if (!("lote" in r)) throw new Error(r.error);
    const lunes = ba("2026-11-16T11:00");
    const t = await d().tomar(L, { modo: "computer_use", por: "Facu" }, lunes);
    if (!("tarjeta" in t)) throw new Error("sin tarjeta");
    await d().confirmar(t.tarjeta.contacto.id, { clave: t.tarjeta.clave, modo: "computer_use", por: "Facu", ejecutor: "bot" }, lunes);
    expect(await d().borrarLote(r.lote)).toBe(true);
    expect(await d().contactos(L, {})).toEqual([]);
    expect((await pool.query("select contacto, lote, tipo from outreach_eventos")).rows).toEqual([{ contacto: null, lote: String(r.lote), tipo: "envio" }]);
  });
});
