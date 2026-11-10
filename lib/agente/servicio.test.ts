import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { lerma, otroProyecto, respuesta, tono } from "../../test/fixtures";
import type { Chatwoot } from "../chatwoot/api";
import type { Accion, MensajeHistorial } from "../chatwoot/evento";
import { COLUMNAS_CONTACTOS, crearCRM, type Hoja } from "../crm/planilla";
import { almacenEnMemoria } from "../datos/memoria";
import type { Proyecto } from "../datos/tipos";
import type { Modelo } from "./agente";
import { atender, conTranscripciones, laTomoUnaPersona, nombreDeAudio } from "./servicio";

type Responder = Extract<Accion, { tipo: "responder" }>;
const AHORA = new Date("2026-11-07T21:05:00Z");

function chatwootFalso() {
  const hechos: string[] = [];
  const chatwoot: Chatwoot = {
    async enviar(c, t) {
      hechos.push(`enviar ${c}: ${t}`);
      return 500;
    },
    async notaInterna(c, t) {
      hechos.push(`nota ${c}: ${t}`);
    },
    async pasarAPersona(c) {
      hechos.push(`abrir ${c}`);
    },
    async bajarAdjunto(url) {
      hechos.push(`bajar ${url}`);
      return new Blob(["audio"], { type: "audio/ogg" });
    },
  };
  return { chatwoot, hechos };
}

function hojaFalsa(contactos: string[][] = []) {
  const pestanias: Record<string, string[][]> = { "CRM Contactos": contactos, "CRM Actividad": [] };
  let fallarLecturas = 0;
  const hoja: Hoja = {
    async leer() {
      if (fallarLecturas-- > 0) throw new Error("Google no responde");
      return pestanias["CRM Contactos"];
    },
    async agregar(p, filas) {
      pestanias[p].push(...filas);
    },
  };
  return { hoja, pestanias, fallar: (n: number) => (fallarLecturas = n) };
}

/** Un Claude de mentira: devuelve las respuestas en orden y guarda lo que recibió. */
function modeloFalso(...respuestas: (Anthropic.Beta.BetaMessage | Error)[]) {
  const pedidos: Parameters<Modelo>[0][] = [];
  const modelo: Modelo = async (p) => {
    pedidos.push(structuredClone(p));
    const r = respuestas.shift();
    if (!r) throw new Error("no hay más respuestas preparadas");
    if (r instanceof Error) throw r;
    return r;
  };
  return { modelo, pedidos };
}

function preparar({ proyectos = [lerma()], contactos = [] as string[][], historial = [] as MensajeHistorial[] } = {}) {
  const datos = almacenEnMemoria({ proyectos, tono });
  for (const m of historial) void datos.almacen.guardarMensaje(m);
  const cw = chatwootFalso();
  const hoja = hojaFalsa(contactos);
  return { datos, cw, hoja, crm: crearCRM(hoja.hoja, { responsable: "Tadeo" }) };
}

const msg = (id: number, rol: MensajeHistorial["rol"], texto: string, minuto = id): MensajeHistorial => ({
  id,
  conversacion: 7,
  rol,
  texto,
  fecha: `2026-11-07T21:${String(minuto).padStart(2, "0")}:00.000Z`,
});

const accion = (mensaje: number, texto = "Hola, ¿tienen 2 ambientes?"): Responder => ({
  tipo: "responder",
  conversacion: 7,
  mensaje,
  texto,
  audios: [],
  adjuntos: [],
  contacto: { nombre: "Ana Prueba", telefono: "5491155550000" },
  bandeja: 1,
});

const sinEspera = { dormir: async () => {}, ahora: () => AHORA };

