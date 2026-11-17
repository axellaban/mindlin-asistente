/**
 * La lista de precios del hub (17/11/2026, pedido de Mati): las unidades disponibles de cada proyecto,
 * con sus precios, del Excel madre (lo mismo que Comercial → Lista de precios en el hub). El asistente
 * la suma a la ficha del proyecto (`lista_hub` dice de qué proyecto del hub). Ver docs/lista-de-precios.md.
 *
 * Necesita HUB_URL y HUB_CLAVE (las mismas del aviso al hub). Si el hub no contesta, o el proyecto
 * no tiene Excel madre, vale solo la ficha: nunca frena una respuesta.
 */
import type { Proyecto } from "../datos/tipos";

export interface UnidadHub {
  codigo: string;
  piso: string;
  tipologia: string;
  orientacion: string;
  m2: number;
  precio_usd: number;
  usd_m2: number | null;
  tipo: "libre" | "reventa";
  link: string | null;
}

export interface ListaHub {
  disponible: boolean;
  motivo?: string;
  leido?: string;
  unidades?: UnidadHub[];
  cocheras?: { codigo: string; precio_usd: number }[];
  condiciones?: string[];
  web?: string | null;
}

export type LeerLista = (proyectoHub: string) => Promise<ListaHub | null>;

/** Cuánto se espera al hub (el Excel madre puede tardar la primera vez) y cuánto se guarda lo leído. */
const ESPERA_MS = 6000;
export const VIGENCIA_MS = 10 * 60_000;
const VIGENCIA_ERROR_MS = 2 * 60_000;
/** Más que esto no entra en la ficha (una torre grande): van las primeras, por piso. */
const MAX_UNIDADES = 80;

export function listaDesdeEnv(env: Record<string, string | undefined>, pedir: typeof fetch = fetch, reloj: () => number = Date.now): LeerLista | null {
  const url = env.HUB_URL?.trim().replace(/\/+$/, "");
  const clave = env.HUB_CLAVE?.trim();
  if (!url || !/^https?:\/\//.test(url) || !clave) return null;
  const guardadas = new Map<string, { hasta: number; lista: Promise<ListaHub | null> }>();
  return (id) => {
    const ya = guardadas.get(id);
    if (ya && ya.hasta > reloj()) return ya.lista;
    const lista = (async (): Promise<ListaHub | null> => {
      try {
        const r = await pedir(`${url}/api/asistente/unidades?proyecto=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${clave}` }, signal: AbortSignal.timeout(ESPERA_MS) });
        const j = (await r.json().catch(() => null)) as ListaHub | null;
        if (!r.ok || !j) throw new Error(`el hub respondió ${r.status}`);
        return j;
      } catch {
        // Un rato sin volver a preguntar: si el hub está caído, no se lo pide en cada mensaje.
        guardadas.set(id, { hasta: reloj() + VIGENCIA_ERROR_MS, lista: Promise.resolve(null) });
        return null;
      }
    })();
    guardadas.set(id, { hasta: reloj() + VIGENCIA_MS, lista });
    return lista;
  };
}

const usd = (n: number) => `USD ${Math.round(n).toLocaleString("es-AR")}`;
const FECHA = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Cómo la lee la IA, dentro de la ficha. Null si no hay lista (sin Excel madre o el hub no contestó). */
export function textoLista(l: ListaHub | null): string | null {
  if (!l?.disponible) return null;
  const unidades = l.unidades ?? [];
  const cuando = l.leido ? ` (leída el ${FECHA.format(new Date(l.leido))})` : "";
  const reglas = [
    `Es la lista de precios oficial de Mindlin${cuando}. Para precios y disponibilidad de unidades vale esta lista, por sobre lo que diga la ficha.`,
    "Podés dar estos precios y superficies tal cual: son precios de lista, en dólares. Descuentos, financiación especial, reservas o una unidad que no está en la lista: eso lo confirma el equipo.",
    "Si una unidad no aparece acá, hoy no está disponible: no la ofrezcas.",
    "No mandes la lista entera: contá lo que se ajusta a lo que busca la persona (dos o tres opciones) y preguntá.",
  ];
  const fila = (u: UnidadHub) =>
    `- ${u.codigo} · ${u.piso} · ${[u.tipologia, u.orientacion].filter(Boolean).join(" · ")} · ${u.m2} m² · ${usd(u.precio_usd)}${u.usd_m2 ? ` (${usd(u.usd_m2)}/m²)` : ""}${u.tipo === "reventa" ? " · reventa: la vende su dueño, a ese precio" : ""}${u.link ? ` · ${u.link}` : ""}`;
  const partes = [
    reglas.join(" "),
    unidades.length ? `Unidades disponibles (${unidades.length}):\n${unidades.slice(0, MAX_UNIDADES).map(fila).join("\n")}${unidades.length > MAX_UNIDADES ? `\n(y ${unidades.length - MAX_UNIDADES} más: para esas, que lo vea el equipo)` : ""}` : "Hoy no hay unidades disponibles en la lista: no ofrezcas ninguna y ofrecé que el equipo le cuente las próximas.",
    l.cocheras?.length ? `Cocheras disponibles: ${l.cocheras.map((c) => `${c.codigo} ${usd(c.precio_usd)}`).join(", ")}.` : "",
    l.condiciones?.length ? `Condiciones de la lista:\n${l.condiciones.map((c) => `- ${c}`).join("\n")}` : "",
  ];
  return partes.filter(Boolean).join("\n\n");
}

/** Los proyectos con su lista de precios del hub al lado (`lista_precios`), los que tienen `lista_hub`. */
export async function conListaDePrecios(proyectos: Proyecto[], leer: LeerLista | null | undefined): Promise<Proyecto[]> {
  if (!leer) return proyectos;
  return Promise.all(
    proyectos.map(async (p) => {
      const id = p.lista_hub?.trim();
      if (!id) return p;
      const texto = textoLista(await leer(id).catch(() => null));
      return texto ? { ...p, lista_precios: texto } : p;
    }),
  );
}
