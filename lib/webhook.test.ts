import { describe, expect, it } from "vitest";
import { lerma, respuesta, tono } from "../test/fixtures";
import type { Chatwoot } from "./chatwoot/api";
import { firmar } from "./chatwoot/firma";
import { almacenEnMemoria } from "./datos/memoria";
import type { Modelo } from "./agente/agente";
import { manejarWebhook } from "./webhook";

const AHORA = Date.parse("2026-11-07T21:05:00Z");
const CLAVE = "clave-del-bot";

function armar({ modelo = (async () => respuesta([{ type: "text", text: "¡Hola! ¿En qué te ayudo?" }])) as Modelo | null } = {}) {
  const datos = almacenEnMemoria({ proyectos: [lerma()], tono });
  const hechos: string[] = [];
  const chatwoot: Chatwoot = {
    async enviar(c, t) {
      hechos.push(`enviar ${c}: ${t}`);
      return 1;
    },
    async notaInterna(c, t) {
      hechos.push(`nota ${c}: ${t}`);
    },
    async pasarAPersona(c) {
      hechos.push(`abrir ${c}`);
    },
  };
  const llamar = (evento: unknown, { clave = CLAVE, firmaCon = CLAVE } = {}) => {
    const cuerpo = JSON.stringify(evento);
    return manejarWebhook(cuerpo, firmar(cuerpo, firmaCon, AHORA / 1000), {
      clave,
      conexiones: { almacen: datos.almacen, chatwoot, modelo, crm: null },
      opciones: { dormir: async () => {}, ahora: () => new Date(AHORA) },
      ahoraMs: AHORA,
    });
  };
  return { datos, hechos, llamar };
}

const evento = (cambios: Record<string, unknown> = {}) => ({
  event: "message_created",
  id: 21,
  content: "Hola, quiero info de Lerma",
  message_type: "incoming",
  private: false,
  created_at: "2026-11-07T21:04:50.000Z",
  sender: null,
  conversation: { id: 2, status: "pending", meta: { sender: { name: "Ana Prueba", phone_number: "+5491155550000", identifier: null } } },
  inbox: { id: 1, name: "WhatsApp Lerma 439" },
  ...cambios,
});

describe("webhook del Agent Bot", () => {
  it("rechaza avisos sin firma válida, sin clave configurada o que no son JSON", async () => {
    const a = armar();
    expect((await a.llamar(evento(), { firmaCon: "otra" })).status).toBe(401);
    expect((await a.llamar(evento(), { clave: "" })).status).toBe(503);
    const r = await manejarWebhook("no es json", firmar("no es json", CLAVE, AHORA / 1000), { clave: CLAVE, conexiones: { almacen: null, chatwoot: null, modelo: null, crm: null }, ahoraMs: AHORA });
    expect(r.status).toBe(400);
  });

  it("guarda el mensaje, responde enseguida y contesta en la tarea de después", async () => {
    const a = armar();
    const r = await a.llamar(evento());
    expect(r).toMatchObject({ status: 200, json: { accion: "responder" } });
    expect(a.datos.mensajes.get(21)).toMatchObject({ rol: "interesado", texto: "Hola, quiero info de Lerma" });
    expect(a.hechos).toEqual([]);
    expect(await r.tarea!()).toBe("respondió");
    expect(a.hechos).toEqual(["enviar 2: ¡Hola! ¿En qué te ayudo?"]);
  });

  it("si escribe alguien del equipo, la conversación pasa a abierta", async () => {
    const a = armar();
    const r = await a.llamar(evento({ id: 22, message_type: "outgoing", sender: { id: 2, type: "user", name: "Mati" }, content: "Hola Ana, soy Mati" }));
    expect(r.json).toEqual({ accion: "la_tomo_una_persona" });
    await r.tarea!();
    expect(a.hechos).toEqual(["abrir 2"]);
    expect(a.datos.mensajes.get(22)?.rol).toBe("persona");
  });

  it("el eco de un mensaje del bot no cuenta como que lo tomó una persona", async () => {
    const a = armar();
    await a.llamar(evento({ id: 23, message_type: "outgoing", sender: { type: "agent_bot" }, content: "¡Hola! ¿En qué te ayudo?", created_at: "2026-11-07T21:04:55.000Z" }));
    const r = await a.llamar(evento({ id: 24, message_type: "outgoing", sender: { type: "user" }, content: "¡Hola! ¿En qué te ayudo?" }));
    expect(r.json).toEqual({ accion: "ignorar", motivo: "es el eco de un mensaje del bot" });
    expect(a.datos.mensajes.has(24)).toBe(false);
  });

  it("sin Claude configurado, pasa la conversación al equipo con una nota", async () => {
    const a = armar({ modelo: null });
    const r = await a.llamar(evento());
    await r.tarea!();
    expect(a.hechos).toEqual(["nota 2: 🙋 El asistente todavía no está configurado (falta ANTHROPIC_API_KEY en Vercel): atiende el equipo.", "abrir 2"]);
  });

  it("ignora la conversación de avisos de WAHA y no la guarda", async () => {
    const a = armar();
    const r = await a.llamar(evento({ conversation: { id: 1, status: "pending", meta: { sender: { identifier: "whatsapp.integration" } } } }));
    expect(r.json).toEqual({ accion: "ignorar", motivo: "es la conversación de avisos de WAHA" });
    expect(a.datos.mensajes.size).toBe(0);
  });

  it("corta los seguimientos cuando el equipo toma o cierra la conversación, y los vuelve a permitir si vuelve al bot", async () => {
    const a = armar();
    await a.llamar(evento());
    expect(a.datos.seguimientos.get(2)?.permitido).toBe(true);
    await a.llamar({ event: "conversation_resolved", id: 2, status: "resolved" });
    expect(a.datos.seguimientos.get(2)?.permitido).toBe(false);
    await a.llamar({ event: "conversation_status_changed", id: 2, status: "pending" });
    expect(a.datos.seguimientos.get(2)?.permitido).toBe(true);
    const r = await a.llamar(evento({ id: 22, message_type: "outgoing", sender: { id: 5, type: "user", name: "Vendedora" }, content: "Hola Ana, soy del equipo" }));
    await r.tarea?.();
    expect(a.datos.seguimientos.get(2)?.permitido).toBe(false);
  });
});

