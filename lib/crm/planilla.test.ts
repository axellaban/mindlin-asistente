import { describe, expect, it } from "vitest";
import { claveTelefono, COLUMNAS_CONTACTOS, contactoDeFila, crearCRM, etapaDe, filaContactoNuevo, RANGO_CONTACTOS, type DatosInteresado, type Hoja } from "./planilla";

const AHORA = "2026-11-07T21:00:00.000Z";

function hojaFalsa(contactos: string[][] = []) {
  const pestanias: Record<string, string[][]> = { "CRM Contactos": contactos, "CRM Actividad": [] };
  const hoja: Hoja = {
    async leer(rango) {
      expect(rango).toBe("'CRM Contactos'!A2:AD");
      return pestanias["CRM Contactos"].map((f) => [...f]);
    },
    async agregar(pestania, filas) {
      pestanias[pestania].push(...filas);
    },
  };
  return { hoja, pestanias };
}

const filaDe = (cambios: Partial<Record<(typeof COLUMNAS_CONTACTOS)[number], string>>) =>
  COLUMNAS_CONTACTOS.map((c) => cambios[c] ?? "");

const datos = (cambios: Partial<DatosInteresado> = {}): DatosInteresado => ({
  nombre: "Ana Prueba",
  telefono: "5491155550000",
  proyecto: "lerma-439",
  para: "Vivir",
  ambientes: "2",
  presupuestoUsd: "120000",
  formaDePago: "Contado",
  plazo: "2 a 6 meses",
  notas: "Busca 2 ambientes con balcón.",
  ...cambios,
});

describe("CRM del hub", () => {
  it("encuentra al contacto aunque el teléfono esté escrito distinto", async () => {
    const { hoja } = hojaFalsa([
      filaDe({ ID: "c1", Nombre: "Otro", Teléfono: "11 4444-0000" }),
      filaDe({ ID: "c2", Nombre: "Ana", Teléfono: "+54 9 11 5555-0000", Etapa: "Interesado", Responsable: "Mati", Proyectos: "lerma-439, guemes-4676" }),
    ]);
    const c = await crearCRM(hoja).buscar({ telefono: "5491155550000" });
    // «Interesado» es una etapa de antes de noviembre: se lee como la de ahora, como en el hub.
    expect(c).toMatchObject({ id: "c2", nombre: "Ana", etapa: "Seguimiento", responsable: "Mati", proyectos: ["lerma-439", "guemes-4676"] });
    expect(await crearCRM(hoja).buscar({ telefono: "5491166660000" })).toBeNull();
    expect(await crearCRM(hoja).buscar({ telefono: "123" })).toBeNull();
  });

  it("busca primero por el ID anotado (WhatsApp a veces no pasa el teléfono) y lee lo que ya se sabe", async () => {
    const { hoja } = hojaFalsa([
      filaDe({ ID: "c1", Nombre: "Ana", Teléfono: "", Para: "Invertir", Ambientes: "2", "Presupuesto USD": "90000", "Próximo paso": "Mandar planos" }),
      filaDe({ ID: "c2", Nombre: "Otra", Teléfono: "+54 9 11 5555-0000" }),
    ]);
    const crm = crearCRM(hoja);
    expect(await crm.buscar({ id: "c1", telefono: "" })).toMatchObject({ id: "c1", para: "Invertir", ambientes: "2", presupuestoUsd: "90000", proximoPaso: "Mandar planos" });
    expect(await crm.buscar({ id: "c1", telefono: "5491155550000" })).toMatchObject({ id: "c1" });
    expect(await crm.buscar({ id: "no-esta", telefono: "5491155550000" })).toMatchObject({ id: "c2" });
    expect(await crm.buscar({ id: null, telefono: null })).toBeNull();
  });

  it("da de alta al interesado con las columnas del hub y anota la actividad", async () => {
    const { hoja, pestanias } = hojaFalsa();
    const crm = crearCRM(hoja, { responsable: "Tadeo" });
    const c = await crm.crearContacto(datos(), AHORA);
    await crm.anotarActividad({ contacto: c, detalle: "Consultó por 2 ambientes.", ahora: AHORA });

    const [fila] = pestanias["CRM Contactos"];
    expect(fila).toHaveLength(COLUMNAS_CONTACTOS.length);
    expect(contactoDeFila(fila)).toMatchObject({ nombre: "Ana Prueba", telefono: "+5491155550000", etapa: "Nuevo", responsable: "Tadeo", proyectos: ["lerma-439"] });
    const v = (n: (typeof COLUMNAS_CONTACTOS)[number]) => fila[COLUMNAS_CONTACTOS.indexOf(n)];
    expect([v("Para"), v("Ambientes"), v("Presupuesto USD"), v("Forma de pago"), v("Plazo"), v("Origen")]).toEqual(["Vivir", "2", "120000", "Contado", "2 a 6 meses", "WhatsApp"]);
    expect(v("Notas")).toBe("Entró por WhatsApp (asistente). Busca 2 ambientes con balcón.");
    expect(v("ID")).toMatch(/^c[a-z0-9]+$/);
    expect(pestanias["CRM Actividad"]).toEqual([[AHORA, "Asistente WhatsApp", c.id, "Ana Prueba", "WhatsApp", "Consultó por 2 ambientes.", "Nuevo"]]);
  });

  it("deja vacío lo que no es una opción del hub, y sin nombre usa el teléfono", () => {
    const fila = filaContactoNuevo(datos({ nombre: "", para: "para mi hija", presupuestoUsd: "unos 100 mil", plazo: "ya" }), "c9", AHORA, "");
    const c = contactoDeFila(fila);
    expect(c.nombre).toBe("WhatsApp +5491155550000");
    const v = (n: (typeof COLUMNAS_CONTACTOS)[number]) => fila[COLUMNAS_CONTACTOS.indexOf(n)];
    expect([v("Para"), v("Presupuesto USD"), v("Plazo")]).toEqual(["", "", ""]);
  });

  it("lee las etapas de ahora y las de antes, con o sin acentos", () => {
    expect(["Visita / reunión", "visita/reunion", "NEGOCIACION", "Propuesta enviada", "Dormido", "", "cualquier cosa"].map(etapaDe)).toEqual([
      "Visita / reunión",
      "Visita / reunión",
      "Negociación",
      "Negociación",
      "En pausa",
      "Nuevo",
      "Nuevo",
    ]);
  });

  it("trae todos los contactos de una sola lectura, sin las filas vacías", async () => {
    const { hoja } = hojaFalsa([filaDe({ ID: "c1", Etapa: "Seguimiento" }), filaDe({ Nombre: "Sin ID" }), filaDe({ ID: "c2" })]);
    expect((await crearCRM(hoja).contactos()).map((c) => [c.id, c.etapa])).toEqual([
      ["c1", "Seguimiento"],
      ["c2", "Nuevo"],
    ]);
    expect(RANGO_CONTACTOS).toBe("'CRM Contactos'!A2:AD");
  });

  it("compara los últimos 10 dígitos", () => {
    expect(claveTelefono("+54 9 11 5555-0000")).toBe("1155550000");
    expect(claveTelefono("011 5555 0000")).toBe("1155550000");
  });
});
