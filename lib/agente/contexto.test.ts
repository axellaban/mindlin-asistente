import { describe, expect, it } from "vitest";
import { lerma, otroProyecto, tono } from "../../test/fixtures";
import { equipoTrabajando, ficha, instrucciones, situacion } from "./contexto";

describe("contexto del agente", () => {
  it("la ficha marca lo que falta para que no lo invente", () => {
    const f = ficha(lerma());
    expect(f).toContain("## Lerma 439 (id: lerma-439)");
    expect(f).toContain("### Tipologías y superficies\n2 ambientes de 45 m².");
    expect(f).toContain("### Precios\n(Sin datos: no lo informes; ofrecé que lo confirme el equipo.)");
  });

  it("si la ficha trae presentación, va primero y dice cómo usarla; si no, no aparece", () => {
    const f = ficha(lerma({ presentacion: "Lerma es un desarrollo en pozo entre Villa Crespo y Palermo." }));
    expect(f.indexOf("### Cómo presentarlo")).toBeLessThan(f.indexOf("### Descripción"));
    expect(f).toContain("La primera vez que le hables de este proyecto");
    expect(f).toContain("Lerma es un desarrollo en pozo entre Villa Crespo y Palermo.");
    expect(ficha(lerma())).not.toContain("Cómo presentarlo");
  });

  it("la base comercial (empresa y objeciones) va antes de las reglas, y solo si está cargada", () => {
    const con = instrucciones({ tono: { ...tono, sobre_la_empresa: "Borok Construcciones existe desde 1990.", objeciones: "«Me parece caro»: poner en contexto." }, proyectos: [lerma()], proyecto: lerma(), ejemplos: [] });
    expect(con).toContain("# Sobre Mindlin Developers (vale para todos los proyectos)\n\nBorok Construcciones existe desde 1990.");
    expect(con).toContain("Si choca con las reglas de abajo, valen las reglas.");
    expect(con.indexOf("«Me parece caro»")).toBeLessThan(con.indexOf("# Reglas que no se rompen"));
    const sin = instrucciones({ tono, proyectos: [lerma()], proyecto: lerma(), ejemplos: [] });
    expect(sin).not.toContain("Sobre Mindlin Developers");
    expect(sin).not.toContain("Objeciones, perfiles");
  });

  it("con un proyecto elegido, solo va su ficha", () => {
    const i = instrucciones({ tono, proyectos: [lerma(), otroProyecto()], proyecto: lerma(), ejemplos: [] });
    expect(i).toContain("Sos parte del equipo comercial de Mindlin");
    expect(i).toContain("quiera visitar el proyecto");
    expect(i).toContain("Villa Crespo");
    expect(i).not.toContain("Palermo");
    // De los otros proyectos va solo el nombre, para poder cambiar si pregunta por otro.
    expect(i).toContain("# Otros proyectos de Mindlin");
    expect(i).toContain("- Otro 1 (id: otro-1)");
    expect(i).not.toContain("Monoambientes");
    expect(instrucciones({ tono, proyectos: [lerma()], proyecto: lerma(), ejemplos: [] })).not.toContain("Otros proyectos");
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
      crm: { id: "c1", nombre: "Ana", telefono: "", etapa: "Interesado", responsable: "Mati", proyectos: [], ultimoContacto: "2026-11-01T10:00:00Z", notas: "Quiere balcón.", para: "Invertir", ambientes: "", presupuestoUsd: "90000", formaDePago: "", plazo: "", proximoPaso: "Mandar planos", fechaProximoPaso: "2026-11-12" },
    });
    expect(s).toContain("18:05");
    expect(s).toContain("Etapa: Interesado. Responsable: Mati. Último contacto: 2026-11-01.");
    expect(s).toContain("Quiere balcón.");
    expect(s).toContain("En el CRM figura: para: Invertir; presupuesto: USD 90000.");
    expect(s).toContain("Próximo paso que anotó el equipo: Mandar planos (2026-11-12).");
    expect(situacion({ ahora, nombre: "", telefono: "", crm: undefined })).toContain("no se pudo consultar");
    const conAnotado = situacion({ ahora, nombre: "Ana", telefono: "", crm: null, anotado: { nombre: "Ana Prueba", ambientes: "2", resumen: "Busca 2 ambientes." } });
    expect(conAnotado).toContain("Lo que ya sabés de esta persona (lo anotaste vos): nombre: Ana Prueba; ambientes: 2.");
    expect(conAnotado).toContain("Tu último resumen para el equipo: Busca 2 ambientes.");
  });

  it("sabe si el equipo está trabajando (lunes a viernes de 9 a 20 en Buenos Aires)", () => {
    expect(equipoTrabajando(new Date("2026-11-10T12:00:00Z"))).toBe(true); // martes 9:00
    expect(equipoTrabajando(new Date("2026-11-10T11:59:00Z"))).toBe(false); // martes 8:59
    expect(equipoTrabajando(new Date("2026-11-10T23:00:00Z"))).toBe(false); // martes 20:00
    expect(equipoTrabajando(new Date("2026-11-07T15:00:00Z"))).toBe(false); // sábado 12:00
    const sabado = situacion({ ahora: new Date("2026-11-07T15:00:00Z"), nombre: "Ana", telefono: "", crm: null });
    expect(sabado).toContain("El equipo comercial no está trabajando ahora");
    expect(situacion({ ahora: new Date("2026-11-10T15:00:00Z"), nombre: "Ana", telefono: "", crm: null })).not.toContain("no está trabajando");
  });
});