describe("atender un mensaje", () => {
  it("contesta con la ficha y registra al interesado nuevo en el CRM", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "Hola, ¿tienen 2 ambientes?")] });
    const m = modeloFalso(
      respuesta([
        {
          type: "tool_use",
          id: "t1",
          name: "registrar_interesado",
          input: { nombre: "", para: "Vivir", ambientes: "2", presupuesto_usd: "", forma_de_pago: "", plazo: "", resumen: "Busca 2 ambientes para vivir." },
        },
      ]),
      respuesta([{ type: "text", text: "¡Hola Ana! Sí, en Lerma 439 hay 2 ambientes de 45 m². ¿Para vivir o invertir?" }]),
    );

    expect(await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm }, accion(1))).toBe("respondió");

    expect(p.cw.hechos).toEqual(["enviar 7: ¡Hola Ana! Sí, en Lerma 439 hay 2 ambientes de 45 m². ¿Para vivir o invertir?"]);
    const [fila] = p.hoja.pestanias["CRM Contactos"];
    expect([fila[2], fila[3], fila[1], fila[13], fila[14], fila[21]]).toEqual(["Ana Prueba", "+5491155550000", "lerma-439", "Vivir", "2", "Tadeo"]);
    expect(p.hoja.pestanias["CRM Actividad"][0][5]).toBe("Alta por WhatsApp. Busca 2 ambientes para vivir.");
    expect(p.datos.conversaciones.get(7)).toMatchObject({ telefono: "5491155550000", crm_contacto_id: fila[0] });

    // Lo que recibió Claude: instrucciones estables (en caché) con la ficha, la situación y el historial.
    const [pedido] = m.pedidos;
    expect(pedido.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(pedido.system[0].text).toContain("Villa Crespo");
    expect(pedido.system[1].text).toContain("primera vez");
    expect(pedido.messages).toEqual([{ role: "user", content: "Hola, ¿tienen 2 ambientes?" }]);
    expect(pedido.tools.map((t) => t.name)).toEqual(["registrar_interesado", "pasar_a_persona"]);
    // La segunda vuelta lleva el pedido de herramienta y su resultado.
    expect(m.pedidos[1].messages.at(-1)).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "Listo: quedó en el CRM como contacto nuevo." }] });
  });

  it("si la persona ya está en el CRM, no la duplica: suma actividad", async () => {
    const existente = COLUMNAS_CONTACTOS.map((c) => ({ ID: "c1", Nombre: "Ana", Teléfono: "+54 9 11 5555-0000", Etapa: "Seguimiento", Responsable: "Mati" })[c as "ID"] ?? "");
    const p = preparar({ contactos: [existente], historial: [msg(1, "interesado", "Hola")] });
    const m = modeloFalso(
      respuesta([{ type: "tool_use", id: "t1", name: "registrar_interesado", input: { nombre: "", para: "Invertir", ambientes: "", presupuesto_usd: "90000", forma_de_pago: "", plazo: "", resumen: "Ahora busca para invertir." } }]),
      respuesta([{ type: "text", text: "¡Hola de nuevo!" }]),
    );
    await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm }, accion(1, "Hola"));
    expect(p.hoja.pestanias["CRM Contactos"]).toHaveLength(1);
    expect(p.hoja.pestanias["CRM Actividad"][0].slice(2, 7)).toEqual(["c1", "Ana", "WhatsApp", "Ahora busca para invertir. (para: Invertir, presupuesto: USD 90000)", "Seguimiento"]);
    expect(m.pedidos[0].system[1].text).toContain("Responsable: Mati");
  });

  it("si la persona sigue escribiendo, contesta el último mensaje y no cada uno", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "Hola"), msg(2, "interesado", "¿Tienen cochera?")] });
    const m = modeloFalso(respuesta([{ type: "text", text: "¡Hola! Sí, hay cocheras." }]));
    const s = { ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm };
    expect(await atender(s, accion(1, "Hola"))).toBe("llegó otro mensaje: contesta ese");
    expect(await atender(s, accion(2, "¿Tienen cochera?"))).toBe("respondió");
    expect(m.pedidos).toHaveLength(1);
    expect(m.pedidos[0].messages).toEqual([
      { role: "user", content: "Hola" },
      { role: "user", content: "¿Tienen cochera?" },
    ]);
  });

  it("no contesta dos veces el mismo mensaje, ni si ya le contestó alguien del equipo", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "Hola"), msg(2, "persona", "Hola Ana, soy Mati")] });
    const m = modeloFalso(respuesta([{ type: "text", text: "x" }]));
    const s = { ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm };
    expect(await atender(s, accion(1, "Hola"))).toBe("ya le contestó alguien");
    expect(await atender(s, accion(1, "Hola"))).toBe("ya se había atendido");
    expect(m.pedidos).toHaveLength(0);
  });

  it("lo que escribió el equipo le llega a Claude marcado como [Equipo]", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "Hola"), msg(2, "persona", "Te paso los planos"), msg(3, "interesado", "Gracias, ¿y precios?")] });
    const m = modeloFalso(respuesta([{ type: "text", text: "Te los confirma el equipo." }]));
    await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm }, accion(3));
    expect(m.pedidos[0].messages[1]).toEqual({ role: "assistant", content: "[Equipo] Te paso los planos" });
  });

  it("pasa a una persona: avisa, deja una nota interna, abre la conversación y lo anota en el CRM", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "Quiero ir a ver el proyecto")] });
    const m = modeloFalso(
      respuesta([{ type: "tool_use", id: "t1", name: "pasar_a_persona", input: { motivo: "quiere visitar el proyecto", resumen: "Busca 2 ambientes, quiere visitar el sábado." } }]),
      respuesta([{ type: "text", text: "¡Genial! Alguien del equipo te escribe para coordinar la visita." }]),
    );
    expect(await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm }, accion(1))).toBe(
      "respondió y pasó a una persona: quiere visitar el proyecto",
    );
    expect(p.cw.hechos).toEqual([
      "enviar 7: ¡Genial! Alguien del equipo te escribe para coordinar la visita.",
      "nota 7: 🙋 El asistente pasó esta conversación al equipo: quiere visitar el proyecto\nResumen: Busca 2 ambientes, quiere visitar el sábado.",
      "abrir 7",
    ]);
    expect(p.datos.registro.map((r) => r.tipo)).toEqual(["respuesta", "paso_a_persona"]);
  });

  it("si Claude rechaza o falla, la conversación pasa al equipo con una nota (nadie queda sin respuesta)", async () => {
    const rechazo = preparar({ historial: [msg(1, "interesado", "Hola")] });
    await atender({ ...sinEspera, almacen: rechazo.datos.almacen, chatwoot: rechazo.cw.chatwoot, modelo: modeloFalso(respuesta([], "refusal")).modelo, crm: rechazo.crm }, accion(1));
    expect(rechazo.cw.hechos).toEqual(["nota 7: 🙋 El asistente pasó esta conversación al equipo: El asistente no pudo responder esta consulta.", "abrir 7"]);

    const error = preparar({ historial: [msg(1, "interesado", "Hola")] });
    const r = await atender({ ...sinEspera, almacen: error.datos.almacen, chatwoot: error.cw.chatwoot, modelo: modeloFalso(new Error("Anthropic no responde")).modelo, crm: error.crm }, accion(1));
    expect(r).toBe("error: Anthropic no responde");
    expect(error.cw.hechos[0]).toContain("El asistente tuvo un error y no pudo responder.");
    expect(error.cw.hechos.at(-1)).toBe("abrir 7");
    expect(error.datos.registro.some((x) => x.tipo === "error")).toBe(true);
  });

  it("si el CRM no respondió al principio, lo vuelve a buscar antes de dar de alta (no crea repetidos)", async () => {
    const existente = COLUMNAS_CONTACTOS.map((c) => ({ ID: "c1", Nombre: "Ana", Teléfono: "+5491155550000" })[c as "ID"] ?? "");
    const p = preparar({ contactos: [existente], historial: [msg(1, "interesado", "Hola")] });
    p.hoja.fallar(1);
    const m = modeloFalso(
      respuesta([{ type: "tool_use", id: "t1", name: "registrar_interesado", input: { nombre: "Ana", para: "", ambientes: "", presupuesto_usd: "", forma_de_pago: "", plazo: "", resumen: "Saludó." } }]),
      respuesta([{ type: "text", text: "¡Hola!" }]),
    );
    await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm }, accion(1));
    expect(m.pedidos[0].system[1].text).toContain("no se pudo consultar");
    expect(p.hoja.pestanias["CRM Contactos"]).toHaveLength(1);
    expect(p.hoja.pestanias["CRM Actividad"]).toHaveLength(1);
  });

  it("con varios proyectos, Claude elige uno y recibe su ficha", async () => {
    const proyectos: Proyecto[] = [lerma(), otroProyecto()];
    const p = preparar({ proyectos, historial: [msg(1, "interesado", "Hola, consulto por Lerma")] });
    const m = modeloFalso(
      respuesta([{ type: "tool_use", id: "t1", name: "elegir_proyecto", input: { proyecto_id: "lerma-439" } }]),
      respuesta([{ type: "text", text: "¡Hola! Lerma 439 está en Villa Crespo." }]),
    );
    await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm }, accion(1));
    expect(m.pedidos[0].tools.map((t) => t.name)).toContain("elegir_proyecto");
    // Antes de elegir, solo la lista (nombre y zona); la ficha llega como resultado de la herramienta.
    expect(m.pedidos[0].system[0].text).not.toContain("45 m²");
    expect(JSON.stringify(m.pedidos[1].messages.at(-1))).toContain("45 m²");
    expect(p.datos.conversaciones.get(7)?.proyecto).toBe("lerma-439");
  });

  it("sin teléfono (WhatsApp no lo pasa), no crea repetidos: la segunda vez lo encuentra por el ID anotado", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "Hola, busco 2 ambientes"), msg(2, "bot", "¡Hola! ¿Para vivir o invertir?"), msg(3, "interesado", "Para invertir")] });
    const sinTelefono = (mensaje: number, texto: string): Responder => ({ ...accion(mensaje, texto), contacto: { nombre: "Ana Prueba", telefono: "" } });
    const registrar = (para: string, resumen: string) =>
      respuesta([{ type: "tool_use", id: `t${para}`, name: "registrar_interesado", input: { nombre: "", para, ambientes: "2", presupuesto_usd: "", forma_de_pago: "", plazo: "", resumen } }]);
    const m = modeloFalso(registrar("", "Busca 2 ambientes."), respuesta([{ type: "text", text: "¿Para vivir o invertir?" }]), registrar("Invertir", "Busca 2 ambientes para invertir."), respuesta([{ type: "text", text: "¡Bárbaro!" }]));
    const s = { ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm };

    // Primer mensaje (como si el historial terminara ahí).
    p.datos.mensajes.delete(2);
    p.datos.mensajes.delete(3);
    await atender(s, sinTelefono(1, "Hola, busco 2 ambientes"));
    void p.datos.almacen.guardarMensaje(msg(2, "bot", "¿Para vivir o invertir?"));
    void p.datos.almacen.guardarMensaje(msg(3, "interesado", "Para invertir"));
    await atender(s, sinTelefono(3, "Para invertir"));

    expect(p.hoja.pestanias["CRM Contactos"]).toHaveLength(1);
    const id = p.hoja.pestanias["CRM Contactos"][0][0];
    expect(p.datos.conversaciones.get(7)).toMatchObject({ crm_contacto_id: id, interesado: { ambientes: "2", para: "Invertir", resumen: "Busca 2 ambientes para invertir." } });
    // En la actividad, solo lo nuevo (los ambientes ya estaban).
    expect(p.hoja.pestanias["CRM Actividad"].map((f) => f[5])).toEqual(["Alta por WhatsApp. Busca 2 ambientes.", "Busca 2 ambientes para invertir. (para: Invertir)"]);
    // En el segundo mensaje ya sabía lo anotado y que estaba en el CRM.
    expect(m.pedidos[2].system[1].text).toContain("Lo que ya sabés de esta persona (lo anotaste vos): ambientes: 2.");
    expect(m.pedidos[2].system[1].text).toContain("ya es contacto");
  });

  it("si vuelve a registrar lo mismo, no lo repite en el CRM", async () => {
    const existente = COLUMNAS_CONTACTOS.map((c) => ({ ID: "c1", Nombre: "Ana", Teléfono: "+5491155550000" })[c as "ID"] ?? "");
    const p = preparar({ contactos: [existente], historial: [msg(1, "interesado", "Hola")] });
    await p.datos.almacen.guardarConversacion({ chatwoot_id: 7, crm_contacto_id: "c1", interesado: { para: "Invertir", ambientes: "2" } });
    const m = modeloFalso(
      respuesta([{ type: "tool_use", id: "t1", name: "registrar_interesado", input: { nombre: "", para: "Invertir", ambientes: "2", presupuesto_usd: "", forma_de_pago: "", plazo: "", resumen: "Sigue igual." } }]),
      respuesta([{ type: "text", text: "**Perfecto.** Te cuento:\n\n\n## Precios\n* Ver [el folleto](https://ejemplo.com/f.pdf)" }]),
    );
    await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm }, accion(1, "Hola"));
    expect(p.hoja.pestanias["CRM Actividad"]).toHaveLength(0);
    expect(JSON.stringify(m.pedidos[1].messages.at(-1))).toContain("ya estaba anotado");
    // Y la respuesta sale con el formato de WhatsApp.
    expect(p.cw.hechos).toEqual(["enviar 7: *Perfecto.* Te cuento:\n\n*Precios*\n- Ver el folleto: https://ejemplo.com/f.pdf"]);
  });

  it("modo «presenta y pasa»: presenta y, cuando la persona responde, sigue el equipo sin usar la IA", async () => {
    const conModo = (historial: MensajeHistorial[]) => {
      const datos = almacenEnMemoria({ proyectos: [lerma()], tono: { ...tono, pasar_al_responder: true } });
      for (const m of historial) void datos.almacen.guardarMensaje(m);
      return { datos, cw: chatwootFalso() };
    };
    // Primer mensaje: todavía no le escribió, así que presenta.
    const primero = conModo([msg(1, "interesado", "Hola, vi lo de Lerma")]);
    const m = modeloFalso(respuesta([{ type: "text", text: "¡Hola! Lerma 439 es un desarrollo en pozo…" }]));
    expect(await atender({ ...sinEspera, almacen: primero.datos.almacen, chatwoot: primero.cw.chatwoot, modelo: m.modelo, crm: null }, accion(1, "Hola, vi lo de Lerma"))).toBe("respondió");

    // La persona responde después de la presentación: pasa al equipo.
    const despues = conModo([msg(1, "interesado", "Hola"), msg(2, "bot", "¡Hola! Lerma 439 es…"), msg(3, "interesado", "Me interesa el de 2 ambientes")]);
    const sinUso = modeloFalso();
    expect(await atender({ ...sinEspera, almacen: despues.datos.almacen, chatwoot: despues.cw.chatwoot, modelo: sinUso.modelo, crm: null }, accion(3, "Me interesa el de 2 ambientes"))).toBe(
      "pasó al equipo: respondió después de la presentación",
    );
    expect(sinUso.pedidos).toHaveLength(0);
    expect(despues.cw.hechos).toEqual(["nota 7: 🙋 El asistente pasó esta conversación al equipo: La persona respondió después de la presentación (modo «presenta y pasa»).", "abrir 7"]);
    expect(despues.datos.seguimiento.get(7)?.sin_seguimientos).toBe(true);

    // Si el equipo se la devolvió al asistente a propósito, responde.
    const devuelta = conModo([msg(1, "interesado", "Hola"), msg(2, "bot", "¡Hola!"), msg(3, "persona", "Te paso con el asistente"), msg(4, "interesado", "¿Y la cochera?")]);
    const m3 = modeloFalso(respuesta([{ type: "text", text: "Eso lo confirma el equipo." }]));
    expect(await atender({ ...sinEspera, almacen: devuelta.datos.almacen, chatwoot: devuelta.cw.chatwoot, modelo: m3.modelo, crm: null }, accion(4, "¿Y la cochera?"))).toBe("respondió");
  });

  it("de dónde es y hace cuánto busca: quedan anotados y van a las notas del contacto nuevo", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "Soy de La Plata, busco hace 3 meses")] });
    const m = modeloFalso(
      respuesta([{ type: "tool_use", id: "t1", name: "registrar_interesado", input: { nombre: "", para: "", ambientes: "", presupuesto_usd: "", forma_de_pago: "", plazo: "", zona: "La Plata", busca_desde: "3 meses", resumen: "Es de La Plata." } }]),
      respuesta([{ type: "text", text: "¡Genial!" }]),
    );
    await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: p.crm }, accion(1, "Soy de La Plata, busco hace 3 meses"));
    expect(p.datos.conversaciones.get(7)?.interesado).toMatchObject({ zona: "La Plata", busca_desde: "3 meses" });
    expect(p.hoja.pestanias["CRM Contactos"][0][COLUMNAS_CONTACTOS.indexOf("Notas")]).toBe("Entró por WhatsApp (asistente). Es de La Plata. Es de: La Plata. Busca hace: 3 meses.");
    expect(m.pedidos[0].tools[0].input_schema.required).toContain("zona");
  });

  it("sin CRM conectado, igual contesta", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "Hola")] });
    const m = modeloFalso(
      respuesta([{ type: "tool_use", id: "t1", name: "registrar_interesado", input: { nombre: "", para: "", ambientes: "", presupuesto_usd: "", forma_de_pago: "", plazo: "", resumen: "x" } }]),
      respuesta([{ type: "text", text: "¡Hola!" }]),
    );
    expect(await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: null }, accion(1))).toBe("respondió");
  });
});

