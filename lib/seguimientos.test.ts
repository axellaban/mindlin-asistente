import { describe, expect, it } from "vitest";
import { lerma } from "../test/fixtures";
import type { Chatwoot } from "./chatwoot/api";
import type { ContactoCRM, CRM } from "./crm/planilla";
import { almacenEnMemoria } from "./datos/memoria";
import type { ReglaSeguimiento } from "./datos/tipos";
import { armarMensaje, correrSeguimientos, elegirRegla, enHorario } from "./seguimientos";

// Martes 10/11/2026 a las 12 en Buenos Aires.
const AHORA = new Date("2026-11-10T15:00:00Z");
const dias = (n: number) => new Date(AHORA.getTime() - n * 86_400_000).toISOString();

const regla = (cambios: Partial<ReglaSeguimiento> = {}): ReglaSeguimiento => ({
  id: 1,
  etapa: "Nuevo",
  paso: 1,
  dias_sin_respuesta: 1,
  version: 1,
  estado: "activa",
  proyecto: null,
  mensaje: "Hola {{nombre}}, ¿pudiste ver {{proyecto}}?",
  ...cambios,
});

const REGLAS = [regla(), regla({ id: 2, paso: 2, dias_sin_respuesta: 4, mensaje: "Última vez, {{nombre}}." })];

function armar({ reglas = REGLAS, crm = null as CRM | null } = {}) {
  const datos = almacenEnMemoria({ proyectos: [lerma()], reglas });
  const enviados: string[] = [];
  let id = 900;
  const chatwoot: Chatwoot = {
    async enviar(c, t) {
      enviados.push(`${c}: ${t}`);
      return ++id;
    },
    async notaInterna() {},
    async pasarAPersona() {},
  };
  /** Una conversación: la persona escribió y el bot le contestó hace `hace` días. */
  async function conversacion(n: number, { hace = 2, nombre = "Ana Prueba", extra = [] as { rol: "interesado" | "bot" | "persona"; hace: number }[] } = {}) {
    await datos.almacen.guardarConversacion({ chatwoot_id: n, telefono: `54911555500${n}`, nombre, proyecto: "lerma-439" });
    await datos.almacen.guardarMensaje({ id: n * 10 + 1, conversacion: n, rol: "interesado", texto: "Hola, info de Lerma", fecha: dias(hace + 0.01) });
    await datos.almacen.guardarMensaje({ id: n * 10 + 2, conversacion: n, rol: "bot", texto: "¡Hola! Te cuento…", fecha: dias(hace) });
    let i = 3;
    for (const m of extra) await datos.almacen.guardarMensaje({ id: n * 10 + i++, conversacion: n, rol: m.rol, texto: "…", fecha: dias(m.hace) });
  }
  const correr = (ahora = AHORA) => correrSeguimientos({ almacen: datos.almacen, chatwoot, crm, ahora: () => ahora, dormir: async () => {} });
  return { datos, enviados, conversacion, correr };
}

describe("enHorario", () => {
  it("de lunes a sábado, de 9 a 20 en Buenos Aires", () => {
    expect(enHorario(new Date("2026-11-10T15:00:00Z"))).toBe(true); // martes 12:00
    expect(enHorario(new Date("2026-11-10T11:59:00Z"))).toBe(false); // martes 8:59
    expect(enHorario(new Date("2026-11-10T12:00:00Z"))).toBe(true); // martes 9:00
    expect(enHorario(new Date("2026-11-10T23:00:00Z"))).toBe(false); // martes 20:00
    expect(enHorario(new Date("2026-11-14T15:00:00Z"))).toBe(true); // sábado 12:00
    expect(enHorario(new Date("2026-11-15T15:00:00Z"))).toBe(false); // domingo 12:00
  });
});

