import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { chequearConexiones, type DependenciasChequeo } from "./chequeo";
import { COLUMNAS_ACTIVIDAD, COLUMNAS_CONTACTOS, type Hoja } from "./crm/planilla";
import type { Modelo } from "./agente/agente";

const CW = { url: "https://chat.ejemplo.test", cuenta: "1", token: "token-de-prueba" };

/** Un Chatwoot simulado: la versión en /api y lo que contesta al probar el token. */
function chatwootFalso(token: { status: number; cuerpo: string } = { status: 404, cuerpo: '{"error":"Couldn\'t find Conversation"}' }) {
  const pedidos: { url: string; metodo: string; autorizacion: string | null }[] = [];
  const pedir = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    pedidos.push({ url: u, metodo: init?.method ?? "GET", autorizacion: new Headers(init?.headers).get("authorization") });
    if (u.endsWith("/api")) return new Response(JSON.stringify({ version: "4.19.1", queue_services: "ok", data_services: "ok" }), { status: 200 });
    return new Response(token.cuerpo, { status: token.status });
  }) as typeof fetch;
  return { pedir, pedidos };
}

const hojaFalsa = (contactos: string[] = [...COLUMNAS_CONTACTOS], actividad: string[] = [...COLUMNAS_ACTIVIDAD]): Hoja => ({
  async leer(rango) {
    return rango.includes("CRM Contactos") ? [contactos] : [actividad];
  },
  async actualizar() {
    throw new Error("el chequeo no escribe");
  },
  async agregar() {
    throw new Error("el chequeo no escribe");
  },
});

const respuestaIA = (texto: string) => ({ content: texto ? [{ type: "text", text: texto }] : [], stop_reason: "end_turn" }) as unknown as Anthropic.Beta.BetaMessage;
const modeloQueResponde: Modelo = async () => respuestaIA("ok");

function datosFalsos(cambios: { pausado?: boolean; mensaje?: boolean; respuesta?: string | null; error?: string | null; reglas?: number } = {}): DependenciasChequeo["datos"] {
  const { pausado = false, mensaje = true, respuesta = "2026-11-13T18:00:05.000Z", error = null, reglas = 1 } = cambios;
  return {
    async estado() {
      return { pausado, cambiado: pausado ? "2026-11-13T12:00:00.000Z" : null, cambiado_por: pausado ? "Tadeo" : null };
    },
    async reglas() {
      return Array.from({ length: reglas }, (_, i) => ({ id: i + 1, etapa: "Nuevo", paso: 1, dias_sin_respuesta: 1, version: 1, estado: "activa" as const, proyecto: null, mensaje: "Hola", enviados: 0, respondieron: 0 }));
    },
    async ultimaActividad() {
      return {
        ultimo_mensaje: mensaje ? { fecha: "2026-11-13T18:00:00.000Z", conversacion: 3 } : null,
        ultima_respuesta: respuesta ? { fecha: respuesta, conversacion: 3, tipo: "respuesta" as const, detalle: "¡Hola!" } : null,
        ultimo_error: error ? { fecha: error, conversacion: 3, tipo: "error" as const, detalle: "Chatwoot respondió 401 en /3/messages" } : null,
      };
    },
  };
}

function deps(cambios: Partial<DependenciasChequeo> = {}): DependenciasChequeo {
  return {
    chatwoot: CW,
    datos: datosFalsos(),
    hoja: hojaFalsa(),
    modelo: modeloQueResponde,
    ia: { proveedor: "anthropic", modelo: "claude-opus-5-5" },
    cron: true,
    pedir: chatwootFalso().pedir,
    ahora: () => new Date("2026-11-13T18:30:00Z"),
    ...cambios,
  };
}

const estados = (c: Awaited<ReturnType<typeof chequearConexiones>>) => Object.fromEntries(c.pruebas.map((p) => [p.que, p.estado]));
const detalle = (c: Awaited<ReturnType<typeof chequearConexiones>>, que: string) => c.pruebas.find((p) => p.que === que)?.detalle ?? "";

