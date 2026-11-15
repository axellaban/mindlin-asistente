import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { aplicarCeldas, lerma, otroProyecto, respuesta, tono } from "../../test/fixtures";
import type { Chatwoot } from "../chatwoot/api";
import type { Accion, MensajeHistorial } from "../chatwoot/evento";
import { COLUMNAS_CONTACTOS, crearCRM, type Hoja } from "../crm/planilla";
import { almacenEnMemoria } from "../datos/memoria";
import type { Modelo } from "../agente/agente";
import { atender } from "../agente/servicio";
import type { Servicios } from "../agente/charla";
import { LINEAS_DE_FABRICA, type Linea } from "../lineas";
import { REGLAS_POR_DEFECTO } from "../etapas/reglas";
import { correrSeguimientos } from "../seguimientos/correr";
import type { FlujoActivo, Paso } from "./modelo";
import type { Campania } from "../campanias";

type Responder = Extract<Accion, { tipo: "responder" }>;
const LINEA_3 = LINEAS_DE_FABRICA[2];
const T0 = Date.parse("2026-11-16T13:00:00Z");
const hora = (h: number) => new Date(T0 + h * 3_600_000);
const ETAPA = COLUMNAS_CONTACTOS.indexOf("Etapa");
/** Otro proyecto con sus propias palabras (el de los fixtures copia las de Lerma). */
const otro = () => ({ ...otroProyecto(), palabras_clave: ["otro"] });

const presentacion: Paso[] = [
  { tipo: "mensaje", texto: "¡Hola {{nombre}}! Te escribimos desde Mindlin Developers.", archivo: null },
  { tipo: "pausa", segundos: 5 },
  { tipo: "mensaje", texto: "Te dejo el brochure de {{proyecto}}.", archivo: 1 },
  {
    tipo: "esperar",
    horas: 24,
    si_responde: [{ tipo: "etapa", etapa: "Seguimiento" }, { tipo: "equipo", nota: "Respondió a la presentación." }],
    si_no: [{ tipo: "etapa", etapa: "En pausa" }, { tipo: "mensaje", texto: "¿Pudiste ver lo de {{proyecto}}?", archivo: null }, { tipo: "esperar", horas: 24, si_responde: [{ tipo: "seguir_ia" }], si_no: [{ tipo: "fin" }] }],
  },
];

function armar({ flujos = [{ id: 1, nombre: "Presentación", proyecto: null, pasos: presentacion, linea: "linea-3" }] as (FlujoActivo & { linea: string })[], lineas = LINEAS_DE_FABRICA, campanias = [] as Campania[] } = {}) {
  const datos = almacenEnMemoria({
    proyectos: [lerma(), otro()],
    tono,
    etapas: REGLAS_POR_DEFECTO,
    lineas,
    flujos,
    archivos: [{ id: 1, nombre: "brochure-lerma.pdf", tipo: "application/pdf", datos: new Uint8Array([37, 80, 68, 70]) }],
    campanias,
  });
  const hechos: string[] = [];
  const chatwoot: Chatwoot = {
    async enviar(c, t) {
      hechos.push(`enviar ${c}: ${t}`);
      return 1;
    },
    async enviarArchivo(c, t, a) {
      hechos.push(`archivo ${c}: ${a.nombre} «${t}»`);
      return 2;
    },
    async notaInterna(c, t) {
      hechos.push(`nota ${c}: ${t.split("\n")[0]}`);
    },
    async pasarAPersona(c) {
      hechos.push(`abrir ${c}`);
    },
    async bajarAdjunto() {
      return new Blob();
    },
  };
  const pestanias: Record<string, string[][]> = { "CRM Contactos": [], "CRM Actividad": [] };
  const hoja: Hoja = {
    leer: async () => pestanias["CRM Contactos"],
    agregar: async (p, filas) => void pestanias[p].push(...filas),
    actualizar: async (celdas) => aplicarCeldas(pestanias, celdas),
  };
  const crm = crearCRM(hoja, { responsable: "Tadeo" });
  let reloj = hora(0);
  const pedidos: Parameters<Modelo>[0][] = [];
  const respuestas: Anthropic.Beta.BetaMessage[] = [];
  const modelo: Modelo = async (p) => {
    pedidos.push(structuredClone(p));
    const r = respuestas.shift();
    if (!r) throw new Error("la IA no tenía que contestar acá");
    return r;
  };
  const s: Servicios = { almacen: datos.almacen, chatwoot, crm, modelo, dormir: async () => {}, ahora: () => reloj };
  let id = 0;
  /** La persona escribe: queda en el historial (como lo guarda el webhook) y la atiende el asistente. */
  const escribe = async (texto: string, conversacion = 7, linea: Linea | null = LINEA_3) => {
    const m: MensajeHistorial = { id: ++id, conversacion, rol: "interesado", texto, fecha: reloj.toISOString() };
    await datos.almacen.guardarMensaje(m);
    const a: Responder = { tipo: "responder", conversacion, mensaje: m.id, texto, audios: [], adjuntos: [], contacto: { nombre: "Ana Prueba", telefono: "5491155550000" }, bandeja: 1 };
    return atender(s, a, linea);
  };
  /** Lo que mandó el bot vuelve como aviso de Chatwoot (queda en el historial). */
  const ecoDelBot = async (texto: string, conversacion = 7) => datos.almacen.guardarMensaje({ id: ++id, conversacion, rol: "bot", texto, fecha: reloj.toISOString() });
  return { datos, hechos, pestanias, s, escribe, ecoDelBot, respuestas, pedidos, pasar: (h: number) => (reloj = hora(h)) };
}

