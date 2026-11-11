import { describe, expect, it } from "vitest";
import { etapaDeAlta, puedeMover, REGLAS_POR_DEFECTO, resolverEtapa } from "./reglas";

describe("etapas automáticas: los cuidados", () => {
  it("dentro del embudo solo avanza, nunca retrocede", () => {
    expect(puedeMover("Nuevo", "Contacto inicial")).toBe("Contacto inicial");
    expect(puedeMover("Contacto inicial", "Seguimiento")).toBe("Seguimiento");
    expect(puedeMover("Nuevo", "Visita / reunión")).toBe("Visita / reunión");
    expect(puedeMover("Negociación", "Seguimiento")).toBeNull();
    expect(puedeMover("Visita / reunión", "Contacto inicial")).toBeNull();
    expect(puedeMover("Seguimiento", "Seguimiento")).toBeNull();
    // Escrito distinto en la planilla, es la misma etapa.
    expect(puedeMover("visita/reunion", "Visita / reunión")).toBeNull();
    expect(puedeMover("seguimiento", "negociacion")).toBe("Negociación");
  });

  it("no toca a quien está en Reserva o Vendido, ni manda a esas etapas", () => {
    for (const destino of ["Seguimiento", "En pausa", "Descartado", "Negociación"]) {
      expect(puedeMover("Reserva", destino)).toBeNull();
      expect(puedeMover("Vendido", destino)).toBeNull();
    }
    expect(puedeMover("Negociación", "Reserva")).toBeNull();
    expect(puedeMover("Negociación", "Vendido")).toBeNull();
    expect(puedeMover("Seguimiento", "Nuevo")).toBeNull();
  });

  it("a En pausa o Descartado solo desde las primeras etapas; quien vuelve a escribir se reactiva", () => {
    expect(puedeMover("Nuevo", "En pausa")).toBe("En pausa");
    expect(puedeMover("Seguimiento", "Descartado")).toBe("Descartado");
    expect(puedeMover("Visita / reunión", "Descartado")).toBeNull();
    expect(puedeMover("Negociación", "En pausa")).toBeNull();
    expect(puedeMover("En pausa", "Descartado")).toBe("Descartado");
    expect(puedeMover("Descartado", "En pausa")).toBeNull();
    expect(puedeMover("En pausa", "Seguimiento")).toBe("Seguimiento");
    expect(puedeMover("Descartado", "Contacto inicial")).toBe("Contacto inicial");
  });

  it("sin regla, con una etapa que no existe o sin etapa de destino, no mueve", () => {
    expect(puedeMover("Nuevo", null)).toBeNull();
    expect(puedeMover("Nuevo", undefined)).toBeNull();
    expect(puedeMover("Nuevo", "Inventada")).toBeNull();
    // Una etapa que no se entiende se lee como Nuevo, igual que el hub.
    expect(puedeMover("cualquier cosa", "Contacto inicial")).toBe("Contacto inicial");
  });
});

describe("etapas automáticas: lo que pasó en un mensaje", () => {
  it("aplica los eventos en orden y se queda con el último que movió", () => {
    expect(resolverEtapa("Nuevo", ["primer_contacto"], REGLAS_POR_DEFECTO)).toEqual({ etapa: "Contacto inicial", evento: "primer_contacto" });
    expect(resolverEtapa("Contacto inicial", ["respondio", "quiere_visita"], REGLAS_POR_DEFECTO)).toEqual({ etapa: "Visita / reunión", evento: "quiere_visita" });
    expect(resolverEtapa("Contacto inicial", ["respondio", "no_le_interesa"], REGLAS_POR_DEFECTO)).toEqual({ etapa: "Descartado", evento: "no_le_interesa" });
    // Los que no tienen regla (de fábrica) no mueven.
    expect(resolverEtapa("Seguimiento", ["respondio", "senal_de_compra", "paso_al_equipo"], REGLAS_POR_DEFECTO)).toBeNull();
    // Si el equipo ya lo llevó más adelante, un mensaje nuevo no lo vuelve atrás.
    expect(resolverEtapa("Negociación", ["respondio"], REGLAS_POR_DEFECTO)).toBeNull();
    expect(resolverEtapa("Nuevo", [], REGLAS_POR_DEFECTO)).toBeNull();
    expect(resolverEtapa("Nuevo", ["respondio"], {})).toBeNull();
  });

  it("el contacto que da de alta el asistente entra con la etapa del primer contacto", () => {
    expect(etapaDeAlta(REGLAS_POR_DEFECTO)).toBe("Contacto inicial");
    expect(etapaDeAlta({})).toBe("Nuevo");
    expect(etapaDeAlta({ primer_contacto: null })).toBe("Nuevo");
    expect(etapaDeAlta({ primer_contacto: "En pausa" })).toBe("En pausa");
  });
});
