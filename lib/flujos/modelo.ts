/**
 * Los flujos: la secuencia de pasos con la que una línea atiende a una persona nueva, como los bots
 * de Kommo (docs/flujos.md). Puro (sin red ni base): la forma de los pasos, cómo se revisan antes de
 * guardarlos y cómo se recorren.
 *
 * Es una lista de pasos, no un dibujo libre: «Esperar respuesta» abre dos caminos (si responde / si
 * no responde en el plazo) y cada camino es otra lista. Así no se pueden armar vueltas infinitas y se
 * lee de arriba abajo, como una conversación.
 *
 * Reglas de forma (las revisa validarPasos):
 * - «Esperar respuesta», «Pasar al equipo», «Que siga la IA» y «Terminar» van al final de su lista.
 * - Una lista que se termina sin uno de esos es como «Terminar».
 * - Entre una espera y la siguiente (un «tramo», lo que sale de corrido), las pausas suman hasta
 *   PAUSA_POR_TRAMO segundos y la IA escribe hasta IA_POR_TRAMO veces: todo eso corre en una sola
 *   función de Vercel (300 segundos).
 */

import { ETAPAS_DESTINO, type EtapaDestino } from "../etapas/reglas";

export type Paso =
  | { tipo: "mensaje"; texto: string; archivo: number | null }
  | { tipo: "pausa"; segundos: number }
  | { tipo: "ia"; consigna: string }
  | { tipo: "esperar"; horas: number; si_responde: Paso[]; si_no: Paso[] }
  | { tipo: "etapa"; etapa: EtapaDestino }
  | { tipo: "equipo"; nota: string }
  | { tipo: "seguir_ia" }
  | { tipo: "fin" };

export type TipoPaso = Paso["tipo"];

/** Los pasos, como los ve Mindlin (el hub arma el menú con esto). */
export const TIPOS_DE_PASO = [
  ["mensaje", "Mensaje", "Un texto fijo, con una foto, un audio o un PDF si querés. Podés usar {{nombre}} y {{proyecto}}."],
  ["pausa", "Pausa", "Unos segundos antes del paso siguiente, para que no salga todo de golpe."],
  ["ia", "La IA escribe", "Un mensaje que arma la IA con la ficha del proyecto, siguiendo tu consigna."],
  ["esperar", "Esperar respuesta", "Si la persona responde sigue por un camino; si no responde en el plazo, por el otro."],
  ["etapa", "Mover de etapa", "Cambia la etapa del lead en el CRM (con los cuidados de siempre: no toca Reserva ni Vendido)."],
  ["equipo", "Pasar al equipo", "Deja una nota y la conversación pasa a una persona. Termina el flujo."],
  ["seguir_ia", "Que siga la IA", "Desde acá conversa la IA con la ficha, como en el modo «Conversa». Termina el flujo."],
  ["fin", "Terminar", "No manda nada más. Si la persona escribe después, la atiende el equipo."],
] as const satisfies readonly (readonly [TipoPaso, string, string])[];

export const esTipoPaso = (x: unknown): x is TipoPaso => TIPOS_DE_PASO.some(([t]) => t === x);
export const tituloPaso = (t: TipoPaso) => TIPOS_DE_PASO.find(([x]) => x === t)![1];

/** Los que terminan el flujo (o lo dejan esperando): van al final de su lista. */
export const CIERRAN = ["esperar", "equipo", "seguir_ia", "fin"] as const satisfies readonly TipoPaso[];

export const LIMITES = {
  /** Pasos en todo el flujo, contando los de adentro de cada camino. */
  pasos: 60,
  /** Esperas una adentro de otra. */
  esperas_anidadas: 4,
  segundos_pausa: 60,
  pausa_por_tramo: 120,
  ia_por_tramo: 3,
  horas_min: 1,
  /** 30 días. */
  horas_max: 720,
  texto: 2000,
  consigna: 1000,
  nota: 500,
  nombre: 120,
} as const;

/** Las variables que se pueden usar en un mensaje (las mismas que en los seguimientos). */
export const VARIABLES_FLUJO = ["{{nombre}}", "{{proyecto}}"] as const;

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