describe("armarMensaje", () => {
  it("usa el primer nombre y el proyecto", () => {
    expect(armarMensaje("Hola {{nombre}}, ¿pudiste ver {{proyecto}}?", { nombre: "Ana María Prueba", proyecto: "Lerma 439" })).toBe("Hola Ana, ¿pudiste ver Lerma 439?");
  });
  it("sin nombre no deja «Hola ,»", () => {
    expect(armarMensaje("Hola {{nombre}}, ¿cómo va?", { nombre: "", proyecto: null })).toBe("Hola, ¿cómo va?");
    expect(armarMensaje("{{nombre}} te escribo por {{proyecto}}", { nombre: null, proyecto: null })).toBe("te escribo por el proyecto");
  });
});

describe("elegirRegla", () => {
  const c = { etapa: "nuevo", paso: 1, proyecto: "lerma-439", conversacion: 4 };
  it("ignora mayúsculas y tildes en la etapa y las archivadas", () => {
    expect(elegirRegla([regla({ etapa: "Nuevo" })], c)?.id).toBe(1);
    expect(elegirRegla([regla({ estado: "archivada" })], c)).toBeNull();
    expect(elegirRegla([regla({ etapa: "Contactado" })], c)).toBeNull();
  });
  it("la del proyecto gana a la general", () => {
    expect(elegirRegla([regla({ id: 1 }), regla({ id: 2, proyecto: "lerma-439" })], c)?.id).toBe(2);
    expect(elegirRegla([regla({ id: 1 }), regla({ id: 2, proyecto: "otro" })], c)?.id).toBe(1);
  });
  it("activa y a prueba se reparten por conversación par e impar", () => {
    const reglas = [regla({ id: 1 }), regla({ id: 2, estado: "a_prueba", version: 2 })];
    expect(elegirRegla(reglas, { ...c, conversacion: 4 })?.id).toBe(1);
    expect(elegirRegla(reglas, { ...c, conversacion: 5 })?.id).toBe(2);
  });
});

