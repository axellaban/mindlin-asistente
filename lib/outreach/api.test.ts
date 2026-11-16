import { describe, expect, it } from "vitest";
import { manejarOutreach, type DependenciasOutreach } from "./api";
import type { DatosOutreach } from "./datos";
import { CONFIG_OUTREACH_DE_FABRICA as F } from "./reglas";
import type { Linea } from "../lineas";

/** Las direcciones y lo que se valida antes de tocar la base (la base, en datos.test.ts). */
function armar() {
  const llamadas: [string, unknown[]][] = [];
  const anotar =
    (nombre: string, devuelve: unknown = { ok: true }) =>
    async (...args: unknown[]) => {
      llamadas.push([nombre, args]);
      return devuelve;
    };
  const outreach = {
    config: async () => F,
    guardarConfig: anotar("guardarConfig"),
    estado: anotar("estado", { linea: "linea-1" }),
    lotes: anotar("lotes", []),
    vistaPrevia: anotar("vistaPrevia", { columnas: {}, otras: [], totales: {}, filas: [] }),
    crearLote: anotar("crearLote", { lote: 1, totales: {}, guardados: 1 }),
    contactos: anotar("contactos", []),
    cola: anotar("cola", []),
    tomar: anotar("tomar", { vacia: true }),
    confirmar: anotar("confirmar", { ok: true, ya_estaba: false }),
    fallo: anotar("fallo", { ok: true, frenada: false }),
    soltar: anotar("soltar", true),
    saltar: anotar("saltar", true),
    seguir: anotar("seguir"),
    mandarIgualHoy: anotar("mandarIgualHoy"),
    pausarLote: anotar("pausarLote", true),
    borrarLote: anotar("borrarLote", false),
    corregirTelefono: anotar("corregirTelefono", { error: "Ese teléfono no sirve: falta el código de área." }),
  } as unknown as DatosOutreach;
  const lineas: Record<string, Partial<Linea>> = { "linea-1": { id: "linea-1", nombre: "Outreach frío", tipo: "outreach_frio" }, "linea-3": { id: "linea-3", nombre: "Leads entrantes", tipo: "entrada" } };
  const d: DependenciasOutreach = { outreach, linea: async (id) => (lineas[id] as Linea) ?? null, contactosCRM: null, ahora: () => new Date("2026-11-16T14:00:00Z") };
  const pedir = (metodo: string, ruta: string, cuerpo: Record<string, unknown> = {}) => manejarOutreach(ruta.split("/"), metodo, cuerpo, "Facu", d);
  return { pedir, llamadas };
}

describe("API del outreach", () => {
  it("el estado de la línea, solo si es de outreach", async () => {
    const { pedir } = armar();
    expect(await pedir("GET", "linea-1")).toEqual({ status: 200, json: { estado: { linea: "linea-1" }, lotes: [] } });
    expect(await pedir("GET", "linea-3")).toEqual({ status: 400, json: { error: "«Leads entrantes» no es una línea de outreach." } });
    expect(await pedir("GET", "linea-9")).toEqual({ status: 404, json: { error: "Esa línea no existe." } });
  });

  it("la configuración se valida antes de guardar", async () => {
    const { pedir, llamadas } = armar();
    expect(await pedir("PUT", "linea-1/config", { mensajes_max: 5 })).toEqual({ status: 400, json: { error: "Mensajes sin respuesta: tiene que ser un número entre 1 y 3." } });
    expect(llamadas).toEqual([]);
    expect((await pedir("PUT", "linea-1/config", { textos_revisados: true })).status).toBe(200);
    expect(llamadas[0][0]).toBe("guardarConfig");
    expect((llamadas[0][1][1] as { textos_revisados: boolean; tope_inicial: number }).textos_revisados).toBe(true);
    expect(llamadas[0][1][2]).toBe("Facu");
  });

  it("tomar pide el modo; confirmar y fallo pasan quién y cómo", async () => {
    const { pedir, llamadas } = armar();
    expect(await pedir("POST", "linea-1/tomar", { modo: "otro" })).toEqual({ status: 400, json: { error: "«modo» tiene que ser waha o computer_use." } });
    expect(await pedir("POST", "linea-1/tomar", { modo: "computer_use" })).toEqual({ status: 200, json: { vacia: true } });
    await pedir("POST", "contactos/7/confirmar", { clave: "k", modo: "computer_use", ejecutor: "bot" });
    expect(llamadas.at(-1)).toEqual(["confirmar", [7, { clave: "k", modo: "computer_use", por: "Facu", ejecutor: "bot" }, new Date("2026-11-16T14:00:00Z")]]);
    expect(await pedir("POST", "contactos/7/fallo", { clave: "k", falla: "otra" })).toEqual({ status: 400, json: { error: "«falla» tiene que ser no_salio, sin_whatsapp o numero_incorrecto." } });
    await pedir("POST", "contactos/7/fallo", { clave: "k", falla: "sin_whatsapp" });
    expect(llamadas.at(-1)).toEqual(["fallo", [7, { clave: "k", falla: "sin_whatsapp", modo: "a_mano", por: "Facu", ejecutor: "persona" }, new Date("2026-11-16T14:00:00Z")]]);
  });

  it("lotes y teléfonos", async () => {
    const { pedir } = armar();
    expect(await pedir("PATCH", "lotes/3", {})).toEqual({ status: 400, json: { error: "Mandá «pausado»: true o false." } });
    expect(await pedir("PATCH", "lotes/3", { pausado: true })).toEqual({ status: 200, json: { ok: true } });
    expect(await pedir("DELETE", "lotes/3")).toEqual({ status: 404, json: { error: "Esa base no existe." } });
    expect(await pedir("PUT", "contactos/3/telefono", { telefono: "4567" })).toEqual({ status: 400, json: { error: "Ese teléfono no sirve: falta el código de área." } });
    expect((await pedir("POST", "linea-1/lotes", { nombre: "Leads", texto: "x" })).status).toBe(201);
  });

  it("direcciones que no existen", async () => {
    const { pedir } = armar();
    expect((await pedir("GET", "linea-1/otra")).status).toBe(404);
    expect((await pedir("GET", "linea-1/tomar")).status).toBe(405);
    expect((await pedir("POST", "contactos/x/confirmar")).status).toBe(404);
    expect((await pedir("GET", "linea-1/a/b/c")).status).toBe(404);
  });
});
