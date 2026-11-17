import { describe, expect, it } from "vitest";
import { lerma } from "../../test/fixtures";
import { conListaDePrecios, listaDesdeEnv, textoLista, VIGENCIA_MS, type ListaHub } from "./lista";

const ENV = { HUB_URL: "https://hub.ejemplo.com/", HUB_CLAVE: "clave-de-prueba" };
const LISTA: ListaHub = {
  disponible: true,
  leido: "2026-11-17T13:05:00.000Z",
  unidades: [
    { codigo: "2A", piso: "Piso 2", tipologia: "2 ambientes", orientacion: "Frente", m2: 52.4, precio_usd: 128000, usd_m2: 2560, tipo: "libre", link: "https://ejemplo.com/lerma/2a" },
    { codigo: "3B", piso: "Piso 3", tipologia: "3 ambientes", orientacion: "", m2: 70, precio_usd: 150000, usd_m2: null, tipo: "reventa", link: null },
  ],
  cocheras: [{ codigo: "C1", precio_usd: 25000 }],
  condiciones: ["Precios en dólares, por unidad."],
};

function hubFalso(respuestas: (ListaHub | number)[]) {
  const pedidos: { url: string; auth: string | null }[] = [];
  const pedir = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url, auth: new Headers(init?.headers).get("authorization") });
    const r = respuestas.shift();
    if (typeof r === "number") return new Response(JSON.stringify({ error: "x" }), { status: r });
    return Response.json(r);
  }) as typeof fetch;
  return { pedir, pedidos };
}

describe("la lista de precios del hub", () => {
  it("sin HUB_URL o sin HUB_CLAVE no se lee", () => {
    expect(listaDesdeEnv({})).toBeNull();
    expect(listaDesdeEnv({ HUB_URL: "https://hub.ejemplo.com" })).toBeNull();
  });

  it("la pide con la clave, la guarda 10 minutos y, si el hub falla, no frena (null) y espera un rato", async () => {
    let ahora = 0;
    const h = hubFalso([LISTA, LISTA, 500, LISTA]);
    const leer = listaDesdeEnv(ENV, h.pedir, () => ahora)!;
    expect(await leer("lerma-439")).toEqual(LISTA);
    expect(h.pedidos).toEqual([{ url: "https://hub.ejemplo.com/api/asistente/unidades?proyecto=lerma-439", auth: "Bearer clave-de-prueba" }]);
    ahora = VIGENCIA_MS - 1;
    await leer("lerma-439");
    expect(h.pedidos).toHaveLength(1);
    ahora = VIGENCIA_MS + 1;
    await leer("lerma-439");
    expect(h.pedidos).toHaveLength(2);
    ahora = 2 * VIGENCIA_MS + 2;
    expect(await leer("lerma-439")).toBeNull();
    ahora += 60_000;
    expect(await leer("lerma-439")).toBeNull(); // dentro de los 2 minutos: no vuelve a pedir
    expect(h.pedidos).toHaveLength(3);
  });

  it("cómo la lee la IA: las reglas, las unidades (con la reventa y el link), cocheras y condiciones", () => {
    const t = textoLista(LISTA)!;
    expect(t).toContain("lista de precios oficial de Mindlin (leída el 17/11, 10:05)");
    expect(t).toContain("Si una unidad no aparece acá, hoy no está disponible");
    expect(t).toContain("- 2A · Piso 2 · 2 ambientes · Frente · 52.4 m² · USD 128.000 (USD 2.560/m²) · https://ejemplo.com/lerma/2a");
    expect(t).toContain("- 3B · Piso 3 · 3 ambientes · 70 m² · USD 150.000 · reventa: la vende su dueño, a ese precio");
    expect(t).toContain("Cocheras disponibles: C1 USD 25.000.");
    expect(t).toContain("- Precios en dólares, por unidad.");
    expect(textoLista({ disponible: true, unidades: [] })).toContain("Hoy no hay unidades disponibles en la lista");
    expect(textoLista({ disponible: false, motivo: "sin Excel madre" })).toBeNull();
    expect(textoLista(null)).toBeNull();
  });

  it("solo a los proyectos que la usan (lista_hub), y si no hay lista, la ficha queda como estaba", async () => {
    const pedidos: string[] = [];
    const leer = async (id: string) => (pedidos.push(id), id === "lerma-439" ? LISTA : null);
    const [conLista, sinHub, sinExcel] = await conListaDePrecios([lerma({ lista_hub: "lerma-439" }), lerma({ id: "otro", lista_hub: "" }), lerma({ id: "tercero", lista_hub: "t4v" })], leer);
    expect(conLista.lista_precios).toContain("2A");
    expect(sinHub.lista_precios).toBeUndefined();
    expect(sinExcel.lista_precios).toBeUndefined();
    expect(pedidos).toEqual(["lerma-439", "t4v"]);
    expect(await conListaDePrecios([lerma({ lista_hub: "lerma-439" })], null)).toEqual([lerma({ lista_hub: "lerma-439" })]);
  });
});