describe("correrSeguimientos", () => {
  it("manda el paso 1 a quien no volvió a escribir, lo guarda en el historial y lo anota", async () => {
    const { datos, enviados, conversacion, correr } = armar();
    await conversacion(1);
    expect(await correr()).toMatchObject({ enviados: 1, revisados: 1 });
    expect(enviados).toEqual(["1: Hola Ana, ¿pudiste ver Lerma 439?"]);
    expect((await datos.almacen.historial(1, 5)).at(-1)).toMatchObject({ rol: "bot", texto: "Hola Ana, ¿pudiste ver Lerma 439?" });
    expect(datos.registro.at(-1)).toMatchObject({ tipo: "seguimiento", conversacion: 1 });
    // Enseguida no repite: el paso 2 espera 4 días desde el seguimiento.
    expect(await correr()).toMatchObject({ enviados: 0 });
    expect(await correr(new Date(AHORA.getTime() + 4 * 86_400_000))).toMatchObject({ enviados: 1 });
    expect(enviados.at(-1)).toBe("1: Última vez, Ana.");
    // No hay paso 3.
    expect(await correr(new Date(AHORA.getTime() + 10 * 86_400_000))).toMatchObject({ enviados: 0 });
  });

  it("espera los días de la regla", async () => {
    const { enviados, conversacion, correr } = armar();
    await conversacion(1, { hace: 0.5 });
    expect(await correr()).toMatchObject({ enviados: 0 });
    expect(enviados).toEqual([]);
  });

  it("no escribe fuera de horario ni sin reglas activas", async () => {
    const { conversacion, correr } = armar();
    await conversacion(1);
    expect(await correr(new Date("2026-11-10T02:00:00Z"))).toMatchObject({ enviados: 0, motivo: expect.stringContaining("horario") });
    const sinReglas = armar({ reglas: [regla({ estado: "archivada" })] });
    await sinReglas.conversacion(1);
    expect(await sinReglas.correr()).toMatchObject({ enviados: 0, motivo: "no hay reglas activas" });
  });

  it("nunca a una conversación donde escribió una persona del equipo o que tomó el equipo", async () => {
    const { datos, enviados, conversacion, correr } = armar();
    await conversacion(1, { extra: [{ rol: "persona", hace: 1.5 }, { rol: "bot", hace: 1.4 }] });
    await conversacion(2);
    await datos.almacen.permitirSeguimientos(2, false);
    expect(await correr()).toMatchObject({ enviados: 0 });
    expect(enviados).toEqual([]);
  });

  it("si la persona vuelve a escribir, la cuenta de pasos arranca de cero", async () => {
    const { datos, enviados, conversacion, correr } = armar();
    await conversacion(1, { hace: 6 });
    await correr(new Date(AHORA.getTime() - 4 * 86_400_000));
    expect(enviados).toHaveLength(1);
    // Contestó y el bot le respondió hace 2 días: vuelve al paso 1, no al 2.
    await datos.almacen.guardarMensaje({ id: 50, conversacion: 1, rol: "interesado", texto: "Sí, ¿precio?", fecha: dias(2.01) });
    await datos.almacen.guardarMensaje({ id: 51, conversacion: 1, rol: "bot", texto: "Te paso con el equipo…", fecha: dias(2) });
    await correr();
    expect(enviados.at(-1)).toBe("1: Hola Ana, ¿pudiste ver Lerma 439?");
  });

  it("usa la etapa del CRM: si avanzó a otra sin reglas, no manda", async () => {
    const contacto = (etapa: string): ContactoCRM => ({ id: "c1", nombre: "Ana Prueba", telefono: "5491155550001", etapa, responsable: "", proyectos: [] }) as unknown as ContactoCRM;
    const actividad: string[] = [];
    const crm = (etapa: string): CRM =>
      ({
        async buscarPorTelefono() {
          return contacto(etapa);
        },
        async crearContacto() {
          throw new Error("no debería crear");
        },
        async anotarActividad({ detalle }: { detalle: string }) {
          actividad.push(detalle);
        },
      }) as unknown as CRM;
    const enNuevo = armar({ crm: crm("Nuevo") });
    await enNuevo.conversacion(1);
    expect(await enNuevo.correr()).toMatchObject({ enviados: 1 });
    expect(actividad[0]).toContain("Seguimiento automático 1");
    const enPropuesta = armar({ crm: crm("Propuesta enviada") });
    await enPropuesta.conversacion(1);
    expect(await enPropuesta.correr()).toMatchObject({ enviados: 0 });
  });

  it("respeta el tope por corrida", async () => {
    const { datos, enviados, conversacion } = armar();
    for (let n = 1; n <= 4; n++) await conversacion(n);
    const chatwoot: Chatwoot = { enviar: async (c, t) => (enviados.push(`${c}: ${t}`), 1000 + c), notaInterna: async () => {}, pasarAPersona: async () => {} };
    const r = await correrSeguimientos({ almacen: datos.almacen, chatwoot, crm: null, ahora: () => AHORA, dormir: async () => {}, maximo: 3 });
    expect(r).toMatchObject({ enviados: 3, revisados: 4 });
  });

  it("si falla el envío lo anota y sigue con las demás, sin volver a mandar ese paso", async () => {
    const { datos, conversacion } = armar();
    await conversacion(1);
    await conversacion(2, { hace: 1.5 });
    const enviados: number[] = [];
    const chatwoot: Chatwoot = {
      async enviar(c) {
        if (c === 1) throw new Error("Chatwoot respondió 500");
        enviados.push(c);
        return 77;
      },
      notaInterna: async () => {},
      pasarAPersona: async () => {},
    };
    const correr = () => correrSeguimientos({ almacen: datos.almacen, chatwoot, crm: null, ahora: () => AHORA, dormir: async () => {} });
    const r = await correr();
    expect(r.enviados).toBe(1);
    expect(r.errores[0]).toContain("conversación 1");
    expect(enviados).toEqual([2]);
    expect(datos.registro.some((x) => x.tipo === "error" && x.conversacion === 1)).toBe(true);
    await correr();
    expect(enviados).toEqual([2]);
  });
});