describe("audios", () => {
  const conAudio = (mensaje: number, texto = ""): Responder => ({ ...accion(mensaje, texto), audios: ["https://chat.ejemplo.com/audio-1.oga"] });

  it("transcribe el audio, lo guarda en el historial y contesta por escrito", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "[audio]")] });
    const m = modeloFalso(respuesta([{ type: "text", text: "¡Sí! Hay cocheras." }]));
    const oidos: string[] = [];
    const transcribir = async (audio: Blob, nombre: string) => {
      oidos.push(`${await audio.text()} ${nombre}`);
      return "Hola, ¿tienen cochera?";
    };
    expect(await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: null, transcribir }, conAudio(1))).toBe("respondió");
    expect(oidos).toEqual(["audio audio.ogg"]);
    expect(p.cw.hechos[0]).toBe("bajar https://chat.ejemplo.com/audio-1.oga");
    expect(p.datos.mensajes.get(1)?.texto).toBe("[audio: «Hola, ¿tienen cochera?»]");
    expect(m.pedidos[0].messages).toEqual([{ role: "user", content: "[audio: «Hola, ¿tienen cochera?»]" }]);
  });

  it("si no se puede transcribir (o falta la clave de OpenAI), queda [audio] y el bot pide que lo escriba", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "[audio]")] });
    const m = modeloFalso(respuesta([{ type: "text", text: "¿Me lo escribís?" }]));
    const transcribir = async () => {
      throw new Error("OpenAI no responde");
    };
    await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: null, transcribir }, conAudio(1));
    expect(m.pedidos[0].messages).toEqual([{ role: "user", content: "[audio]" }]);
    expect(p.datos.registro.find((r) => r.tipo === "error")?.detalle).toContain("Audio (transcribir)");
    expect(m.pedidos[0].system[0].text).toContain("Si aparece solo [audio]");

    const sinClave = preparar({ historial: [msg(1, "interesado", "[audio]")] });
    const m2 = modeloFalso(respuesta([{ type: "text", text: "¿Me lo escribís?" }]));
    await atender({ ...sinEspera, almacen: sinClave.datos.almacen, chatwoot: sinClave.cw.chatwoot, modelo: m2.modelo, crm: null }, conAudio(1));
    expect(sinClave.cw.hechos).toEqual(["enviar 7: ¿Me lo escribís?"]);
  });

  it("pone cada transcripción en su lugar y elige la extensión que entiende OpenAI", () => {
    expect(conTranscripciones("Mirá [audio] [audio]", ["uno", ""])).toBe("Mirá [audio: «uno»] [audio]");
    expect(conTranscripciones("Sin audios", [])).toBe("Sin audios");
    expect(["audio/ogg; codecs=opus", "audio/mpeg", "audio/mp4", "audio/wav", "", "application/octet-stream"].map(nombreDeAudio)).toEqual([
      "audio.ogg",
      "audio.mp3",
      "audio.m4a",
      "audio.wav",
      "audio.ogg",
      "audio.ogg",
    ]);
  });
});

