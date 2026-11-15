import { describe, expect, it } from "vitest";
import { lectorDeAdjuntos } from "./adjuntos";

const ENV = { CHATWOOT_URL: "https://chat.ejemplo.test", CHATWOOT_ACCOUNT_ID: "1", CHATWOOT_HUB_TOKEN: "token-hub" };
const foto = (id: number, url = `https://chat.ejemplo.test/rails/active_storage/blobs/${id}/foto.jpg`) => ({ id, attachments: [{ file_type: "image", data_url: url, thumb_url: `${url}?chica` }] });

describe("fotos y audios de una conversación, desde Chatwoot", () => {
  it("sin el token del usuario «Hub», no lee nada", () => {
    expect(lectorDeAdjuntos({ ...ENV, CHATWOOT_HUB_TOKEN: "" })).toBeNull();
  });

  it("lee de a 20 hacia atrás; deja afuera las notas internas, lo que no es foto, audio, video o archivo, y los links de otro lado", async () => {
    const pedidos: { url: string; auth: string | null }[] = [];
    const primera = [...Array.from({ length: 18 }, (_, i) => ({ id: 120 - i })), foto(102), { id: 101, private: true, attachments: [{ file_type: "image", data_url: "https://chat.ejemplo.test/nota.jpg" }] }];
    const segunda = [{ id: 50, attachments: [{ file_type: "audio", data_url: "https://chat.ejemplo.test/a.ogg" }, { file_type: "location", data_url: "https://chat.ejemplo.test/x" }] }, foto(49, "https://otro.test/robado.jpg")];
    const leer = lectorDeAdjuntos(ENV, (async (url: string, init: RequestInit) => {
      pedidos.push({ url, auth: new Headers(init.headers).get("authorization") });
      return new Response(JSON.stringify({ payload: url.includes("before=") ? segunda : primera }), { status: 200 });
    }) as typeof fetch)!;
    const adjuntos = await leer(7);
    expect(pedidos.map((p) => p.url)).toEqual(["https://chat.ejemplo.test/api/v1/accounts/1/conversations/7/messages", "https://chat.ejemplo.test/api/v1/accounts/1/conversations/7/messages?before=101"]);
    expect(pedidos[0].auth).toBe("Bearer token-hub");
    expect(adjuntos).toEqual([
      { mensaje: 50, tipo: "audio", url: "https://chat.ejemplo.test/a.ogg", miniatura: null },
      { mensaje: 102, tipo: "foto", url: "https://chat.ejemplo.test/rails/active_storage/blobs/102/foto.jpg", miniatura: "https://chat.ejemplo.test/rails/active_storage/blobs/102/foto.jpg?chica" },
    ]);
  });

  it("si el usuario «Hub» no tiene permiso, dice qué revisar", async () => {
    const leer = lectorDeAdjuntos(ENV, (async () => new Response("{}", { status: 401 })) as typeof fetch)!;
    await expect(leer(7)).rejects.toThrow(/CHATWOOT_HUB_TOKEN/);
  });
});
