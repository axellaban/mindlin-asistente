import { describe, expect, it } from "vitest";
import { lerma, otroProyecto, tono } from "../../test/fixtures";
import { ficha, instrucciones, situacion } from "./contexto";

describe("contexto del agente", () => {
  it("la ficha marca lo que falta para que no lo invente", () => {
    const f = ficha(lerma());
    expect(f).toContain("## Lerma 439 (id: lerma-439)");
    expect(f).toContain("### Tipologías y superficies\n2 ambientes de 45 m².");
    expect(f).toContain("### Precios\n(Sin datos: no lo informes; ofrecé que lo confirme el equipo.)");
  });

  it("con un proyecto elegido, solo va su ficha", () => {
    const i = instrucciones({ tono, proyectos: [lerma(), otroProyecto()], proyecto: lerma(), ejemplos: [] });
    expect(i).toContain("Sos parte del equipo comercial de Mindlin");
    expect(i).toContain("quiera visitar el proyecto");
    expect(i).toContain("Villa Crespo");
    expect(i).not.toContain("Palermo");
  });

  it("sin proyecto elegido, lista los proyectos sin dar datos y pide elegir", () => {
    const i = instrucciones({ tono, proyectos: [lerma(), otroProyecto()], proyecto: null, ejemplos: [{ titulo: "Saludo", conversacion: "—Hola\n—¡Hola! ¿En qué te ayudo?" }] });
    expect(i).toContain("elegir_proyecto");
    expect(i).toContain("- Otro 1 (id: otro-1): Palermo.");
    // Las palabras para reconocerlo (las de la ficha), así entiende «lo de Lerma».
    expect(instrucciones({ tono, proyectos: [lerma({ palabras_clave: ["lerma", "villa crespo"] }), otroProyecto()], proyecto: null, ejemplos: [] })).toContain(
      "- Lerma 439 (id: lerma-439): Villa Crespo, CABA. También lo pueden nombrar así: lerma, villa crespo.",
    );
    expect(i).not.toContain("Monoambientes");
    expect(i).toContain("## Saludo");
  });

  it("es estable: el mismo tono y las mismas fichas dan el mismo texto (para el caché)", () => {
    const a = instrucciones({ tono, proyectos: [lerma()], proyecto: lerma(), ejemplos: [] });
    expect(instrucciones({ tono, proyectos: [lerma()], proyecto: lerma(), ejemplos: [] })).toBe(a);
  });

  it("la situación dice la hora de Buenos Aires y lo que sabe el CRM", () => {
    const ahora = new Date("2026-11-07T21:05:00Z");
    expect(situacion({ ahora, nombre: "Ana", telefono: "5491155550000", crm: null })).toContain("primera vez");
    const s = situacion({
      ahora,
      nombre: "Ana",
      telefono: "5491155550000",
      crm: { id: "c1", nombre: "Ana", telefono: "", etapa: "Interesado", responsable: "Mati", proyectos: [], ultimoContacto: "2026-11-01T10:00:00Z", notas: "Quiere balcón." },
    });
    expect(s).toContain("18:05");
    expect(s).toContain("Etapa: Interesado. Responsable: Mati. Último contacto: 2026-11-01.");
    expect(s).toContain("Quiere balcón.");
    expect(situacion({ ahora, nombre: "", telefono: "", crm: undefined })).toContain("no se pudo consultar");
  });
});
