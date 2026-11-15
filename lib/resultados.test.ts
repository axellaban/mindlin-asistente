import { describe, expect, it } from "vitest";
import type { ContactoCRM } from "./crm/planilla";
import { contarLlegadas, nivel, resultadosPor, type LeadDeResultado } from "./resultados";

const contacto = (id: string, telefono: string, etapa: string) => ({ id, nombre: id, telefono, etapa }) as ContactoCRM;
const lead = (conversacion: number, cambios: Partial<LeadDeResultado> = {}): LeadDeResultado => ({ conversacion, crm_contacto_id: null, telefono: null, etapas_asistente: [], ...cambios });

describe("qué flujo y qué seguimiento venden", () => {
  const crm = [
    contacto("c1", "+54 9 11 5555-0001", "Visita / reunión"),
    contacto("c2", "+54 9 11 5555-0002", "Vendido"),
    contacto("c3", "+54 9 11 5555-0003", "Descartado"),
    contacto("c4", "+54 9 11 5555-0004", "Seguimiento"),
  ];

  it("el orden del embudo: lo que está fuera (En pausa, Descartado) no cuenta", () => {
    expect(nivel("Visita / reunión")).toBeLessThan(nivel("Negociación"));
    expect(nivel("Vendido")).toBeGreaterThan(nivel("Reserva"));
    expect(nivel("visita / reunion")).toBe(nivel("Visita / reunión"));
    expect(nivel("Descartado")).toBe(-1);
    expect(nivel(null)).toBe(-1);
  });

  it("cuenta la etapa de hoy en el CRM o la más alta a la que lo movió el asistente; Vendido cuenta como Reserva", () => {
    const r = contarLlegadas(
      [
        lead(1, { crm_contacto_id: "c1" }),
        // Por el teléfono, aunque no tenga el ID anotado.
        lead(2, { telefono: "5491155550002" }),
        // Pidió visita (lo movió el asistente) y después lo descartaron: igual cuenta en visita.
        lead(3, { crm_contacto_id: "c3", etapas_asistente: ["Visita / reunión"] }),
        lead(4, { crm_contacto_id: "c4" }),
        // No está en el CRM: cuenta como lead, sin llegar a nada.
        lead(5, { telefono: "5491100000000" }),
      ],
      crm,
    );
    expect(r).toEqual({ leads: 5, visita: 3, negociacion: 1, reserva: 1 });
  });

  it("un lead que pasó dos veces cuenta una sola vez; se agrupa por flujo o por regla y versión", () => {
    const m = resultadosPor(
      [
        { ...lead(1, { crm_contacto_id: "c1" }), clave: "f1" },
        { ...lead(9, { crm_contacto_id: "c1" }), clave: "f1" },
        { ...lead(2, { crm_contacto_id: "c2" }), clave: "f2" },
      ],
      crm,
    );
    expect(m.get("f1")).toEqual({ leads: 1, visita: 1, negociacion: 0, reserva: 0 });
    expect(m.get("f2")).toEqual({ leads: 1, visita: 1, negociacion: 1, reserva: 1 });
  });
});
