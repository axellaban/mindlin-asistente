import { describe, expect, it } from "vitest";
import { avisoAlHubDesdeEnv, type AvisoAlEquipo } from "./aviso";

const aviso: AvisoAlEquipo = { conversacion: 7, nombre: "Ana Prueba", telefono: "5491155550000", motivo: "Pidió una visita.", resumen: "Busca 2 ambientes.", responsable: "Tadeo", contacto: "c1", proyecto: "lerma-439", linea: "Leads entrantes" };

describe("aviso al hub cuando pasa al equipo", () => {
  it("sin HUB_URL (o sin la clave), no avisa", () => {
    expect(avisoAlHubDesdeEnv({ HUB_CLAVE: "x" })).toBeNull();
    expect(avisoAlHubDesdeEnv({ HUB_URL: "https://hub.ejemplo.test" })).toBeNull();
    expect(avisoAlHubDesdeEnv({ HUB_URL: "hub.ejemplo.test", HUB_CLAVE: "x" })).toBeNull();
  });

  it("le manda al hub quién es, el motivo, el responsable y el link a Chatwoot, con la clave", async () => {
    const pedidos: { url: string; init: RequestInit }[] = [];
    const avisar = avisoAlHubDesdeEnv({ HUB_URL: "https://hub.ejemplo.test/", HUB_CLAVE: "clave", CHATWOOT_URL: "https://chat.ejemplo.test", CHATWOOT_ACCOUNT_ID: "1" }, (async (url: string, init: RequestInit) => {
      pedidos.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as typeof fetch)!;
    await avisar(aviso);
    expect(pedidos[0].url).toBe("https://hub.ejemplo.test/api/asistente/aviso");
    expect(new Headers(pedidos[0].init.headers).get("authorization")).toBe("Bearer clave");
    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({ ...aviso, enlace: "https://chat.ejemplo.test/app/accounts/1/conversations/7" });
  });

  it("si el hub contesta con error, falla con el motivo (quien llama lo anota)", async () => {
    const avisar = avisoAlHubDesdeEnv({ HUB_URL: "https://hub.ejemplo.test", HUB_CLAVE: "clave" }, (async () => new Response(JSON.stringify({ error: "Clave incorrecta." }), { status: 401 })) as typeof fetch)!;
    await expect(avisar(aviso)).rejects.toThrow("el hub respondió 401: Clave incorrecta.");
  });
});
