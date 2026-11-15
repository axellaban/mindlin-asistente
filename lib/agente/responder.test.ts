import { describe, expect, it } from "vitest";
import type { Chatwoot } from "../chatwoot/api";
import { almacenEnMemoria } from "../datos/memoria";
import { responderDesdeElHub } from "./servicio";

function armar() {
  const datos = almacenEnMemoria();
  const hechos: string[] = [];
  const chatwoot: Chatwoot = {
    async enviar(c, t) {
      hechos.push(`enviar ${c}: ${t}`);
      return 900;
    },
    async enviarArchivo() {
      return null;
    },
    async notaInterna(c, t) {
      hechos.push(`nota ${c}: ${t}`);
    },
    async pasarAPersona(c) {
      hechos.push(`abrir ${c}`);
    },
    async bajarAdjunto() {
      return new Blob();
    },
  };
  return { datos, hechos, s: { almacen: datos.almacen, chatwoot, ahora: () => new Date("2026-11-16T13:00:00.000Z") } };
}

describe("responder desde el hub", () => {
  it("primero se corre el asistente (abierta, sin seguimientos ni flujo), después sale el mensaje, con una nota de quién lo escribió", async () => {
    const x = armar();
    await x.datos.almacen.iniciarCorrida({ conversacion: 7, linea: "linea-3", flujo: 1, nombre: "Presentación", pasos: [{ tipo: "fin" }], ahora: "2026-11-16T12:00:00.000Z" });
    const m = await responderDesdeElHub(x.s, 7, "Hola Ana, soy Mati. ¿Te queda bien el jueves?", "Mati");
    expect(x.hechos).toEqual(["abrir 7", "enviar 7: Hola Ana, soy Mati. ¿Te queda bien el jueves?", "nota 7: ✍️ Lo escribió Mati desde el hub."]);
    expect(m).toEqual({ id: 900, conversacion: 7, rol: "persona", texto: "Hola Ana, soy Mati. ¿Te queda bien el jueves?", fecha: "2026-11-16T13:00:00.000Z" });
    expect(x.datos.mensajes.get(900)?.rol).toBe("persona");
    expect(x.datos.seguimiento.get(7)?.sin_seguimientos).toBe(true);
    expect(x.datos.corridas[0]).toMatchObject({ estado: "terminado", resultado: "cancelado" });
    expect(x.datos.registro.map((r) => [r.tipo, r.detalle])).toEqual([["la_tomo_una_persona", "Mati respondió desde el hub: el asistente deja de responder."]]);
  });

  it("si el aviso de Chatwoot llegó antes y lo guardó como del bot, queda como del equipo", async () => {
    const x = armar();
    x.s.chatwoot.enviar = async (c, t) => {
      await x.datos.almacen.guardarMensaje({ id: 900, conversacion: c, rol: "bot", texto: t, fecha: "2026-11-16T13:00:00.000Z" });
      return 900;
    };
    await responderDesdeElHub(x.s, 7, "Hola", "Tade");
    expect(x.datos.mensajes.get(900)?.rol).toBe("persona");
  });
});
