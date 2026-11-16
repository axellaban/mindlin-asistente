/**
 * El puntaje de cada persona de las bases de outreach (0 a 100): a quién conviene escribirle
 * primero. Idea traída del ranking de prospectos de Chapa Labs (habita.), adaptada a leads viejos
 * de departamentos. Cada variable suma puntos configurables desde el hub (0 la apaga); el detalle
 * queda guardado para mostrar por qué tiene ese puntaje y para medir qué responde mejor
 * («aprendizajes»).
 *
 * Una parte de cada tanda sale al azar (`exploracion`, 15 % de fábrica): sin eso, los de puntaje
 * bajo nunca se contactan y no se puede saber si el puntaje acierta.
 *
 * Puro.
 */

export interface PesosPuntaje {
  /** Hace cuánto consultó. */
  antiguedad: { hasta_6_meses: number; hasta_12_meses: number; hasta_24_meses: number; mas: number; sin_fecha: number };
  /** Consultó por un proyecto que hoy tiene ficha activa (o que existe pero está apagada). */
  proyecto: { activo: number; apagado: number };
  /** Hasta dónde llegó en el CRM en su momento. */
  crm: { visita_o_negociacion: number; seguimiento: number; nuevo: number };
  /** De dónde vino: si el origen contiene el texto, suma (el que más suma). */
  origenes: { texto: string; puntos: number }[];
  /** Tiene nombre y dice por qué proyecto consultó. */
  datos: { nombre: number; proyecto: number };
  /** WhatsApp verificado (con WAHA o porque ya le llegó un mensaje). */
  whatsapp: number;
}

export const PESOS_DE_FABRICA: PesosPuntaje = {
  antiguedad: { hasta_6_meses: 25, hasta_12_meses: 18, hasta_24_meses: 10, mas: 4, sin_fecha: 6 },
  proyecto: { activo: 20, apagado: 8 },
  crm: { visita_o_negociacion: 25, seguimiento: 12, nuevo: 4 },
  origenes: [
    { texto: "referido", puntos: 15 },
    { texto: "recomend", puntos: 15 },
    { texto: "web", puntos: 8 },
    { texto: "instagram", puntos: 6 },
    { texto: "facebook", puntos: 6 },
    { texto: "meta", puntos: 6 },
    { texto: "google", puntos: 6 },
    { texto: "zonaprop", puntos: 4 },
    { texto: "argenprop", puntos: 4 },
    { texto: "portal", puntos: 4 },
  ],
  datos: { nombre: 4, proyecto: 4 },
  whatsapp: 8,
};

export const EXPLORACION_DE_FABRICA = 15;

/** Lo que se sabe de la persona para puntuarla. */
export interface ParaPuntaje {
  nombre: string;
  proyecto: string | null;
  proyecto_texto: string;
  /** «AAAA-MM-DD» o null. */
  fecha_consulta: string | null;
  origen: string;
  crm_etapa: string | null;
  tiene_whatsapp: boolean | null;
}

/** Una línea del detalle: la variable, en qué caso cayó y cuánto sumó. */
export interface Parte {
  variable: "antiguedad" | "proyecto" | "crm" | "origen" | "datos" | "whatsapp";
  valor: string;
  puntos: number;
}