type Objeto = Record<string, unknown>;
const esObjeto = (x: unknown): x is Objeto => Boolean(x) && typeof x === "object" && !Array.isArray(x);
const textoDe = (x: unknown) => (typeof x === "string" ? x.replace(/\r\n/g, "\n").trim() : "");
const entero = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" && x.trim() ? Number(x) : Number.NaN);

/** «paso 3» o «paso 2 de “Si responde” del paso 4»: para que el error diga dónde está. */
function donde(ruta: string[], i: number): string {
  return [`paso ${i + 1}`, ...ruta].join(" de ");
}

/**
 * Revisa los pasos que mandan el hub o el panel y los devuelve limpios (sin campos de más). Los
 * archivos tienen que existir (`archivos`: los ids que hay en la base; sin la lista, no se revisa).
 */
export function validarPasos(x: unknown, { archivos }: { archivos?: Set<number> } = {}): Resultado<Paso[]> {
  if (!Array.isArray(x) || !x.length) return { ok: false, error: "El flujo necesita al menos un paso." };
  let total = 0;

  function lista(pasos: unknown[], ruta: string[], profundidad: number): Resultado<Paso[]> {
    const limpios: Paso[] = [];
    let pausa = 0;
    let ia = 0;
    for (let i = 0; i < pasos.length; i++) {
      const p = pasos[i];
      const aca = donde(ruta, i);
      if (++total > LIMITES.pasos) return { ok: false, error: `El flujo tiene más de ${LIMITES.pasos} pasos: partilo o simplificalo.` };
      if (!esObjeto(p) || !esTipoPaso(p.tipo)) return { ok: false, error: `El ${aca} no es un paso que se pueda usar.` };
      const titulo = tituloPaso(p.tipo);
      if ((CIERRAN as readonly string[]).includes(p.tipo) && i < pasos.length - 1) {
        return { ok: false, error: `«${titulo}» (${aca}) tiene que ser el último de su camino: lo que va después no se mandaría nunca.` };
      }
      switch (p.tipo) {
        case "mensaje": {
          const texto = textoDe(p.texto);
          const archivo = p.archivo == null || p.archivo === "" ? null : entero(p.archivo);
          if (archivo !== null && (!Number.isInteger(archivo) || archivo <= 0)) return { ok: false, error: `El archivo del ${aca} no es válido.` };
          if (archivo !== null && archivos && !archivos.has(archivo)) return { ok: false, error: `El archivo del ${aca} ya no existe: volvé a subirlo.` };
          if (!texto && archivo === null) return { ok: false, error: `El ${aca} (Mensaje) está vacío: escribí el texto o elegí un archivo.` };
          if (texto.length > LIMITES.texto) return { ok: false, error: `El mensaje del ${aca} es muy largo (hasta ${LIMITES.texto} letras).` };
          const otras = texto.match(/\{\{[^}]*\}\}/g)?.filter((v) => !/^\{\{\s*(nombre|proyecto)\s*\}\}$/i.test(v));
          if (otras?.length) return { ok: false, error: `En el ${aca} solo se pueden usar {{nombre}} y {{proyecto}} (no ${otras[0]}).` };
          limpios.push({ tipo: "mensaje", texto, archivo });
          break;
        }
        case "pausa": {
          const segundos = entero(p.segundos);
          if (!Number.isInteger(segundos) || segundos < 1 || segundos > LIMITES.segundos_pausa) return { ok: false, error: `La pausa del ${aca} va de 1 a ${LIMITES.segundos_pausa} segundos.` };
          pausa += segundos;
          if (pausa > LIMITES.pausa_por_tramo) {
            return { ok: false, error: `Las pausas seguidas suman más de ${LIMITES.pausa_por_tramo} segundos (hasta el ${aca}). Para esperar más, usá «Esperar respuesta».` };
          }
          limpios.push({ tipo: "pausa", segundos });
          break;
        }
        case "ia":
        case "seguir_ia": {
          if (++ia > LIMITES.ia_por_tramo) return { ok: false, error: `La IA escribe más de ${LIMITES.ia_por_tramo} veces seguidas (hasta el ${aca}): poné una «Esperar respuesta» en el medio.` };
          if (p.tipo === "seguir_ia") {
            limpios.push({ tipo: "seguir_ia" });
            break;
          }
          const consigna = textoDe(p.consigna);
          if (!consigna) return { ok: false, error: `El ${aca} (La IA escribe) necesita una consigna: qué tiene que decir.` };
          if (consigna.length > LIMITES.consigna) return { ok: false, error: `La consigna del ${aca} es muy larga (hasta ${LIMITES.consigna} letras).` };
          limpios.push({ tipo: "ia", consigna });
          break;
        }
        case "esperar": {
          const horas = entero(p.horas);
          if (!Number.isInteger(horas) || horas < LIMITES.horas_min || horas > LIMITES.horas_max) return { ok: false, error: `La espera del ${aca} va de ${LIMITES.horas_min} hora a ${LIMITES.horas_max / 24} días.` };
          if (profundidad >= LIMITES.esperas_anidadas) return { ok: false, error: `Hay más de ${LIMITES.esperas_anidadas} esperas una adentro de otra (${aca}): simplificá el flujo.` };
          const si = lista(Array.isArray(p.si_responde) ? p.si_responde : [], [`«Si responde» del ${aca}`], profundidad + 1);
          if (!si.ok) return si;
          const no = lista(Array.isArray(p.si_no) ? p.si_no : [], [`«Si no responde» del ${aca}`], profundidad + 1);
          if (!no.ok) return no;
          limpios.push({ tipo: "esperar", horas, si_responde: si.valor, si_no: no.valor });
          break;
        }
        case "etapa": {
          const etapa = textoDe(p.etapa);
          if (!(ETAPAS_DESTINO as readonly string[]).includes(etapa)) return { ok: false, error: `En el ${aca}, el asistente solo puede mover a: ${ETAPAS_DESTINO.join(", ")}.` };
          limpios.push({ tipo: "etapa", etapa: etapa as EtapaDestino });
          break;
        }
        case "equipo": {
          const nota = textoDe(p.nota);
          if (nota.length > LIMITES.nota) return { ok: false, error: `La nota del ${aca} es muy larga (hasta ${LIMITES.nota} letras).` };
          limpios.push({ tipo: "equipo", nota });
          break;
        }
        case "fin":
          limpios.push({ tipo: "fin" });
          break;
      }
    }
    return { ok: true, valor: limpios };
  }

  return lista(x, [], 0);
}

