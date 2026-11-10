import { describe, expect, it } from "vitest";
import { responder, type Herramientas } from "./agente";
import { crearModeloOpenAI, crearTranscriptorOpenAI, ErrorOpenAI, esfuerzoOpenAI, pedidoOpenAI, respuestaDeOpenAI, type RespuestaOpenAI } from "./openai";

/** Una API de OpenAI de mentira: devuelve las respuestas en orden y guarda lo que recibió. */
function openaiFalso(...respuestas: (RespuestaOpenAI | { status: number; texto: string })[]) {
  const pedidos: { url: string; auth: string | null; cuerpo: unknown }[] = [];
  const pedir = (async (url: string, init: RequestInit) => {
    pedidos.push({
      url,
      auth: new Headers(init.headers).get("authorization"),
      cuerpo: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
    });
    const r = respuestas.shift();
    if (!r) throw new Error("no hay más respuestas preparadas");
    if ("status" in r && typeof r.status === "number") return new Response((r as { texto: string }).texto, { status: r.status });
    return new Response(JSON.stringify(r), { status: 200 });
  }) as typeof fetch;
  return { pedidos, pedir };
}

const mensaje = (texto: string) => ({ type: "message", id: "msg_1", role: "assistant", status: "completed", content: [{ type: "output_text", text: texto, annotations: [] }] });
const razonamiento = { type: "reasoning", id: "rs_1", summary: [], encrypted_content: "cifrado" };
const llamada = (call_id: string, name: string, args: Record<string, unknown>) => ({ type: "function_call", id: `fc_${call_id}`, call_id, name, arguments: JSON.stringify(args), status: "completed" });

const herramientasFalsas = () => {
  const hechos: string[] = [];
  const h: Herramientas = {
    async registrarInteresado(d) {
      hechos.push(`registrar ${d.ambientes}`);
      return "Listo: quedó en el CRM.";
    },
    async elegirProyecto(id) {
      hechos.push(`elegir ${id}`);
      return "Ficha";
    },
  };
  return { h, hechos };
};

const datos = { nombre: "", para: "Vivir", ambientes: "2", presupuesto_usd: "", forma_de_pago: "", plazo: "", resumen: "Busca 2 ambientes." };