describe("flujos en una conversación de verdad", () => {
  it("una persona nueva: el flujo la saluda, manda el brochure, la anota en el CRM y espera", async () => {
    const x = armar();
    expect(await x.escribe("Hola, quiero info de Lerma")).toMatch(/^flujo «Presentación»: espera la respuesta hasta el 17\/11/);
    expect(x.hechos).toEqual(["enviar 7: ¡Hola Ana! Te escribimos desde Mindlin Developers.", "archivo 7: brochure-lerma.pdf «Te dejo el brochure de Lerma 439.»"]);
    // Nombró Lerma: la conversación queda con ese proyecto y la persona, en el CRM.
    expect(x.datos.conversaciones.get(7)).toMatchObject({ proyecto: "lerma-439", linea: "linea-3", bandeja: 1 });
    const [fila] = x.pestanias["CRM Contactos"];
    expect([fila[2], fila[1], fila[ETAPA]]).toEqual(["Ana Prueba", "lerma-439", "Contacto inicial"]);
    expect(x.pestanias["CRM Actividad"][0][5]).toBe("Alta por WhatsApp (línea «Leads entrantes»). Arrancó el flujo «Presentación».");
    expect(x.datos.corridas[0]).toMatchObject({ estado: "esperando", posicion: "3", vence: "2026-11-17T13:00:00.000Z" });
    expect(x.datos.registro.filter((r) => r.tipo === "flujo").map((r) => r.detalle)).toEqual([
      "Arrancó el flujo «Presentación».",
      expect.stringMatching(/^Flujo «Presentación»: mandó 2 mensajes y espera la respuesta hasta el 17\/11/),
    ]);
  });

  it("si responde, sigue por «Si responde»: lo mueve a Seguimiento y pasa al equipo", async () => {
    const x = armar();
    await x.escribe("Hola, quiero info de Lerma");
    await x.ecoDelBot("¡Hola Ana! Te escribimos desde Mindlin Developers.");
    x.pasar(3);
    expect(await x.escribe("¡Gracias! ¿Tienen 2 ambientes?")).toBe("flujo «Presentación»: pasó al equipo");
    expect(x.hechos.slice(2)).toEqual(["nota 7: 🙋 El asistente pasó esta conversación al equipo: El flujo «Presentación» pasó la conversación al equipo.", "abrir 7"]);
    expect(x.pestanias["CRM Contactos"][0][ETAPA]).toBe("Seguimiento");
    expect(x.datos.corridas[0]).toMatchObject({ estado: "terminado", resultado: "equipo", respondio: hora(3).toISOString() });
    expect(x.pedidos).toEqual([]);
  });

  it("si no responde, el cron hace el seguimiento al día siguiente y, si sigue sin responder, termina", async () => {
    const x = armar();
    await x.escribe("Hola, quiero info de Lerma");
    await x.ecoDelBot("¡Hola Ana! Te escribimos desde Mindlin Developers.");
    // Al día siguiente a las 10 (13 UTC), la espera de 24 h vence (con el margen de media corrida).
    x.pasar(24);
    const r = await correrSeguimientos({ ...x.s, ahora: hora(24) });
    expect(r).toMatchObject({ flujos: 1, enviados: 0 });
    expect(x.hechos.at(-1)).toBe("enviar 7: ¿Pudiste ver lo de Lerma 439?");
    expect(x.pestanias["CRM Contactos"][0][ETAPA]).toBe("En pausa");
    expect(x.datos.corridas[0]).toMatchObject({ estado: "esperando", posicion: "3.no.2" });
    // Otra vez a las 10 del día siguiente: termina, sin mandar nada.
    x.pasar(48);
    await correrSeguimientos({ ...x.s, ahora: hora(48) });
    expect(x.datos.corridas[0]).toMatchObject({ estado: "terminado", resultado: "fin" });
    expect(x.hechos).toHaveLength(3);
    // Escribe una semana después: lo atiende el equipo.
    x.pasar(200);
    expect(await x.escribe("Hola, ¿sigue disponible?")).toBe("pasó al equipo: escribió después de que terminó el flujo");
    expect(x.hechos.slice(-2)).toEqual(["nota 7: 🙋 El asistente pasó esta conversación al equipo: La persona escribió después de que terminó el flujo «Presentación».", "abrir 7"]);
    // El equipo se la devuelve (la pone pendiente: el webhook lo anota antes de que escriba): contesta la IA.
    await x.datos.almacen.volvioAlBot(7);
    await x.datos.almacen.registrar({ tipo: "volvio_al_bot", conversacion: 7, detalle: "El equipo le devolvió la conversación al asistente (la puso pendiente)." });
    x.pasar(201);
    x.respuestas.push(respuesta([{ type: "text", text: "¡Hola Ana! Sí, sigue disponible." }]));
    expect(await x.escribe("¿Hola?")).toBe("respondió");
    x.respuestas.push(respuesta([{ type: "text", text: "Se entrega en 2027." }]));
    expect(await x.escribe("¿Y cuándo se entrega?")).toBe("respondió");
  });

  it("«no me escriban más» mientras el flujo espera: se corta, no sigue por «Si responde» y la IA confirma una vez", async () => {
    const x = armar();
    await x.escribe("Hola, quiero info de Lerma");
    await x.ecoDelBot("¡Hola Ana! Te escribimos desde Mindlin Developers.");
    x.pasar(3);
    x.respuestas.push(respuesta([{ type: "text", text: "Entendido, no te escribimos más. Si algún día querés info, escribinos por acá." }]));
    expect(await x.escribe("No me escriban más, gracias")).toBe("respondió");
    // Ni «Seguimiento» ni pase al equipo (lo que hacía «Si responde»): solo la respuesta corta de la IA.
    expect(x.hechos.slice(2)).toEqual(["enviar 7: Entendido, no te escribimos más. Si algún día querés info, escribinos por acá."]);
    expect(JSON.stringify(x.pedidos[0])).toContain("no le vamos a escribir más");
    expect(x.datos.corridas[0]).toMatchObject({ estado: "terminado", resultado: "cancelado" });
    expect(x.pestanias["CRM Contactos"][0][ETAPA]).toBe("Contacto inicial");
    expect(x.pestanias["CRM Actividad"].at(-1)![5]).toMatch(/^Pidió que no le escriban más por WhatsApp/);
    expect(x.datos.registro.filter((r) => r.tipo === "pidio_baja")).toHaveLength(1);
    expect(x.datos.conversaciones.get(7)?.pidio_baja).toBe(hora(3).toISOString());

    // Al día siguiente el cron no le manda nada.
    x.pasar(24);
    expect(await correrSeguimientos({ ...x.s, ahora: hora(24) })).toMatchObject({ flujos: 0, enviados: 0 });
    expect(x.hechos).toHaveLength(3);
    // Si vuelve a escribir, le contesta la IA como siempre (sin la consigna) y la baja sigue.
    x.pasar(30);
    x.respuestas.push(respuesta([{ type: "text", text: "¡Hola Ana! Sí, sigue disponible." }]));
    expect(await x.escribe("Hola, ¿sigue disponible la 2C?")).toBe("respondió");
    expect(JSON.stringify(x.pedidos[1])).not.toContain("no le vamos a escribir más");
    expect(x.datos.registro.some((r) => r.tipo === "volvio_al_bot")).toBe(false);
    expect(x.datos.seguimiento.get(7)?.sin_seguimientos).toBe(true);
  });

  it("si la baja llegó mientras el flujo esperaba (la marcó la IA), el cron corta el flujo sin mandar nada", async () => {
    const x = armar();
    await x.escribe("Hola, quiero info de Lerma");
    await x.ecoDelBot("¡Hola Ana! Te escribimos desde Mindlin Developers.");
    await x.datos.almacen.pidioBaja(7, hora(1).toISOString());
    x.pasar(24);
    expect(await correrSeguimientos({ ...x.s, ahora: hora(24) })).toMatchObject({ flujos: 0, enviados: 0 });
    expect(x.hechos).toHaveLength(2);
    expect(x.datos.corridas[0]).toMatchObject({ estado: "terminado", resultado: "cancelado" });
    expect(x.datos.registro.at(-1)?.detalle).toBe("Flujo «Presentación»: se cortó porque la persona pidió que no le escriban más.");
  });

  it("una espera corta no vence antes de tiempo: el margen del cron no pasa de la mitad de la espera", async () => {
    const corta: Paso[] = [
      { tipo: "mensaje", texto: "¡Hola! Te cuento de {{proyecto}}.", archivo: null },
      { tipo: "esperar", horas: 2, si_responde: [{ tipo: "seguir_ia" }], si_no: [{ tipo: "mensaje", texto: "¿Te quedó alguna duda?", archivo: null }, { tipo: "fin" }] },
    ];
    const x = armar({ flujos: [{ id: 1, nombre: "Corta", proyecto: null, pasos: corta, linea: "linea-3" }] });
    // Escribe a las 9:59 (12:59 UTC); la corrida del cron es a las 10.
    x.pasar(-1 / 60);
    await x.escribe("Hola, quiero info de Lerma");
    x.pasar(0);
    expect(await correrSeguimientos({ ...x.s, ahora: hora(0) })).toMatchObject({ flujos: 0 });
    expect(x.hechos).toHaveLength(1);
    // Al día siguiente, sí.
    x.pasar(24);
    expect(await correrSeguimientos({ ...x.s, ahora: hora(24) })).toMatchObject({ flujos: 1 });
    expect(x.hechos.at(-1)).toBe("enviar 7: ¿Te quedó alguna duda?");
  });

  it("si responde al segundo mensaje, conversa la IA", async () => {
    const x = armar();
    await x.escribe("Hola, quiero info de Lerma");
    x.pasar(24);
    await correrSeguimientos({ ...x.s, ahora: hora(24) });
    x.pasar(25);
    x.respuestas.push(respuesta([{ type: "text", text: "¡Hola Ana! Sí, hay 2 ambientes de 45 m²." }]));
    expect(await x.escribe("Sí, perdón. ¿Hay 2 ambientes?")).toBe("flujo «Presentación»: sigue la IA");
    expect(x.hechos.at(-1)).toBe("enviar 7: ¡Hola Ana! Sí, hay 2 ambientes de 45 m².");
    // El mensaje siguiente lo contesta la IA directamente.
    x.respuestas.push(respuesta([{ type: "text", text: "Se entrega en 2027." }]));
    expect(await x.escribe("¿Cuándo se entrega?")).toBe("respondió");
  });

  it("no arranca con quien ya venía hablando, ni en una línea sin flujo: contesta la IA como siempre", async () => {
    const x = armar();
    await x.ecoDelBot("Hola, ¿en qué te ayudo?", 8);
    x.respuestas.push(respuesta([{ type: "text", text: "¡Claro!" }]));
    expect(await x.escribe("Quiero info", 8)).toBe("respondió");

    const y = armar({ flujos: [] });
    y.respuestas.push(respuesta([{ type: "text", text: "¡Hola! ¿Qué buscás?" }]));
    expect(await y.escribe("Hola")).toBe("respondió");
    expect(y.datos.corridas).toEqual([]);
  });

  it("el flujo del proyecto que nombra va antes que el general", async () => {
    const delOtro: Paso[] = [{ tipo: "mensaje", texto: "Hola, te cuento de Otro 1.", archivo: null }, { tipo: "fin" }];
    const x = armar({
      flujos: [
        { id: 1, nombre: "General", proyecto: null, pasos: presentacion, linea: "linea-3" },
        { id: 2, nombre: "Otro 1", proyecto: "otro-1", pasos: delOtro, linea: "linea-3" },
      ],
    });
    expect(await x.escribe("Hola! Me interesa Otro 1")).toBe("flujo «Otro 1»: terminó");
    expect(x.hechos).toEqual(["enviar 7: Hola, te cuento de Otro 1."]);
    expect(x.datos.conversaciones.get(7)?.proyecto).toBe("otro-1");
  });

  it("los seguimientos por reglas no le escriben a quien lleva un flujo", async () => {
    const x = armar();
    await x.escribe("Hola, quiero info de Lerma");
    await x.ecoDelBot("¡Hola Ana! Te escribimos desde Mindlin Developers.");
    expect(await x.datos.almacen.candidatosSeguimiento(hora(100).toISOString())).toEqual([]);
  });

  it("si el equipo toma la conversación, el flujo se corta", async () => {
    const x = armar();
    await x.escribe("Hola, quiero info de Lerma");
    const { laTomoUnaPersona } = await import("../agente/servicio");
    await laTomoUnaPersona(x.s, 7);
    expect(x.datos.corridas[0]).toMatchObject({ estado: "terminado", resultado: "cancelado" });
    expect(await correrSeguimientos({ ...x.s, ahora: hora(24) })).toMatchObject({ flujos: 0 });
  });

  it("si falla en el medio, pasa al equipo con una nota y queda anotado", async () => {
    const x = armar();
    x.s.chatwoot.enviarArchivo = async () => {
      throw new Error("413 muy pesado");
    };
    x.s.chatwoot.notaInterna = async (c, t) => void x.hechos.push(`nota ${c}: ${t.split("\n")[0]}`);
    // El archivo no sale, pero el texto sí (y queda el error): el flujo sigue.
    expect(await x.escribe("Hola")).toMatch(/espera la respuesta/);
    expect(x.hechos).toContain("enviar 7: Te dejo el brochure del proyecto.");
    expect(x.datos.registro.find((r) => r.tipo === "error")?.detalle).toBe("No salió el archivo «brochure-lerma.pdf»: 413 muy pesado");

    const y = armar();
    y.s.chatwoot.enviar = async () => {
      throw new Error("Chatwoot caído");
    };
    expect(await y.escribe("Hola")).toBe("flujo con error: Chatwoot caído");
    expect(y.datos.corridas[0]).toMatchObject({ estado: "terminado", resultado: "error" });
    expect(y.hechos).toEqual(["nota 7: 🙋 El asistente pasó esta conversación al equipo: El flujo «Presentación» tuvo un error y no pudo seguir.", "abrir 7"]);
  });
});

