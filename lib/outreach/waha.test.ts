import { describe, expect, it } from "vitest";
import { wahaDesdeEnv } from "./waha";

describe("WAHA directo", () => {
  it("sin la dirección o la clave, no hay WAHA", () => {
    expect(wahaDesdeEnv({})).toBeNull();
    expect(wahaDesdeEnv({ WAHA_URL: "waha.ejemplo.com", WAHA_API_KEY: "x" })).toBeNull();
    expect(wahaDesdeEnv({ WAHA_URL: "https://waha.ejemplo.com", WAHA_API_KEY: "" })).toBeNull();
  });

  it("arma los pedidos con la clave y lee las respuestas", async () => {
    const pedidos: [string, RequestInit | undefined][] = [];
    const respuestas: Record<string, unknown> = {
      "/api/sessions/linea1": { name: "linea1", status: "WORKING" },
      "/api/contacts/check-exists?phone=5491111111111&session=linea1": { numberExists: true, chatId: "5491111111111@c.us" },
      "/api/sendText": { id: "x" },
    };
    const pedir = (async (url: string, init?: RequestInit) => {
      pedidos.push([url, init]);
      const ruta = url.replace("https://waha.ejemplo.com", "");
      return new Response(JSON.stringify(respuestas[ruta] ?? { message: "no existe" }), { status: respuestas[ruta] ? 200 : 404 });
    }) as typeof fetch;
    const w = wahaDesdeEnv({ WAHA_URL: "https://waha.ejemplo.com/", WAHA_API_KEY: "clave-de-prueba" }, pedir)!;
    expect(await w.estado("linea1")).toBe("WORKING");
    expect(await w.existe("linea1", "5491111111111")).toEqual({ existe: true, chatId: "5491111111111@c.us" });
    await w.enviarTexto("linea1", "5491111111111@c.us", "Hola");
    expect((pedidos[0][1]?.headers as Record<string, string>)["X-Api-Key"]).toBe("clave-de-prueba");
    expect(JSON.parse(String(pedidos[2][1]?.body))).toEqual({ session: "linea1", chatId: "5491111111111@c.us", text: "Hola" });
    await expect(w.estado("otra")).rejects.toThrow("WAHA respondió 404: no existe");
  });
});
