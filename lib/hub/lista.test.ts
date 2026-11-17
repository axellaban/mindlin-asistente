import { describe, expect, it } from "vitest";
import { lerma } from "../../test/fixtures";
import { conListaDePrecios, desdeDeLista, listaDesdeEnv, textoLista, usd, VIGENCIA_MS, type ListaHub, type UnidadHub } from "./lista";

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

  it("la pide con la clave, la guarda 10 minutos y, si el hub falla, no frena (dice por qué) y espera un rato", async () => {
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
    expect(await leer("lerma-439")).toEqual({ disponible: false, motivo: "el hub respondió 500" });
    ahora += 60_000;
    expect((await leer("lerma-439"))?.disponible).toBe(false); // dentro de los 2 minutos: no vuelve a pedir
    expect(h.pedidos).toHaveLength(3);
  });

  it("los motivos que ve «Probar las conexiones»: la clave, el hub sin la versión nueva, el hub caído", async () => {
    const con = (status: number, cuerpo: unknown) => listaDesdeEnv(ENV, (async () => new Response(JSON.stringify(cuerpo), { status })) as typeof fetch)!;
    expect(await con(401, { error: "Clave incorrecta." })("lerma-439")).toEqual({ disponible: false, motivo: "el hub no aceptó la clave: HUB_CLAVE (acá) y ASISTENTE_CLAVE (en el hub) tienen que ser iguales" });
    expect((await con(404, "<html>")("lerma-439"))?.motivo).toBe("el hub todavía no tiene la lista para el asistente (falta publicar su versión del 17/11)");
    // El 404 del hub con su propio motivo (un proyecto que no existe allá).
    expect((await con(404, { disponible: false, motivo: "No hay un proyecto «x» en el hub." })("x"))?.motivo).toBe("No hay un proyecto «x» en el hub.");
    const caido = listaDesdeEnv(ENV, (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch)!;
    expect(await caido("lerma-439")).toBeNull();
  });

  it("cómo la lee la IA: las reglas, las unidades (con la reventa y el link), cocheras y condiciones", () => {
    const t = textoLista(LISTA)!;
    expect(t).toContain("lista de precios oficial de Mindlin (leída el 17/11, 10:05)");
    expect(t).toContain("Si una unidad no aparece acá, hoy no está disponible");
    expect(t).toContain("- 2A · Piso 2 · 2 ambientes · Frente · 52.4 m² · u$d 128.000 (u$d 2.560/m²) · https://ejemplo.com/lerma/2a");
    expect(t).toContain("- 3B · Piso 3 · 3 ambientes · 70 m² · u$d 150.000 · reventa: la vende su dueño, a ese precio");
    expect(t).toContain("Cocheras disponibles: C1 u$d 25.000.");
    // Como habla Mindlin: «desde», con el mejor valor disponible (las reventas no cuentan para el «desde»).
    expect(t).toContain("decí «desde» con el mejor valor disponible");
    expect(t).toContain("Desde u$d 128.000 (la de mejor valor disponible: 2A, 2 ambientes). Por tipología:\n- 2 ambientes: queda 1 sola (la 2A), u$d 128.000");
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
  it("el «desde» y lo que queda de cada tipología (para decir «nos queda solo la 6E»)", () => {
    const u = (codigo: string, tipologia: string, precio_usd: number, tipo: UnidadHub["tipo"] = "libre"): UnidadHub => ({ codigo, piso: "Piso 1", tipologia, orientacion: "", m2: 50, precio_usd, usd_m2: null, tipo, link: null });
    const d = desdeDeLista([u("2A", "2 ambientes", 130_000), u("2B", "2 ambientes", 120_000), u("6E", "4 ambientes", 726_227), u("1C", "2 ambientes", 90_000, "reventa")]);
    expect(d.desde?.codigo).toBe("2B");
    expect(d.tipologias.map((t) => [t.tipologia, t.cantidad, t.desde.codigo])).toEqual([["2 ambientes", 2, "2B"], ["4 ambientes", 1, "6E"]]);
    expect(textoLista({ disponible: true, unidades: [u("6E", "4 ambientes", 726_227)] })).toContain("- 4 ambientes: queda 1 sola (la 6E), u$d 726.227");
    // Solo reventas: el «desde» es de esas.
    expect(desdeDeLista([u("1C", "2 ambientes", 90_000, "reventa")]).desde?.codigo).toBe("1C");
    expect(desdeDeLista([]).desde).toBeNull();
    expect(usd(726227)).toBe("u$d 726.227");
  });
});
