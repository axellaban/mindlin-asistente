import { describe, expect, it } from "vitest";
import { accionPara, type EventoChatwoot } from "./evento";

const mensaje = (cambios: Partial<EventoChatwoot> = {}): EventoChatwoot => ({
  event: "message_created",
  id: 10,
  content: "Hola, ¿tienen 2 ambientes en Lerma?",
  message_type: "incoming",
  private: false,
  sender: { id: 5, type: "contact", name: "Ana" },
  conversation: { id: 7, status: "pending" },
  attachments: [],
  ...cambios,
});

describe("accionPara", () => {
  it("responde al interesado mientras la conversación está pendiente", () => {
    expect(accionPara(mensaje())).toEqual({ tipo: "responder", conversacion: 7, mensaje: 10, texto: "Hola, ¿tienen 2 ambientes en Lerma?", audios: [] });
  });

  it("no responde si la atiende una persona (abierta, resuelta o pospuesta)", () => {
    for (const status of ["open", "resolved", "snoozed"]) {
      expect(accionPara(mensaje({ conversation: { id: 7, status } })).tipo).toBe("ignorar");
    }
  });

  it("pasa los audios para transcribirlos, aunque no haya texto", () => {
    const a = accionPara(mensaje({ content: null, attachments: [{ file_type: "audio", data_url: "https://chat/a.ogg" }, { file_type: "image", data_url: "https://chat/f.jpg" }] }));
    expect(a).toMatchObject({ tipo: "responder", texto: "", audios: ["https://chat/a.ogg"] });
  });

  it("ignora un mensaje sin texto ni audio (por ejemplo, solo una foto)", () => {
    expect(accionPara(mensaje({ content: "  ", attachments: [{ file_type: "image", data_url: "https://chat/f.jpg" }] })).tipo).toBe("ignorar");
  });

  it("si una persona escribe en una conversación pendiente, la tomó ella", () => {
    expect(accionPara(mensaje({ message_type: "outgoing", sender: { id: 2, type: "user", name: "Mati" } }))).toEqual({ tipo: "la_tomo_una_persona", conversacion: 7 });
    // Desde el celular de la línea (WAHA lo copia a Chatwoot, a veces sin remitente).
    expect(accionPara(mensaje({ message_type: "outgoing", sender: null })).tipo).toBe("la_tomo_una_persona");
  });

  it("los mensajes del propio bot no cuentan como que la tomó una persona", () => {
    expect(accionPara(mensaje({ message_type: "outgoing", sender: { id: 1, type: "agent_bot" } })).tipo).toBe("ignorar");
  });

  it("acepta el tipo de mensaje como número (0 entrante, 1 saliente)", () => {
    expect(accionPara(mensaje({ message_type: 0 })).tipo).toBe("responder");
    expect(accionPara(mensaje({ message_type: 1, sender: { type: "user" } })).tipo).toBe("la_tomo_una_persona");
  });

  it("ignora notas internas, avisos y otros eventos", () => {
    expect(accionPara(mensaje({ private: true })).tipo).toBe("ignorar");
    expect(accionPara(mensaje({ message_type: "activity" })).tipo).toBe("ignorar");
    expect(accionPara(mensaje({ event: "conversation_status_changed" })).tipo).toBe("ignorar");
    expect(accionPara(mensaje({ conversation: null })).tipo).toBe("ignorar");
    expect(accionPara(null).tipo).toBe("ignorar");
  });
});