describe("de qué campaña viene cada lead", () => {
  const TAGS = COLUMNAS_CONTACTOS.indexOf("Tags");
  const meta: Campania = { id: 1, nombre: "Meta Lerma nov", linea: null, frases: ["Quiero más información sobre Lerma"], activa: true };

  it("con el primer mensaje: queda en la conversación, como etiqueta del lead nuevo y en la nota de alta; después no cambia", async () => {
    const x = armar({ campanias: [meta] });
    expect(await x.escribe("¡Hola! Quiero mas informacion sobre Lerma 439")).toMatch(/^flujo «Presentación»/);
    expect(x.datos.conversaciones.get(7)).toMatchObject({ campania: "Meta Lerma nov", campania_por: "frase" });
    expect(x.pestanias["CRM Contactos"][0][TAGS]).toBe("Campaña: Meta Lerma nov");
    expect(x.pestanias["CRM Actividad"][0][5]).toBe("Alta por WhatsApp (línea «Leads entrantes», campaña «Meta Lerma nov»). Arrancó el flujo «Presentación».");
  });

  it("sin frase que coincida, la campaña de la línea; y el que ya estaba en el CRM solo suma una nota (sus etiquetas no se tocan)", async () => {
    const lineas = LINEAS_DE_FABRICA.map((l) => (l.id === "linea-3" ? { ...l, campania: "Leads 3" } : l));
    const x = armar({ flujos: [], lineas, campanias: [meta] });
    // Ya estaba en el CRM (lo cargó el equipo), con su etiqueta.
    const fila = COLUMNAS_CONTACTOS.map(() => "");
    Object.assign(fila, { [COLUMNAS_CONTACTOS.indexOf("ID")]: "cviejo", [COLUMNAS_CONTACTOS.indexOf("Nombre")]: "Ana Prueba", [COLUMNAS_CONTACTOS.indexOf("Teléfono")]: "+5491155550000", [ETAPA]: "Seguimiento", [TAGS]: "Referida" });
    x.pestanias["CRM Contactos"].push(fila);
    x.respuestas.push(respuesta([{ type: "text", text: "¡Hola Ana! ¿En qué te ayudo?" }]));
    expect(await x.escribe("Buenas, ¿tienen 2 ambientes?", 7, lineas[2])).toBe("respondió");
    expect(x.datos.conversaciones.get(7)).toMatchObject({ campania: "Leads 3", campania_por: "linea" });
    expect(x.pestanias["CRM Contactos"]).toHaveLength(1);
    expect(x.pestanias["CRM Contactos"][0][TAGS]).toBe("Referida");
    expect(x.pestanias["CRM Actividad"].map((f) => f[5])).toEqual(["Escribió por WhatsApp (línea «Leads entrantes», campaña «Leads 3»)."]);
    // El mensaje siguiente no la cambia ni vuelve a anotar nada, aunque nombre otra campaña.
    x.respuestas.push(respuesta([{ type: "text", text: "Sí, hay." }]));
    await x.escribe("Quiero más información sobre Lerma", 7, lineas[2]);
    expect(x.datos.conversaciones.get(7)?.campania).toBe("Leads 3");
    expect(x.pestanias["CRM Actividad"]).toHaveLength(1);
  });
});

