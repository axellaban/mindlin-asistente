import { describe, expect, it } from "vitest";
import { configChatwoot, crearChatwoot, ErrorChatwoot } from "./api";

function chatwootFalso(status = 200) {
  const pedidos: { url: string; autorizacion: string | null; cuerpo: unknown }[] = [];
  const pedir = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, autorizacion: new Headers(init.headers).get("Authorization"), cuerpo: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ id: 99 }), { status });
  }) as typeof fetch;
  return { pedidos, pedir };
}

describe("cliente de Chatwoot", () => {
  const cfg = { url: "https://chat.ejemplo.com", cuenta: "2", token: "token-del-bot" };

  it("contesta, deja notas internas y pasa a una persona con el token del bot", async () => {
    const f = chatwootFalso();
    const cw = crearChatwoot(cfg, f.pedir);
    expect(await cw.enviar(7, "Hola")).toBe(99);
    await cw.notaInterna(7, "Pidió visitar el proyecto");
    await cw.pasarAPersona(7);
    expect(f.pedidos).toEqual([
      { url: "https://chat.ejemplo.com/api/v1/accounts/2/conversations/7/messages", autorizacion: "Bearer token-del-bot", cuerpo: { content: "Hola", message_type: "outgoing" } },
      { url: "https://chat.ejemplo.com/api/v1/accounts/2/conversations/7/messages", autorizacion: "Bearer token-del-bot", cuerpo: { content: "Pidió visitar el proyecto", message_type: "outgoing", private: true } },
      { url: "https://chat.ejemplo.com/api/v1/accounts/2/conversations/7/toggle_status", autorizacion: "Bearer token-del-bot", cuerpo: { status: "open" } },
    ]);
  });

  it("si Chatwoot rechaza, avisa con el código", async () => {
    await expect(crearChatwoot(cfg, chatwootFalso(401).pedir).enviar(7, "x")).rejects.toBeInstanceOf(ErrorChatwoot);
  });

  it("baja adjuntos solo de la dirección de Chatwoot", async () => {
    const urls: string[] = [];
    const pedir = (async (url: string) => {
      urls.push(url);
      return new Response(new Blob(["audio"], { type: "audio/ogg" }));
    }) as typeof fetch;
    const cw = crearChatwoot(cfg, pedir);
    const blob = await cw.bajarAdjunto("https://chat.ejemplo.com/rails/active_storage/blobs/redirect/abc/nota.oga");
    expect(await blob.text()).toBe("audio");
    await cw.bajarAdjunto("/rails/active_storage/blobs/redirect/abc/nota.oga");
    await expect(cw.bajarAdjunto("https://otro.ejemplo.com/archivo.oga")).rejects.toThrow("no está en Chatwoot");
    expect(urls).toEqual(["https://chat.ejemplo.com/rails/active_storage/blobs/redirect/abc/nota.oga", "https://chat.ejemplo.com/rails/active_storage/blobs/redirect/abc/nota.oga"]);
  });

  it("toma la configuración de las variables (sin la barra final)", () => {
    expect(configChatwoot({ CHATWOOT_URL: "https://chat.ejemplo.com/", CHATWOOT_ACCOUNT_ID: "2", CHATWOOT_BOT_TOKEN: "t" })).toEqual({ url: "https://chat.ejemplo.com", cuenta: "2", token: "t" });
    expect(configChatwoot({ CHATWOOT_URL: "https://chat.ejemplo.com" })).toBeNull();
  });
});
