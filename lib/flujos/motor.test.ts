import { describe, expect, it } from "vitest";
import type { Paso } from "./modelo";
import { avanzar, type Acciones } from "./motor";

const AHORA = new Date("2026-11-15T14:00:00Z");

/** Acciones de mentira: anotan lo que el motor pide, en orden. */
function acciones({ escribio = [] as boolean[], iaPasa = false, fallaEnviar = false } = {}) {
  const hechos: string[] = [];
  const guardado: Record<string, unknown>[] = [];
  const a: Acciones = {
    async enviar(t, archivo) {
      if (fallaEnviar) throw new Error("Chatwoot no responde");
      hechos.push(`mensaje: ${t}${archivo ? ` +${archivo}` : ""}`);
    },
    async ia(consigna) {
      hechos.push(`ia: ${consigna ?? "(contesta)"}`);
      return { pasar: iaPasa ? { motivo: "quiere visitar", resumen: "" } : null };
    },
    async etapa(e) {
      hechos.push(`etapa: ${e}`);
    },
    async equipo(p) {
      hechos.push(`equipo: ${p.motivo}${p.resumen ? ` (${p.resumen})` : ""}`);
    },
    async dormir(ms) {
      hechos.push(`pausa: ${ms}`);
    },
    async guardar(c) {
      guardado.push(c);
    },
    escribioDeNuevo: async () => escribio.shift() ?? false,
    ahora: () => AHORA,
  };
  return { a, hechos, guardado };
}

const kommo: Paso[] = [
  { tipo: "mensaje", texto: "Hola", archivo: null },
  { tipo: "pausa", segundos: 5 },
  { tipo: "mensaje", texto: "El brochure", archivo: 4 },
  {
    tipo: "esperar",
    horas: 24,
    si_responde: [{ tipo: "etapa", etapa: "Seguimiento" }, { tipo: "equipo", nota: "Respondió a la presentación." }],
    si_no: [{ tipo: "etapa", etapa: "En pausa" }, { tipo: "mensaje", texto: "¿Pudiste verlo?", archivo: null }, { tipo: "esperar", horas: 48, si_responde: [{ tipo: "seguir_ia" }], si_no: [{ tipo: "fin" }] }],
  },
];
const corrida = (posicion = "0", pasos = kommo) => ({ nombre: "Lerma", pasos, posicion });