export const NOMBRES_VARIABLE: Record<Parte["variable"], string> = {
  antiguedad: "Hace cuánto consultó",
  proyecto: "Proyecto",
  crm: "Hasta dónde llegó en el CRM",
  origen: "De dónde vino",
  datos: "Datos",
  whatsapp: "WhatsApp",
};

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function meses(desde: string, hoy: string): number {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hoy.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

/**
 * El puntaje y su detalle. `activos` son los proyectos con ficha activa; `existentes`, todos.
 * `hoy` es «AAAA-MM-DD» (en Buenos Aires).
 */
export function puntuar(p: ParaPuntaje, w: PesosPuntaje, o: { activos: Set<string>; hoy: string }): { puntaje: number; detalle: Parte[] } {
  const detalle: Parte[] = [];
  const sumar = (variable: Parte["variable"], valor: string, puntos: number) => detalle.push({ variable, valor, puntos });

  if (!p.fecha_consulta) sumar("antiguedad", "sin fecha", w.antiguedad.sin_fecha);
  else {
    const m = meses(p.fecha_consulta, o.hoy);
    if (m < 6) sumar("antiguedad", "menos de 6 meses", w.antiguedad.hasta_6_meses);
    else if (m < 12) sumar("antiguedad", "de 6 a 12 meses", w.antiguedad.hasta_12_meses);
    else if (m < 24) sumar("antiguedad", "de 1 a 2 años", w.antiguedad.hasta_24_meses);
    else sumar("antiguedad", "más de 2 años", w.antiguedad.mas);
  }

  if (p.proyecto && o.activos.has(p.proyecto)) sumar("proyecto", "con ficha activa", w.proyecto.activo);
  else if (p.proyecto) sumar("proyecto", "con ficha apagada", w.proyecto.apagado);
  else sumar("proyecto", p.proyecto_texto.trim() ? "no reconocido" : "sin proyecto", 0);

  const etapa = p.crm_etapa ?? "";
  if (etapa === "Visita / reunión" || etapa === "Negociación") sumar("crm", "llegó a visita o negociación", w.crm.visita_o_negociacion);
  else if (etapa === "Seguimiento" || etapa === "Contacto inicial") sumar("crm", "llegó a seguimiento", w.crm.seguimiento);
  else if (etapa === "Nuevo" || etapa === "En pausa") sumar("crm", "estaba como nuevo", w.crm.nuevo);
  else sumar("crm", etapa === "Descartado" ? "descartado" : "no está en el CRM", 0);

  const origen = normal(p.origen);
  const coincide = origen ? w.origenes.filter((x) => x.texto.trim() && origen.includes(normal(x.texto.trim()))).sort((a, b) => b.puntos - a.puntos)[0] : undefined;
  sumar("origen", coincide ? coincide.texto : p.origen.trim() ? "otro" : "sin origen", coincide?.puntos ?? 0);

  const tieneNombre = /\p{L}{2,}/u.test(p.nombre);
  const tieneProyecto = Boolean(p.proyecto || p.proyecto_texto.trim());
  sumar(
    "datos",
    tieneNombre && tieneProyecto ? "nombre y proyecto" : tieneNombre ? "solo nombre" : tieneProyecto ? "solo proyecto" : "sin datos",
    (tieneNombre ? w.datos.nombre : 0) + (tieneProyecto ? w.datos.proyecto : 0),
  );

  sumar("whatsapp", p.tiene_whatsapp === true ? "verificado" : p.tiene_whatsapp === false ? "no tiene" : "sin verificar", p.tiene_whatsapp === true ? w.whatsapp : 0);

  const puntaje = Math.max(0, Math.min(100, detalle.reduce((n, x) => n + x.puntos, 0)));
  return { puntaje, detalle };
}

const entero = (x: unknown, min: number, max: number) => {
  const n = Number(x);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const esObjeto = (x: unknown): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x);

/** Los pesos bien armados (de 0 a 50 cada uno, hasta 20 orígenes), o el error. Lo que falta, de fábrica. */
export function validarPesos(x: unknown): { pesos: PesosPuntaje } | { error: string } {
  if (x === undefined) return { pesos: PESOS_DE_FABRICA };
  if (!esObjeto(x)) return { error: "Puntaje: falta." };
  const w = structuredClone(PESOS_DE_FABRICA) as unknown as Record<string, Record<string, number> | number | PesosPuntaje["origenes"]>;
  for (const grupo of ["antiguedad", "proyecto", "crm", "datos"] as const) {
    const g = esObjeto(x[grupo]) ? x[grupo] : {};
    for (const k of Object.keys(w[grupo] as Record<string, number>)) {
      if (g[k] === undefined) continue;
      const n = entero(g[k], 0, 50);
      if (n === null) return { error: "Puntaje: cada valor va de 0 a 50." };
      (w[grupo] as Record<string, number>)[k] = n;
    }
  }
  if (x.whatsapp !== undefined) {
    const n = entero(x.whatsapp, 0, 50);
    if (n === null) return { error: "Puntaje: cada valor va de 0 a 50." };
    w.whatsapp = n;
  }
  if (x.origenes !== undefined) {
    if (!Array.isArray(x.origenes) || x.origenes.length > 20) return { error: "Puntaje: hasta 20 orígenes." };
    const origenes: PesosPuntaje["origenes"] = [];
    for (const o of x.origenes) {
      const texto = esObjeto(o) ? String(o.texto ?? "").trim() : "";
      const puntos = esObjeto(o) ? entero(o.puntos, 0, 50) : null;
      if (texto.length < 3 || texto.length > 40 || puntos === null) return { error: "Puntaje: cada origen lleva un texto (de 3 a 40 letras) y puntos de 0 a 50." };
      origenes.push({ texto, puntos });
    }
    w.origenes = origenes;
  }
  return { pesos: w as unknown as PesosPuntaje };
}

// ─── Aprendizajes ───────────────────────────────────────────────────────────

/** Debajo de esto, la tasa es «muestra chica»: no sirve para decidir. */
export const MUESTRA_MINIMA = 30;

export interface Aprendizaje {
  variable: Parte["variable"];
  valor: string;
  contactados: number;
  respondieron: number;
  /** De 0 a 1, o null si nadie fue contactado. */
  tasa: number | null;
  muestra_chica: boolean;
}

/** Cada variable y valor contra cuántos respondieron (de los contactados). */
export function aprendizajes(filas: { detalle: Parte[]; respondio: boolean }[]): Aprendizaje[] {
  const grupos = new Map<string, Aprendizaje>();
  for (const f of filas) {
    for (const p of f.detalle) {
      const k = `${p.variable}|${p.valor}`;
      const g = grupos.get(k) ?? { variable: p.variable, valor: p.valor, contactados: 0, respondieron: 0, tasa: null, muestra_chica: true };
      g.contactados++;
      if (f.respondio) g.respondieron++;
      grupos.set(k, g);
    }
  }
  const orden = Object.keys(NOMBRES_VARIABLE);
  return [...grupos.values()]
    .map((g) => ({ ...g, tasa: g.contactados ? g.respondieron / g.contactados : null, muestra_chica: g.contactados < MUESTRA_MINIMA }))
    .sort((a, b) => orden.indexOf(a.variable) - orden.indexOf(b.variable) || b.contactados - a.contactados);
}