/** Los archivos que usa un flujo (para no borrar uno que está en uso). */
export function archivosDe(pasos: Paso[]): number[] {
  const ids: number[] = [];
  const recorrer = (ps: Paso[]) => {
    for (const p of ps) {
      if (p.tipo === "mensaje" && p.archivo) ids.push(p.archivo);
      if (p.tipo === "esperar") (recorrer(p.si_responde), recorrer(p.si_no));
    }
  };
  recorrer(pasos);
  return [...new Set(ids)];
}

/**
 * Por dónde va una corrida: «3» es el cuarto paso de la lista principal; «3.si.0», el primero de
 * «si responde» de ese paso; «3.no.1.si.2»… Puro.
 */
export type Posicion = string;

interface Ubicacion {
  lista: Paso[];
  indice: number;
}

/** La lista y el índice de una posición, o null si la posición no existe en estos pasos. */
export function ubicar(pasos: Paso[], posicion: Posicion): Ubicacion | null {
  const partes = posicion.split(".");
  if (partes.length % 2 !== 1) return null;
  let lista = pasos;
  for (let i = 0; i < partes.length - 1; i += 2) {
    const n = Number(partes[i]);
    const paso = lista[n];
    if (!Number.isInteger(n) || paso?.tipo !== "esperar") return null;
    if (partes[i + 1] === "si") lista = paso.si_responde;
    else if (partes[i + 1] === "no") lista = paso.si_no;
    else return null;
  }
  const indice = Number(partes.at(-1));
  if (!Number.isInteger(indice) || indice < 0) return null;
  return { lista, indice };
}

/** El paso en esa posición (null si ahí se terminó la lista o la posición no existe). */
export function pasoEn(pasos: Paso[], posicion: Posicion): Paso | null {
  const u = ubicar(pasos, posicion);
  return u ? (u.lista[u.indice] ?? null) : null;
}