describe("el motor de los flujos", () => {
  it("arranca: manda los mensajes con sus pausas y queda esperando la respuesta 24 horas", async () => {
    const x = acciones();
    const r = await avanzar(corrida(), "inicio", x.a);
    expect(x.hechos).toEqual(["mensaje: Hola", "pausa: 5000", "mensaje: El brochure +4"]);
    expect(r).toEqual({ estado: "esperando", resultado: null, posicion: "3", vence: "2026-11-16T14:00:00.000Z", enviados: 2 });
    // Antes de cada paso anota que pasó al siguiente: si se corta, no repite un mensaje.
    expect(x.guardado.map((g) => g.posicion)).toEqual(["1", "2", "3", "3"]);
    expect(x.guardado.at(-1)).toEqual({ estado: "esperando", posicion: "3", espera_desde: AHORA.toISOString(), vence: "2026-11-16T14:00:00.000Z" });
  });

  it("si responde: sigue por «Si responde» (mueve de etapa y pasa al equipo)", async () => {
    const x = acciones();
    const r = await avanzar(corrida("3"), "respuesta", x.a);
    expect(x.hechos).toEqual(["etapa: Seguimiento", "equipo: El flujo «Lerma» pasó la conversación al equipo. (Respondió a la presentación.)"]);
    expect(r).toMatchObject({ estado: "terminado", resultado: "equipo" });
  });

  it("si no responde: el seguimiento, otra espera y, al final, termina sin molestar al equipo", async () => {
    const x = acciones();
    const r = await avanzar(corrida("3"), "vencio", x.a);
    expect(x.hechos).toEqual(["etapa: En pausa", "mensaje: ¿Pudiste verlo?"]);
    expect(r).toMatchObject({ estado: "esperando", posicion: "3.no.2", vence: "2026-11-17T14:00:00.000Z" });

    const y = acciones();
    expect(await avanzar(corrida("3.no.2"), "vencio", y.a)).toMatchObject({ estado: "terminado", resultado: "fin" });
    expect(y.hechos).toEqual([]);

    // Responde al segundo: sigue la IA y le contesta lo que escribió.
    const z = acciones();
    expect(await avanzar(corrida("3.no.2"), "respuesta", z.a)).toMatchObject({ estado: "terminado", resultado: "ia" });
    expect(z.hechos).toEqual(["ia: (contesta)"]);
  });

  it("si la persona escribe mientras sale la presentación, ya cuenta como respuesta", async () => {
    const x = acciones({ escribio: [true] });
    const r = await avanzar(corrida(), "inicio", x.a);
    expect(x.hechos.slice(-2)).toEqual(["etapa: Seguimiento", "equipo: El flujo «Lerma» pasó la conversación al equipo. (Respondió a la presentación.)"]);
    expect(r.resultado).toBe("equipo");
  });

  it("nadie queda sin respuesta: si respondió y el camino termina sin decirle nada, pasa al equipo", async () => {
    const pasos: Paso[] = [{ tipo: "mensaje", texto: "Hola", archivo: null }, { tipo: "esperar", horas: 24, si_responde: [], si_no: [] }];
    const x = acciones();
    expect(await avanzar(corrida("1", pasos), "respuesta", x.a)).toMatchObject({ resultado: "equipo" });
    expect(x.hechos).toEqual(["equipo: La persona escribió y el flujo «Lerma» terminó sin contestarle."]);
    // Si no respondió y el camino está vacío, termina tranquilo.
    const y = acciones();
    expect(await avanzar(corrida("1", pasos), "vencio", y.a)).toMatchObject({ resultado: "fin" });
    expect(y.hechos).toEqual([]);
    // Un flujo de solo mensajes que termina: si escribió mientras salían, también pasa al equipo.
    const z = acciones({ escribio: [true] });
    expect(await avanzar(corrida("0", [{ tipo: "mensaje", texto: "Hola", archivo: null }]), "inicio", z.a)).toMatchObject({ resultado: "equipo" });
  });

  it("la IA escribe con su consigna y, si pide pasar al equipo, el flujo termina ahí", async () => {
    const pasos: Paso[] = [{ tipo: "ia", consigna: "Presentá el proyecto." }, { tipo: "mensaje", texto: "No debería salir", archivo: null }];
    const x = acciones({ iaPasa: true });
    expect(await avanzar(corrida("0", pasos), "inicio", x.a)).toMatchObject({ estado: "terminado", resultado: "equipo", posicion: "1" });
    expect(x.hechos).toEqual(["ia: Presentá el proyecto.", "equipo: quiere visitar"]);
  });

  it("«Que siga la IA» al arrancar contesta el primer mensaje; al vencer, espera a que escriba", async () => {
    const pasos: Paso[] = [{ tipo: "mensaje", texto: "Hola", archivo: null }, { tipo: "seguir_ia" }];
    const x = acciones();
    expect(await avanzar(corrida("0", pasos), "inicio", x.a)).toMatchObject({ resultado: "ia", enviados: 2 });
    expect(x.hechos).toEqual(["mensaje: Hola", "ia: (contesta)"]);
    const y = acciones();
    expect(await avanzar(corrida("1", pasos), "reanudar", y.a)).toMatchObject({ resultado: "ia", enviados: 0 });
    expect(y.hechos).toEqual([]);
  });

  it("si falla un envío, el error sube (y el paso ya quedó contado: no se repite)", async () => {
    const x = acciones({ fallaEnviar: true });
    await expect(avanzar(corrida(), "inicio", x.a)).rejects.toThrow("Chatwoot no responde");
    expect(x.guardado).toEqual([{ posicion: "1" }]);
  });

  it("no corre una respuesta si la corrida no está en una espera", async () => {
    await expect(avanzar(corrida("0"), "respuesta", acciones().a)).rejects.toThrow("no está en una espera");
    await expect(avanzar(corrida("9.si.0"), "reanudar", acciones().a)).rejects.toThrow("no existe");
  });
});
