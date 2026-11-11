import { describe, expect, it } from "vitest";
import { aplicarCeldas, lerma } from "../../test/fixtures";
import type { Chatwoot } from "../chatwoot/api";
import type { MensajeHistorial } from "../chatwoot/evento";
import { COLUMNAS_CONTACTOS, crearCRM, type Hoja } from "../crm/planilla";
import { almacenEnMemoria } from "../datos/memoria";
import type { ReglaSeguimiento } from "../datos/tipos";
import { REGLAS_POR_DEFECTO, type ReglasEtapa } from "../etapas/reglas";
import { correrSeguimientos } from "./correr";
import { elegirRegla, enHorario, nombreDePila, pasaronLosDias, textoSeguimiento } from "./reglas";

const regla = (cambios: Partial<ReglaSeguimiento> = {}): ReglaSeguimiento => ({
  id: 1,
  etapa: "Nuevo",
  paso: 1,
  dias_sin_respuesta: 2,
  version: 1,
  estado: "activa",
  proyecto: null,
  mensaje: "Hola {{nombre}}, ¿pudiste ver lo de {{proyecto}}?",
  ...cambios,
});

// Martes 10/11/2026 a las 11 de Buenos Aires (14 UTC).
const AHORA = new Date("2026-11-10T14:00:00Z");
const haceDias = (dias: number, minuto = 0) => new Date(AHORA.getTime() - dias * 86_400_000 + minuto * 60_000).toISOString();

describe("reglas de seguimiento", () => {
  it("solo de 9 a 20 en Buenos Aires", () => {
    expect(enHorario(new Date("2026-11-10T12:00:00Z"))).toBe(true); // 9:00
    expect(enHorario(new Date("2026-11-10T11:59:00Z"))).toBe(false); // 8:59
    expect(enHorario(new Date("2026-11-10T22:59:00Z"))).toBe(true); // 19:59
    expect(enHorario(new Date("2026-11-10T23:00:00Z"))).toBe(false); // 20:00
  });

  it("elige la regla del proyecto si hay; si no, la general; nunca una archivada ni de otra etapa", () => {
    const reglas = [
      regla({ id: 1 }),
      regla({ id: 2, proyecto: "lerma-439" }),
      regla({ id: 3, etapa: "Contacto inicial" }),
      regla({ id: 4, paso: 2 }),
      regla({ id: 5, proyecto: "otro-1", estado: "archivada" }),
    ];
    expect(elegirRegla(reglas, { etapa: "Nuevo", paso: 1, proyecto: "lerma-439", conversacion: 7 })?.id).toBe(2);
    expect(elegirRegla(reglas, { etapa: "nuevo", paso: 1, proyecto: "otro-1", conversacion: 7 })?.id).toBe(1);
    expect(elegirRegla(reglas, { etapa: "Contacto inicial", paso: 1, proyecto: null, conversacion: 7 })?.id).toBe(3);
    expect(elegirRegla(reglas, { etapa: "Nuevo", paso: 2, proyecto: null, conversacion: 7 })?.id).toBe(4);
    expect(elegirRegla(reglas, { etapa: "Nuevo", paso: 3, proyecto: null, conversacion: 7 })).toBeNull();
    expect(elegirRegla(reglas, { etapa: "Negociación", paso: 1, proyecto: null, conversacion: 7 })).toBeNull();
  });

  it("reparte las versiones por partes iguales y a cada conversación le toca siempre la misma", () => {
    const reglas = [regla({ id: 10, version: 1 }), regla({ id: 11, version: 2, estado: "a_prueba" })];
    const elegida = (conversacion: number) => elegirRegla(reglas, { etapa: "Nuevo", paso: 1, proyecto: null, conversacion })!.id;
    expect([1, 2, 3, 4].map(elegida)).toEqual([11, 10, 11, 10]);
    expect(elegida(3)).toBe(elegida(3));
  });

  it("espera los días de la regla desde lo último que le mandamos", () => {
    expect(pasaronLosDias({ ultima_salida: haceDias(2) }, { dias_sin_respuesta: 2 }, AHORA)).toBe(true);
    expect(pasaronLosDias({ ultima_salida: haceDias(2, 1) }, { dias_sin_respuesta: 2 }, AHORA)).toBe(false);
  });

  it("arma el mensaje con el nombre de pila y el proyecto, y sin nombre no queda raro", () => {
    expect(textoSeguimiento("Hola {{nombre}}, ¿pudiste ver lo de {{proyecto}}?", { nombre: "Ana", proyecto: "Lerma 439" })).toBe("Hola Ana, ¿pudiste ver lo de Lerma 439?");
    expect(textoSeguimiento("Hola {{nombre}}, ¿pudiste ver lo de {{proyecto}}?", { nombre: "", proyecto: "" })).toBe("Hola, ¿pudiste ver lo del proyecto?");
    expect(textoSeguimiento("¿Te interesa ir a {{proyecto}}? {{proyecto}} tiene cocheras.", { nombre: "", proyecto: "" })).toBe("¿Te interesa ir al proyecto? el proyecto tiene cocheras.");
    expect(textoSeguimiento("¿Te interesa ir a {{proyecto}}?", { nombre: "", proyecto: "Lerma 439" })).toBe("¿Te interesa ir a Lerma 439?");
    expect(textoSeguimiento("{{nombre}}, ¿seguís buscando?", { nombre: "", proyecto: "" })).toBe("¿seguís buscando?");
    expect(["ANA maría", "  juan ", "WhatsApp +5491155550000", "+54 9 11", "🌸 Flor", "Ñandú", "", null].map(nombreDePila)).toEqual(["Ana", "Juan", "", "", "", "Ñandú", "", ""]);
  });
});

