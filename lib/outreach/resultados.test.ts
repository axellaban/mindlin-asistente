import { describe, expect, it } from "vitest";
import { comparar, embudo, METAS_DE_FABRICA as M, validarMetas, type FilaResultado } from "./resultados";

const f = (cambios: Partial<FilaResultado> = {}): FilaResultado => ({ lote: "A", tiene_whatsapp: null, primer_envio: null, version: null, respondio: null, etapa: "por_contactar", crm_etapa_hoy: null, ...cambios });
const envio = "2026-11-02T14:00:00.000Z";

describe("embudo del outreach", () => {
  it("cada paso incluye a los siguientes", () => {
    const filas = [
      f(),
      f({ tiene_whatsapp: true }),
      f({ primer_envio: envio }),
      f({ primer_envio: envio, respondio: "2026-11-03T10:00:00.000Z", etapa: "respondio" }),
      f({ primer_envio: envio, respondio: "2026-11-03T10:00:00.000Z", crm_etapa_hoy: "Reserva" }),
    ];
    const e = embudo(filas, M, { semanas: 2 });
    expect(e.pasos.map((p) => [p.paso, p.cantidad])).toEqual([
      ["cargados", 5],
      ["con_whatsapp", 4],
      ["contactados", 3],
      ["respondieron", 2],
      ["interesados", 1],
      ["visita", 1],
      ["reserva", 1],
    ]);
    expect(e.meta_contactados).toBe(200);
    // Con menos de 30 en el paso anterior, no se marca «bajo».
    expect(e.frena).toBeNull();
  });

  it("marca dónde se frena, con muestra suficiente", () => {
    const filas = Array.from({ length: 40 }, (_, i) => f({ primer_envio: envio, respondio: i < 2 ? "2026-11-03T10:00:00.000Z" : null }));
    const e = embudo(filas, M, { semanas: 1 });
    expect(e.pasos.find((p) => p.paso === "respondieron")).toMatchObject({ cantidad: 2, conversion: 0.05, meta: 0.15, bajo: true });
    expect(e.frena).toBe("respondieron");
  });
});

describe("comparar bases y versiones", () => {
  it("cuenta la respuesta solo dentro de los 7 días", () => {
    const filas = [
      f({ lote: "A", version: 1, primer_envio: envio, respondio: "2026-11-05T10:00:00.000Z" }),
      f({ lote: "A", version: 2, primer_envio: envio, respondio: "2026-11-20T10:00:00.000Z" }),
      f({ lote: "B", version: 1, primer_envio: envio }),
      f({ lote: "B" }),
    ];
    expect(comparar(filas, (x) => x.lote)).toEqual([
      { clave: "A", contactados: 2, respondieron: 1, tasa: 0.5, muestra_chica: true },
      { clave: "B", contactados: 1, respondieron: 0, tasa: 0, muestra_chica: true },
    ]);
    expect(comparar(filas, (x) => (x.version ? `Saludo ${x.version}` : null)).map((c) => [c.clave, c.respondieron])).toEqual([
      ["Saludo 1", 1],
      ["Saludo 2", 0],
    ]);
  });

  it("valida las metas", () => {
    expect(validarMetas({ respondieron: 20 })).toEqual({ metas: { ...M, respondieron: 20 } });
    expect(validarMetas({ visita: 120 })).toEqual({ error: "Metas: cada porcentaje va de 0 a 100." });
    expect(validarMetas({ contactados_semana: 0 })).toEqual({ error: "Metas: los contactos por semana van de 1 a 2000." });
  });
});