describe("aviso al responsable cuando pasa al equipo", () => {
  it("el aviso al hub lleva quién es, el motivo, el responsable del CRM, la línea y el proyecto; si el hub no responde, queda en el registro", async () => {
    const x = armar();
    const avisos: unknown[] = [];
    x.s.avisarAlEquipo = async (a) => void avisos.push(a);
    await x.escribe("Hola, quiero info de Lerma");
    await x.ecoDelBot("¡Hola Ana! Te escribimos desde Mindlin Developers.");
    x.pasar(3);
    expect(await x.escribe("¡Gracias! ¿Tienen 2 ambientes?")).toBe("flujo «Presentación»: pasó al equipo");
    const id = x.pestanias["CRM Contactos"][0][0];
    expect(avisos).toEqual([
      {
        conversacion: 7,
        nombre: "Ana Prueba",
        telefono: "5491155550000",
        motivo: "El flujo «Presentación» pasó la conversación al equipo.",
        resumen: "Respondió a la presentación.",
        responsable: "Tadeo",
        contacto: id,
        proyecto: "lerma-439",
        linea: "Leads entrantes",
      },
    ]);

    const y = armar();
    y.s.avisarAlEquipo = async () => {
      throw new Error("el hub respondió 502");
    };
    await y.escribe("Hola, quiero info de Lerma");
    y.pasar(3);
    expect(await y.escribe("Sí, quiero ver el showroom")).toBe("flujo «Presentación»: pasó al equipo");
    expect(y.datos.registro.find((r) => r.tipo === "error")?.detalle).toBe("Aviso al hub: el hub respondió 502");
  });
});