function preparar({ reglas = [regla()], contactos = [] as string[][], etapas = {} as ReglasEtapa } = {}) {
  const datos = almacenEnMemoria({ proyectos: [lerma()], reglas, etapas });
  const hechos: string[] = [];
  let falla = false;
  const chatwoot: Chatwoot = {
    async enviar(c, t) {
      if (falla) throw new Error("Chatwoot no responde");
      hechos.push(`enviar ${c}: ${t}`);
      return 900 + c;
    },
    async notaInterna() {},
    async pasarAPersona() {},
    async bajarAdjunto() {
      return new Blob();
    },
  };
  const pestanias: Record<string, string[][]> = { "CRM Contactos": contactos, "CRM Actividad": [] };
  let crmCaido = false;
  const hoja: Hoja = {
    async leer() {
      if (crmCaido) throw new Error("Google no responde");
      return pestanias["CRM Contactos"];
    },
    async agregar(p, filas) {
      pestanias[p].push(...filas);
    },
    async actualizar(celdas) {
      aplicarCeldas(pestanias, celdas);
    },
  };
  const crm = crearCRM(hoja);
  /** Una conversación del bot: el interesado escribió hace `dias` días y el bot le contestó un minuto después. */
  const charla = async (conversacion: number, dias: number, cambios: { nombre?: string; telefono?: string } = {}) => {
    const m = (id: number, rol: MensajeHistorial["rol"], minuto: number): MensajeHistorial => ({ id, conversacion, rol, texto: rol, fecha: haceDias(dias, minuto) });
    await datos.almacen.guardarMensaje(m(conversacion * 10, "interesado", 0));
    await datos.almacen.guardarMensaje(m(conversacion * 10 + 1, "bot", 1));
    await datos.almacen.guardarConversacion({ chatwoot_id: conversacion, proyecto: "lerma-439", nombre: cambios.nombre ?? "Ana Prueba", telefono: cambios.telefono ?? "5491155550000" });
  };
  const correr = (ahora = AHORA) => correrSeguimientos({ almacen: datos.almacen, chatwoot, crm, ahora });
  return { datos, hechos, pestanias, charla, correr, fallarChatwoot: () => (falla = true), caerCRM: () => (crmCaido = true) };
}

const filaCRM = (cambios: Partial<Record<(typeof COLUMNAS_CONTACTOS)[number], string>>) => COLUMNAS_CONTACTOS.map((c) => cambios[c] ?? "");