/** La posición del paso siguiente en la misma lista. */
export function siguiente(posicion: Posicion): Posicion {
  const partes = posicion.split(".");
  partes[partes.length - 1] = String(Number(partes.at(-1)) + 1);
  return partes.join(".");
}

/** El primer paso de un camino de una espera. */
export const rama = (posicion: Posicion, camino: "si" | "no"): Posicion => `${posicion}.${camino}.0`;

/** Horas → «1 hora», «12 horas», «1 día», «3 días», «1 semana». */
export function textoHoras(horas: number): string {
  if (horas % 168 === 0) return horas === 168 ? "1 semana" : `${horas / 168} semanas`;
  if (horas % 24 === 0) return horas === 24 ? "1 día" : `${horas / 24} días`;
  return horas === 1 ? "1 hora" : `${horas} horas`;
}

/** El flujo en texto, una línea por paso (para el panel y el registro). */
export function describirPasos(pasos: Paso[], sangria = ""): string[] {
  const lineas: string[] = [];
  pasos.forEach((p, i) => {
    const n = `${sangria}${i + 1}. `;
    switch (p.tipo) {
      case "mensaje":
        lineas.push(`${n}Mensaje: «${p.texto.slice(0, 120)}${p.texto.length > 120 ? "…" : ""}»${p.archivo ? " + archivo" : ""}`);
        break;
      case "pausa":
        lineas.push(`${n}Pausa de ${p.segundos} s`);
        break;
      case "ia":
        lineas.push(`${n}La IA escribe: ${p.consigna.slice(0, 120)}`);
        break;
      case "esperar":
        lineas.push(`${n}Esperar respuesta (hasta ${textoHoras(p.horas)})`);
        lineas.push(`${sangria}   Si responde:`, ...(p.si_responde.length ? describirPasos(p.si_responde, `${sangria}     `) : [`${sangria}     (terminar)`]));
        lineas.push(`${sangria}   Si no responde:`, ...(p.si_no.length ? describirPasos(p.si_no, `${sangria}     `) : [`${sangria}     (terminar)`]));
        break;
      case "etapa":
        lineas.push(`${n}Mover a «${p.etapa}»`);
        break;
      case "equipo":
        lineas.push(`${n}Pasar al equipo${p.nota ? `: ${p.nota}` : ""}`);
        break;
      default:
        lineas.push(`${n}${tituloPaso(p.tipo)}`);
    }
  });
  return lineas;
}

/** «Lerma 439!» → «lerma 439»: para comparar palabras sin acentos ni mayúsculas. */
const simple = (t: string) =>
  ` ${t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim()} `;

/**
 * Qué proyecto nombra el texto, por su nombre o sus palabras clave (palabras enteras: «53» no
 * coincide con «1532»). Null si no nombra ninguno o nombra más de uno (no se adivina).
 */
export function proyectoNombrado(texto: string, proyectos: { id: string; nombre: string; palabras_clave: string[] }[]): string | null {
  const t = simple(texto);
  const nombrados = proyectos.filter((p) => [p.nombre, ...p.palabras_clave].map(simple).some((k) => k.trim() && t.includes(k)));
  return nombrados.length === 1 ? nombrados[0].id : null;
}

export interface FlujoActivo {
  id: number;
  nombre: string;
  proyecto: string | null;
  pasos: Paso[];
}

/**
 * Qué flujo le toca a una persona nueva: el del proyecto que nombró, si hay uno activo; si no, el
 * general de la línea. Null: ninguno (atiende la IA, como siempre).
 */
export function elegirFlujo<P extends { id: string; nombre: string; palabras_clave: string[] }>(flujos: FlujoActivo[], proyectos: P[], texto: string): { flujo: FlujoActivo; proyecto: string | null } | null {
  const conFlujo = proyectos.filter((p) => flujos.some((f) => f.proyecto === p.id));
  const delProyecto = proyectoNombrado(texto, conFlujo);
  if (delProyecto) return { flujo: flujos.find((f) => f.proyecto === delProyecto)!, proyecto: delProyecto };
  const general = flujos.find((f) => !f.proyecto);
  if (!general) return null;
  return { flujo: general, proyecto: proyectoNombrado(texto, proyectos) };
}