describe("chequeo de conexiones", () => {
  it("con todo andando: cada pieza en verde, y no cambia nada en Chatwoot", async () => {
    const cw = chatwootFalso();
    const c = await chequearConexiones(deps({ pedir: cw.pedir }));
    expect(c.ok).toBe(true);
    expect(estados(c)).toEqual({
      Chatwoot: "ok",
      "Base de datos": "ok",
      "Mensajes de WhatsApp": "ok",
      "Respuestas del asistente": "ok",
      Seguimientos: "ok",
      "CRM (planilla)": "ok",
      IA: "ok",
    });
    expect(detalle(c, "Chatwoot")).toBe("Chatwoot 4.19.1 en https://chat.ejemplo.test responde y acepta el token del Agent Bot (cuenta 1).");
    expect(detalle(c, "Mensajes de WhatsApp")).toContain("el último llegó el 13/11, 15:00 (conversación 3)");
    expect(detalle(c, "Seguimientos")).toBe("Corren una vez por día, a las 10, con 1 regla en uso.");
    expect(detalle(c, "IA")).toMatch(/^Responde Claude \(claude-opus-5-5\), en \d+,\d segundos\.$/);
    // El token se prueba contra una conversación que no existe (la 0), con Bearer.
    expect(cw.pedidos.at(-1)).toEqual({ url: "https://chat.ejemplo.test/api/v1/accounts/1/conversations/0/toggle_status", metodo: "POST", autorizacion: "Bearer token-de-prueba" });
  });

  it("Chatwoot 4.19.1: el 404 sin detalle («Resource could not be found») quiere decir que el token anda", async () => {
    // Así contesta el Chatwoot de Easypanel (13/11): antes el chequeo lo marcaba como «Revisar».
    const c = await chequearConexiones(deps({ pedir: chatwootFalso({ status: 404, cuerpo: '{"error":"Resource could not be found"}' }).pedir }));
    expect(estados(c).Chatwoot).toBe("ok");
    expect(detalle(c, "Chatwoot")).toContain("acepta el token del Agent Bot (cuenta 1)");
    // Una respuesta que no se entiende sigue siendo «Revisar».
    expect(estados(await chequearConexiones(deps({ pedir: chatwootFalso({ status: 500, cuerpo: "Internal Server Error" }).pedir }))).Chatwoot).toBe("aviso");
  });

  it("Chatwoot: el token del Chatwoot anterior, la cuenta equivocada, el bot sin bandeja o el servidor caído", async () => {
    const token = await chequearConexiones(deps({ pedir: chatwootFalso({ status: 401, cuerpo: '{"error":"Invalid Access Token"}' }).pedir }));
    expect(token.ok).toBe(false);
    expect(detalle(token, "Chatwoot")).toContain("no acepta el token del Agent Bot (CHATWOOT_BOT_TOKEN)");

    const cuenta = await chequearConexiones(deps({ pedir: chatwootFalso({ status: 404, cuerpo: "{\"error\":\"Couldn't find Account with 'id'=3\"}" }).pedir }));
    expect(detalle(cuenta, "Chatwoot")).toContain("no tiene la cuenta 1: revisá CHATWOOT_ACCOUNT_ID");

    const sinBandeja = await chequearConexiones(deps({ pedir: chatwootFalso({ status: 401, cuerpo: '{"error":"Bot is not authorized to access this account"}' }).pedir }));
    expect(detalle(sinBandeja, "Chatwoot")).toContain("no está asignado a ninguna bandeja");

    const caido = await chequearConexiones(
      deps({
        pedir: (async () => {
          throw new Error("getaddrinfo ENOTFOUND");
        }) as typeof fetch,
      }),
    );
    expect(estados(caido).Chatwoot).toBe("falla");
    expect(detalle(caido, "Chatwoot")).toContain("No se llega a https://chat.ejemplo.test: getaddrinfo ENOTFOUND");

    expect(estados(await chequearConexiones(deps({ chatwoot: null }))).Chatwoot).toBe("falla");
  });

  it("avisa lo que hace que no conteste: pausado, sin mensajes o un error después de la última respuesta", async () => {
    const pausado = await chequearConexiones(deps({ datos: datosFalsos({ pausado: true }) }));
    expect(pausado.ok).toBe(true); // un aviso no es una falla
    expect(estados(pausado)["Base de datos"]).toBe("aviso");
    expect(detalle(pausado, "Base de datos")).toContain("está pausado (lo pausó Tadeo, el 13/11, 09:00)");

    const nada = await chequearConexiones(deps({ datos: datosFalsos({ mensaje: false, respuesta: null, reglas: 0 }), cron: true }));
    expect(estados(nada)).toMatchObject({ "Mensajes de WhatsApp": "aviso", "Respuestas del asistente": "aviso", Seguimientos: "aviso" });
    expect(detalle(nada, "Respuestas del asistente")).toContain("«Pendiente» en Chatwoot");

    const conError = await chequearConexiones(deps({ datos: datosFalsos({ error: "2026-11-13T18:10:00.000Z" }) }));
    expect(detalle(conError, "Respuestas del asistente")).toBe(
      "La última salió el 13/11, 15:00, pero después hubo un error el 13/11, 15:10 (conversación 3): Chatwoot respondió 401 en /3/messages",
    );
    expect(estados(await chequearConexiones(deps({ datos: null })))["Base de datos"]).toBe("falla");
    expect(detalle(await chequearConexiones(deps({ cron: false })), "Seguimientos")).toContain("Falta CRON_SECRET");
  });

  it("CRM: avisa si no está conectado y falla si cambiaron las columnas", async () => {
    expect(estados(await chequearConexiones(deps({ hoja: null })))["CRM (planilla)"]).toBe("aviso");
    const columnas: string[] = [...COLUMNAS_CONTACTOS];
    columnas[4] = "Correo";
    const cambiada = await chequearConexiones(deps({ hoja: hojaFalsa(columnas) }));
    expect(cambiada.ok).toBe(false);
    expect(detalle(cambiada, "CRM (planilla)")).toContain("En «CRM Contactos», la columna E dice «Correo» y tendría que decir «Mail».");
    expect(detalle(await chequearConexiones(deps({ hoja: hojaFalsa(undefined, []) })), "CRM (planilla)")).toContain("La pestaña «CRM Actividad» no existe o está vacía.");
    const sinPermiso: Hoja = {
      ...hojaFalsa(),
      async leer() {
        throw new Error("The caller does not have permission");
      },
    };
    expect(detalle(await chequearConexiones(deps({ hoja: sinPermiso })), "CRM (planilla)")).toContain("compartida con la cuenta de servicio");
  });

  it("IA: sin clave o con un error, falla con el motivo", async () => {
    expect(detalle(await chequearConexiones(deps({ modelo: null })), "IA")).toContain("Falta la clave de la IA");
    const conError: Modelo = async () => {
      throw new Error("401 invalid x-api-key");
    };
    const c = await chequearConexiones(deps({ modelo: conError, ia: { proveedor: "openai", modelo: "gpt-6.1-sol" } }));
    expect(detalle(c, "IA")).toBe("OpenAI (gpt-6.1-sol) no respondió: 401 invalid x-api-key");
    expect(estados(await chequearConexiones(deps({ modelo: async () => respuestaIA("") }))).IA).toBe("aviso");
  });
});
