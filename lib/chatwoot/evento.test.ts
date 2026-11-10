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
      adjuntos: [],
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
    expect(a).toMatchObject({ tipo: "responder", texto: "", audios: ["https://chat/a.ogg"], adjuntos: ["[foto]"] });
  });

  it("contesta también una foto o un archivo sin texto (para pedir que lo escriba); sin nada, no", () => {
    expect(accionPara(mensaje({ content: "  ", attachments: [{ file_type: "image", data_url: "https://chat/f.jpg" }] }))).toMatchObject({ tipo: "responder", adjuntos: ["[foto]"] });
    expect(accionPara(mensaje({ content: null, attachments: [{ file_type: "location" }] }))).toMatchObject({ tipo: "responder", adjuntos: ["[ubicación]"] });
    expect(accionPara(mensaje({ content: "  ", attachments: [] })).tipo).toBe("ignorar");
  });

  it("avisa cuando el equipo resuelve, abre o vuelve a poner pendiente una conversación", () => {
    const aviso = (event: string, status: string) => ({ event, id: 7, status, meta: { sender: { name: "Ana Prueba" } }, messages: [] });
    expect(accionPara(aviso("conversation_resolved", "resolved"))).toEqual({ tipo: "cambio_de_estado", conversacion: 7, estado: "resolved" });
    expect(accionPara(aviso("conversation_opened", "open"))).toEqual({ tipo: "cambio_de_estado", conversacion: 7, estado: "open" });
    expect(accionPara(aviso("conversation_status_changed", "pending"))).toEqual({ tipo: "cambio_de_estado", conversacion: 7, estado: "pending" });
    expect(accionPara({ event: "conversation_resolved", status: "resolved" }).tipo).toBe("ignorar");
    expect(accionPara({ ...aviso("conversation_resolved", "resolved"), meta: { sender: { identifier: "whatsapp.integration" } } }).tipo).toBe("ignorar");
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
    expect(accionPara(mensaje({ event: "conversation_updated" })).tipo).toBe("ignorar");
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
    expect(mensajeParaHistorial(mensaje({ content: "", attachments: [{ file_type: "audio" }, { file_type: "image" }, { file_type: "file" }] }))?.texto).toBe("[audio] [foto] [archivo]");
    expect(mensajeParaHistorial(mensaje({ private: true }))).toBeNull();
    expect(mensajeParaHistorial(mensaje({ message_type: "activity" }))).toBeNull();
    expect(mensajeParaHistorial(mensaje({ id: undefined }))).toBeNull();
  });

  it("acepta la fecha en segundos", () => {
    expect(mensajeParaHistorial(mensaje({ created_at: 1794085172 }))?.fecha).toBe(new Date(1794085172000).toISOString());
  });
});