describe("OpenAI con la forma de Claude", () => {
  it("traduce el pedido: instrucciones, historial, herramientas estrictas y sin guardar nada en OpenAI", () => {
    const cuerpo = pedidoOpenAI(
      {
        system: [
          { type: "text", text: "Instrucciones", cache_control: { type: "ephemeral" } },
          { type: "text", text: "Situación" },
        ],
        tools: [{ name: "pasar_a_persona", description: "Pasa", strict: true, input_schema: { type: "object", properties: {} } }],
        messages: [
          { role: "user", content: "Hola" },
          { role: "assistant", content: "¡Hola! ¿En qué te ayudo?" },
          { role: "user", content: "Quiero 2 ambientes" },
        ],
      },
      { modelo: "gpt-6.1-sol", esfuerzo: "medium" },
    );
    expect(cuerpo).toMatchObject({
      model: "gpt-6.1-sol",
      instructions: "Instrucciones\n\nSituación",
      input: [
        { role: "user", content: "Hola" },
        { role: "assistant", content: "¡Hola! ¿En qué te ayudo?" },
        { role: "user", content: "Quiero 2 ambientes" },
      ],
      tools: [{ type: "function", name: "pasar_a_persona", description: "Pasa", strict: true, parameters: { type: "object", properties: {} } }],
      reasoning: { effort: "medium" },
      store: false,
      include: ["reasoning.encrypted_content"],
    });
  });

  it("lleva el esfuerzo a lo que entiende OpenAI", () => {
    expect(["low", "medium", "high", "xhigh", "max", "otro"].map(esfuerzoOpenAI)).toEqual(["low", "medium", "high", "high", "high", "medium"]);
  });

  it("traduce la respuesta: texto, herramientas, rechazos y cortes", () => {
    const conHerramienta = respuestaDeOpenAI({ output: [razonamiento, mensaje("Ya te anoto."), llamada("c1", "registrar_interesado", datos)] });
    expect(conHerramienta.stop_reason).toBe("tool_use");
    expect(conHerramienta.content).toEqual([
      { type: "text", text: "Ya te anoto.", citations: null },
      { type: "tool_use", id: "c1", name: "registrar_interesado", input: datos },
    ]);
    expect(respuestaDeOpenAI({ output: [mensaje("Hola")] }).stop_reason).toBe("end_turn");
    expect(respuestaDeOpenAI({ output: [{ type: "message", content: [{ type: "refusal", refusal: "No." }] }] }).stop_reason).toBe("refusal");
    expect(respuestaDeOpenAI({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [mensaje("Hola")] }).stop_reason).toBe("max_tokens");
    // Argumentos rotos: la herramienta recibe un objeto vacío y el agente sigue.
    expect(respuestaDeOpenAI({ output: [{ ...llamada("c2", "pasar_a_persona", {}), arguments: "{roto" }] }).content).toEqual([{ type: "tool_use", id: "c2", name: "pasar_a_persona", input: {} }]);
  });

  it("el agente funciona igual con OpenAI: usa la herramienta y devuelve la salida original con el razonamiento", async () => {
    const api = openaiFalso(
      { id: "r1", status: "completed", output: [razonamiento, llamada("c1", "registrar_interesado", datos)] },
      { id: "r2", status: "completed", output: [mensaje("¡Genial! En Lerma 439 hay 2 ambientes.")] },
    );
    const modelo = crearModeloOpenAI({ clave: "clave-de-prueba", modelo: "gpt-6.1-sol", esfuerzo: "medium" }, api.pedir, async () => {});
    const { h, hechos } = herramientasFalsas();
    const r = await responder({
      modelo,
      instrucciones: "Instrucciones",
      situacion: "Situación",
      historial: [{ id: 1, conversacion: 7, rol: "interesado", texto: "Busco 2 ambientes", fecha: "2026-11-07T21:00:00.000Z" }],
      proyectos: ["lerma-439"],
      herramientas: h,
    });

    expect(r).toEqual({ texto: "¡Genial! En Lerma 439 hay 2 ambientes.", pasarAPersona: null, fin: "respuesta" });
    expect(hechos).toEqual(["registrar 2"]);
    expect(api.pedidos.map((p) => [p.url, p.auth])).toEqual([
      ["https://api.openai.com/v1/responses", "Bearer clave-de-prueba"],
      ["https://api.openai.com/v1/responses", "Bearer clave-de-prueba"],
    ]);
    expect((api.pedidos[1].cuerpo as { input: unknown[] }).input).toEqual([
      { role: "user", content: "Busco 2 ambientes" },
      razonamiento,
      llamada("c1", "registrar_interesado", datos),
      { type: "function_call_output", call_id: "c1", output: "Listo: quedó en el CRM." },
    ]);
  });

  it("si OpenAI está saturado reintenta; si rechaza la clave, avisa con el código", async () => {
    const saturado = openaiFalso({ status: 429, texto: "despacio" }, { output: [mensaje("Hola")] });
    const modelo = crearModeloOpenAI({ clave: "k", modelo: "m", esfuerzo: "low" }, saturado.pedir, async () => {});
    expect((await modelo({ system: [], tools: [], messages: [{ role: "user", content: "Hola" }] })).stop_reason).toBe("end_turn");
    expect(saturado.pedidos).toHaveLength(2);
    // Un solo reintento: si vuelve a fallar, avisa.
    const siempre = openaiFalso({ status: 503, texto: "caído" }, { status: 503, texto: "caído" });
    const caido = crearModeloOpenAI({ clave: "k", modelo: "m", esfuerzo: "low" }, siempre.pedir, async () => {});
    await expect(caido({ system: [], tools: [], messages: [{ role: "user", content: "Hola" }] })).rejects.toBeInstanceOf(ErrorOpenAI);
    expect(siempre.pedidos).toHaveLength(2);

    const sinPermiso = openaiFalso({ status: 401, texto: "clave inválida" });
    const otro = crearModeloOpenAI({ clave: "k", modelo: "m", esfuerzo: "low" }, sinPermiso.pedir, async () => {});
    await expect(otro({ system: [], tools: [], messages: [{ role: "user", content: "Hola" }] })).rejects.toBeInstanceOf(ErrorOpenAI);
    expect(sinPermiso.pedidos).toHaveLength(1);
  });

  it("transcribe un audio en castellano", async () => {
    const api = openaiFalso({ text: " Hola, quería saber si tienen cochera. " } as unknown as RespuestaOpenAI);
    const transcribir = crearTranscriptorOpenAI({ clave: "k" }, api.pedir, async () => {});
    expect(await transcribir(new Blob(["audio"], { type: "audio/ogg" }), "audio.ogg")).toBe("Hola, quería saber si tienen cochera.");
    const [p] = api.pedidos;
    expect(p.url).toBe("https://api.openai.com/v1/audio/transcriptions");
    const form = p.cuerpo as FormData;
    expect([form.get("model"), form.get("language"), (form.get("file") as File).name]).toEqual(["gpt-transcribe", "es", "audio.ogg"]);
  });
});
