import { describe, expect, it } from "vitest";
import { accionPara, mensajeParaHistorial, type EventoChatwoot } from "./evento";

const mensaje = (cambios: Partial<EventoChatwoot> = {}): EventoChatwoot => ({
  event: "message_created",
  id: 10,
  content: "Hola, ¿tienen 2 ambientes en Lerma?",
  message_type: "incoming",
  private: false,
  created_at: "2026-11-07T21:01:32.974Z",
  sender: null,
  conversation: { id: 7, status: "pending", meta: { sender: { id: 2, name: "Ana Prueba", phone_number: "+5491155550000", identifier: null } } },
  inbox: { id: 1, name: "WhatsApp Lerma 439" },
  attachments: [],
  ...cambios,
});

describe("accionPara", () => {
  it("responde al interesado mientras la conversación está pendiente", () => {
    expect(accionPara(mensaje())).toEqual({
      tipo: "responder",
      conversacion: 7,
      mensaje: 10,
      texto: "Hola, ¿tienen 2 ambientes en Lerma?",
      audios: [],
      contacto: { nombre: "Ana Prueba", telefono: "5491155550000" },
      bandeja: 1,
    });
  });

  it("no responde si la atiende una persona (abierta, resuelta o pospuesta)", () => {
    for (const status of ["open", "resolved", "snoozed"]) {
      expect(accionPara(mensaje({ conversation: { id: 7, status } }))).toMatchObject({ tipo: "ignorar", motivo: "la conversación la atiende una persona" });
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

  it("ignora la conversación de avisos y QR que crea WAHA", () => {
    const integracion = { id: 1, status: "pending", meta: { sender: { name: "Integración de WhatsApp", identifier: "whatsapp.integration" } } };
    expect(accionPara(mensaje({ conversation: integracion }))).toMatchObject({ tipo: "ignorar", motivo: "es la conversación de avisos de WAHA" });
    const porAtributo = { id: 1, status: "pending", meta: { sender: { custom_attributes: { waha_whatsapp_chat_id: "whatsapp.integration" } } } };
    expect(accionPara(mensaje({ conversation: porAtributo })).tipo).toBe("ignorar");
    expect(mensajeParaHistorial(mensaje({ conversation: integracion }))).toBeNull();
  });
});

describe("mensajeParaHistorial", () => {
  it("guarda quién escribió: el interesado, el bot o una persona del equipo", () => {
    expect(mensajeParaHistorial(mensaje())).toEqual({ id: 10, conversacion: 7, rol: "interesado", texto: "Hola, ¿tienen 2 ambientes en Lerma?", fecha: "2026-11-07T21:01:32.974Z" });
    expect(mensajeParaHistorial(mensaje({ message_type: "outgoing", sender: { type: "agent_bot" } }))?.rol).toBe("bot");
    expect(mensajeParaHistorial(mensaje({ message_type: "outgoing", sender: { type: "user" } }))?.rol).toBe("persona");
    // Aunque la conversación ya esté abierta: el historial sigue completo para cuando vuelva el bot.
    expect(mensajeParaHistorial(mensaje({ conversation: { id: 7, status: "open" } }))?.rol).toBe("interesado");
  });

  it("anota los adjuntos y deja afuera notas internas y avisos", () => {
    expect(mensajeParaHistorial(mensaje({ content: "", attachments: [{ file_type: "audio" }, { file_type: "image" }] }))?.texto).toBe("[audio] [foto]");
    expect(mensajeParaHistorial(mensaje({ private: true }))).toBeNull();
    expect(mensajeParaHistorial(mensaje({ message_type: "activity" }))).toBeNull();
    expect(mensajeParaHistorial(mensaje({ id: undefined }))).toBeNull();
  });

  it("acepta la fecha en segundos", () => {
    expect(mensajeParaHistorial(mensaje({ created_at: 1794085172 }))?.fecha).toBe(new Date(1794085172000).toISOString());
  });
});
