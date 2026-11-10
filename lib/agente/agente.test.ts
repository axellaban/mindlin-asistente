import { describe, expect, it } from "vitest";
import { respuesta } from "../../test/fixtures";
import { LIMITE_MS, MAX_LETRAS_MENSAJE, MAX_VUELTAS, mensajesDelHistorial, responder, type Herramientas, type Modelo } from "./agente";

const herramientas: Herramientas = {
  async registrarInteresado() {
    return "Listo.";
  },
  async elegirProyecto() {
    return "Ficha";
  },
};

const historial = [{ id: 1, conversacion: 7, rol: "interesado" as const, texto: "Hola", fecha: "2026-11-10T14:00:00.000Z" }];
const usarHerramienta = () =>
  respuesta([
    { type: "text", text: "Ya te anoto." },
    { type: "tool_use", id: `t${Math.random()}`, name: "registrar_interesado", input: { nombre: "", para: "", ambientes: "", presupuesto_usd: "", forma_de_pago: "", plazo: "", resumen: "x" } },
  ]);

describe("el ida y vuelta con la IA", () => {
  it("si se pasa del tiempo, no empieza otra vuelta: la conversación pasa al equipo", async () => {
    let ms = 0;
    let pedidos = 0;
    const modelo: Modelo = async () => {
      pedidos++;
      ms += 80_000; // cada pedido tarda 80 segundos
      return usarHerramienta();
    };
    const r = await responder({ modelo, instrucciones: "i", situacion: "s", historial, proyectos: ["lerma-439"], herramientas, reloj: () => ms });
    // 0 s: primer pedido; 80 s: segundo (todavía no pasó el límite); 160 s: ya no empieza otro.
    expect(LIMITE_MS).toBe(150_000);
    expect(pedidos).toBe(2);
    expect(r).toEqual({ texto: "Ya te anoto.", pasarAPersona: { motivo: "El asistente tardó demasiado en responder.", resumen: "" }, fin: "demasiado_tiempo" });
  });

  it("corta a las MAX_VUELTAS aunque haya tiempo", async () => {
    let pedidos = 0;
    const modelo: Modelo = async () => (pedidos++, usarHerramienta());
    const r = await responder({ modelo, instrucciones: "i", situacion: "s", historial, proyectos: ["lerma-439"], herramientas, reloj: () => 0 });
    expect(pedidos).toBe(MAX_VUELTAS);
    expect(r.fin).toBe("demasiadas_vueltas");
  });

  it("si la respuesta llega al tope de largo, no la manda cortada: pasa al equipo", async () => {
    const modelo: Modelo = async () => respuesta([{ type: "text", text: "Te cuento todo: primero…" }], "max_tokens");
    const r = await responder({ modelo, instrucciones: "i", situacion: "s", historial, proyectos: ["lerma-439"], herramientas });
    expect(r).toEqual({ texto: "", pasarAPersona: { motivo: "La respuesta del asistente salió demasiado larga.", resumen: "" }, fin: "cortada" });
  });

  it("cada mensaje del historial va con un tope de largo", () => {
    const largo = [{ ...historial[0], texto: "x".repeat(MAX_LETRAS_MENSAJE + 500) }];
    expect(String(mensajesDelHistorial(largo)[0].content)).toHaveLength(MAX_LETRAS_MENSAJE);
  });
});