describe("límites", () => {
  it("si del otro lado hay un contestador automático, deja de responder y pasa al equipo sin llamar a la IA", async () => {
    const auto = "Gracias por escribirnos, en breve te respondemos.";
    const p = preparar({ historial: [msg(1, "interesado", auto), msg(2, "bot", "¡Hola!"), msg(3, "interesado", auto), msg(4, "bot", "¿Me contás?"), msg(5, "interesado", auto)] });
    const m = modeloFalso();
    const r = await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: null }, accion(5, auto));
    expect(r).toContain("frenó");
    expect(m.pedidos).toHaveLength(0);
    expect(p.cw.hechos).toEqual(["nota 7: 🙋 El asistente pasó esta conversación al equipo: El asistente dejó de responder: repite el mismo mensaje: puede ser un contestador automático.", "abrir 7"]);
  });
});

describe("cuando el equipo le devuelve la conversación al asistente", () => {
  it("vuelve a responder, lo anota y la conversación vuelve a llevar seguimientos", async () => {
    const p = preparar({ historial: [msg(1, "interesado", "Hola"), msg(2, "persona", "Hola Ana, soy Mati"), msg(3, "interesado", "¿Y la cochera?")] });
    expect(p.datos.seguimiento.get(7)?.sin_seguimientos).toBe(true);
    const m = modeloFalso(respuesta([{ type: "text", text: "Sí, hay cocheras." }]));
    // Chatwoot solo manda «responder» si la conversación está pendiente: el equipo la devolvió.
    expect(await atender({ ...sinEspera, almacen: p.datos.almacen, chatwoot: p.cw.chatwoot, modelo: m.modelo, crm: null }, accion(3, "¿Y la cochera?"))).toBe("respondió");
    expect(p.datos.seguimiento.get(7)?.sin_seguimientos).toBe(false);
    expect(p.datos.registro.map((r) => r.tipo)).toEqual(["volvio_al_bot", "respuesta"]);
    // Lo que escribió el equipo le llega a la IA, para seguir su línea.
    expect(m.pedidos[0].messages[1]).toEqual({ role: "assistant", content: "[Equipo] Hola Ana, soy Mati" });
  });
});

describe("cuando una persona toma la conversación", () => {
  it("la pasa a abierta y lo anota", async () => {
    const p = preparar();
    await laTomoUnaPersona({ almacen: p.datos.almacen, chatwoot: p.cw.chatwoot }, 7);
    expect(p.cw.hechos).toEqual(["abrir 7"]);
    expect(p.datos.registro[0].tipo).toBe("la_tomo_una_persona");
  });
});