describe("la corrida de seguimientos", () => {
  it("le escribe a quien dejó de responder, por Chatwoot, y lo anota para medir y en el CRM", async () => {
    const p = preparar({ contactos: [filaCRM({ ID: "c1", Nombre: "Ana María Prueba", Teléfono: "+54 9 11 5555-0000", Etapa: "Nuevo" })] });
    await p.charla(7, 3);
    expect(await p.correr()).toEqual({ estado: "listo", revisadas: 1, enviados: 1, errores: 0, movidos: 0 });
    expect(p.hechos).toEqual(["enviar 7: Hola Ana, ¿pudiste ver lo de Lerma 439?"]);
    expect(p.datos.enviados).toMatchObject([{ conversacion: 7, regla: 1, etapa: "Nuevo", paso: 1, version: 1, mensaje_id: 907, respondio: null }]);
    expect(p.datos.registro.map((r) => r.tipo)).toEqual(["seguimiento"]);
    expect(p.pestanias["CRM Actividad"][0][5]).toBe("Seguimiento automático (1.º): Hola Ana, ¿pudiste ver lo de Lerma 439?");
    // La corrida siguiente no repite: el paso 2 no tiene regla.
    expect((await p.correr()).enviados).toBe(0);
  });

  it("si el CRM no tiene el nombre (lo dio de alta el asistente sin nombre), usa el que la persona le dijo", async () => {
    const p = preparar({ contactos: [filaCRM({ ID: "c1", Nombre: "WhatsApp +5491155550000", Teléfono: "+5491155550000", Etapa: "Nuevo" })] });
    await p.charla(7, 3, { nombre: "🌸" });
    await p.datos.almacen.guardarConversacion({ chatwoot_id: 7, interesado: { nombre: "beatriz gómez" } });
    await p.correr();
    expect(p.hechos).toEqual(["enviar 7: Hola Beatriz, ¿pudiste ver lo de Lerma 439?"]);
  });

  it("etapas automáticas: si no responde a ningún seguimiento pasa a «En pausa»; y un seguimiento puede mover de etapa", async () => {
    const etapa = (p: ReturnType<typeof preparar>) => p.pestanias["CRM Contactos"][0][COLUMNAS_CONTACTOS.indexOf("Etapa")];
    const p = preparar({ contactos: [filaCRM({ ID: "c1", Nombre: "Ana", Teléfono: "+5491155550000", Etapa: "Nuevo" })], etapas: REGLAS_POR_DEFECTO });
    await p.charla(7, 3);
    // Sale el único seguimiento (de fábrica, mandar un seguimiento no mueve a nadie).
    expect(await p.correr()).toMatchObject({ enviados: 1, movidos: 0 });
    expect(etapa(p)).toBe("Nuevo");
    // A los 15 minutos todavía no pasó un día desde el seguimiento: no se mueve.
    expect(await p.correr(new Date(AHORA.getTime() + 15 * 60_000))).toMatchObject({ enviados: 0, movidos: 0 });
    // Pasó más de un día sin respuesta y no hay otro paso: «En pausa», anotado en la actividad. Una sola vez.
    const despues = new Date(AHORA.getTime() + 26 * 3600_000);
    expect(await p.correr(despues)).toMatchObject({ enviados: 0, movidos: 1 });
    expect(etapa(p)).toBe("En pausa");
    expect(p.pestanias["CRM Actividad"].at(-1)!.slice(4, 6)).toEqual(["Cambio de etapa", "Nuevo → En pausa. Automático: no respondió a ningún seguimiento"]);
    expect(await p.correr(new Date(despues.getTime() + 15 * 60_000))).toMatchObject({ movidos: 0 });

    // Como en Kommo: que el seguimiento lo mueva de etapa al salir.
    const kommo = preparar({ contactos: [filaCRM({ ID: "c1", Nombre: "Ana", Teléfono: "+5491155550000", Etapa: "Nuevo" })], etapas: { seguimiento_enviado: "Seguimiento" } });
    await kommo.charla(7, 3);
    expect(await kommo.correr()).toMatchObject({ enviados: 1, movidos: 1 });
    expect(etapa(kommo)).toBe("Seguimiento");
  });

  it("no escribe antes de los días de la regla, fuera de horario ni sin reglas", async () => {
    const p = preparar();
    await p.charla(7, 1.5);
    expect((await p.correr()).enviados).toBe(0);
    await p.charla(8, 3);
    expect((await p.correr(new Date("2026-11-10T02:00:00Z"))).estado).toBe("fuera de horario");
    expect((await preparar({ reglas: [] }).correr()).estado).toBe("sin reglas");
    expect(p.hechos).toEqual([]);
  });

  it("no le escribe a quien respondió, ni si una persona del equipo tomó la conversación", async () => {
    const p = preparar();
    await p.charla(7, 3);
    // El interesado escribió último (el bot le debe la respuesta): no es un silencio suyo.
    await p.datos.almacen.guardarMensaje({ id: 9001, conversacion: 7, rol: "interesado", texto: "¿Hola?", fecha: haceDias(2.5) });
    await p.charla(8, 3);
    await p.datos.almacen.guardarMensaje({ id: 9002, conversacion: 8, rol: "persona", texto: "Hola, soy Mati", fecha: haceDias(2.9) });
    await p.charla(9, 3);
    await p.datos.almacen.sinSeguimientos(9);
    expect(await p.correr()).toMatchObject({ revisadas: 0, enviados: 0 });
  });

  it("si responde, se anota en el seguimiento (para medir la versión) y el paso vuelve a empezar", async () => {
    const p = preparar({ reglas: [regla(), regla({ id: 2, paso: 2, dias_sin_respuesta: 3, mensaje: "¿Seguís buscando?" })] });
    await p.charla(7, 3);
    await p.correr();
    expect(p.datos.seguimiento.get(7)?.paso_seguimiento).toBe(1);
    await p.datos.almacen.guardarMensaje({ id: 9001, conversacion: 7, rol: "interesado", texto: "Sí, perdón", fecha: AHORA.toISOString() });
    expect(p.datos.enviados[0].respondio).toBe(AHORA.toISOString());
    expect(p.datos.seguimiento.get(7)?.paso_seguimiento).toBe(0);
  });

  it("sigue con el paso 2 cuando pasan sus días desde el primero", async () => {
    const p = preparar({ reglas: [regla(), regla({ id: 2, paso: 2, dias_sin_respuesta: 3, mensaje: "¿Seguís buscando?" })] });
    await p.charla(7, 3);
    await p.correr();
    expect((await p.correr(new Date(AHORA.getTime() + 2 * 86_400_000))).enviados).toBe(0);
    expect((await p.correr(new Date(AHORA.getTime() + 3 * 86_400_000))).enviados).toBe(1);
    expect(p.hechos.at(-1)).toBe("enviar 7: ¿Seguís buscando?");
  });

  it("usa la etapa del CRM: a quien está en otra etapa le toca otra regla (o ninguna)", async () => {
    const p = preparar({
      reglas: [regla(), regla({ id: 2, etapa: "Contacto inicial", mensaje: "¿Te paso los planos?" })],
      contactos: [filaCRM({ ID: "c1", Teléfono: "+5491155550000", Etapa: "Contactado" }), filaCRM({ ID: "c2", Teléfono: "+5491166660000", Etapa: "Negociación" })],
    });
    await p.charla(7, 3);
    await p.charla(8, 3, { telefono: "5491166660000" });
    await p.correr();
    // «Contactado» es la etapa de antes de «Contacto inicial».
    expect(p.hechos).toEqual(["enviar 7: ¿Te paso los planos?"]);
  });

  it("si el CRM no responde, no manda nada; si Chatwoot falla, no lo repite", async () => {
    const caido = preparar();
    await caido.charla(7, 3);
    caido.caerCRM();
    expect((await caido.correr()).estado).toBe("sin CRM");
    expect(caido.hechos).toEqual([]);

    const p = preparar();
    await p.charla(7, 3);
    p.fallarChatwoot();
    expect(await p.correr()).toMatchObject({ enviados: 0, errores: 1 });
    expect((await p.correr()).revisadas).toBe(0);
    expect(p.datos.registro.at(-1)?.detalle).toContain("Chatwoot no responde");
  });

  it("con el asistente pausado no sale ninguno", async () => {
    const p = preparar();
    await p.charla(7, 3);
    p.datos.estado.pausado = true;
    expect((await p.correr()).estado).toBe("pausado");
    expect(p.hechos).toEqual([]);
  });

  it("como mucho TOPE por corrida", async () => {
    const p = preparar();
    for (let c = 1; c <= 5; c++) await p.charla(c, 3, { telefono: `54911555500${c}0` });
    const r = await correrSeguimientos({ almacen: p.datos.almacen, chatwoot: stubChatwoot(p.hechos), crm: null, ahora: AHORA, tope: 2 });
    expect(r.enviados).toBe(2);
  });
});

function stubChatwoot(hechos: string[]): Chatwoot {
  return {
    async enviar(c, t) {
      hechos.push(`enviar ${c}: ${t}`);
      return 1;
    },
    async notaInterna() {},
    async pasarAPersona() {},
    async bajarAdjunto() {
      return new Blob();
    },
  };
}
