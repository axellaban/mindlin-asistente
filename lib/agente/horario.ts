/**
 * Cuándo trabaja el equipo comercial (hora de Buenos Aires). Lo carga Mindlin desde el hub o el
 * panel (se guarda con el tono). Fuera de ese horario el asistente sigue atendiendo igual; solo
 * cambia lo que avisa si pasa la conversación a una persona («te escriben apenas vuelvan»).
 *
 * Puro (sin red ni base).
 */

/** Días: 0 es domingo, 1 lunes … 6 sábado. Horas enteras: de `desde` (incluida) a `hasta` (sin incluir). */
export interface HorarioEquipo {
  dias: number[];
  desde: number;
  hasta: number;
  /**
   * Cuándo salen los mensajes automáticos (seguimientos y esperas de los flujos): «todos_los_dias»
   * (de fábrica, como siempre) o «dias_del_equipo» (solo los días de arriba, y no en los feriados).
   * Siempre de 9 a 20.
   */
  automaticos?: "todos_los_dias" | "dias_del_equipo";
  /** Días sin mensajes automáticos (AAAA-MM-DD), si `automaticos` es «dias_del_equipo». */
  feriados?: string[];
}

export const HORARIO_EQUIPO_DE_FABRICA: HorarioEquipo = { dias: [1, 2, 3, 4, 5], desde: 9, hasta: 20 };

/** «2026-12-25», «25/12/2026» o «25/12/26» → «2026-12-25»; null si no es una fecha. */
export function fechaFeriado(t: string): string | null {
  const s = t.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [a, me, d] = m ? [m[1], m[2], m[3]] : ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)) ? [m[3].length === 2 ? `20${m[3]}` : m[3], m[2].padStart(2, "0"), m[1].padStart(2, "0")] : []);
  if (!a) return null;
  const f = `${a}-${me}-${d}`;
  const x = new Date(`${f}T12:00:00Z`);
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === f ? f : null;
}

const FECHA_BA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" });
const DIA_BA = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short" });

/**
 * ¿Hoy pueden salir mensajes automáticos? Con «todos_los_dias», siempre (el horario de 9 a 20 lo
 * mira cada corrida); con «dias_del_equipo», solo los días del equipo que no son feriado.
 */
export function diaDeAutomaticos(ahora: Date, h: HorarioEquipo): boolean {
  if (h.automaticos !== "dias_del_equipo") return true;
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(DIA_BA.format(ahora));
  return h.dias.includes(dia) && !(h.feriados ?? []).includes(FECHA_BA.format(ahora));
}

export const NOMBRES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

/** La semana como la piensa el equipo: de lunes a domingo. */
const SEMANA = [1, 2, 3, 4, 5, 6, 0];

/**
 * Un horario bien armado, o null. Sirve para lo que viene de la base (por si alguien lo tocó a
 * mano) y para lo que mandan el panel o el hub.
 */
export function horarioValido(x: unknown): HorarioEquipo | null {
  if (!x || typeof x !== "object") return null;
  const h = x as Record<string, unknown>;
  if (!Array.isArray(h.dias)) return null;
  const dias = [...new Set(h.dias.map(Number))];
  if (!dias.length || dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return null;
  const desde = Number(h.desde);
  const hasta = Number(h.hasta);
  if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 0 || hasta > 24 || desde >= hasta) return null;
  const base: HorarioEquipo = { dias: SEMANA.filter((d) => dias.includes(d)), desde, hasta };
  // Lo de los automáticos es opcional: lo que no se entiende queda como de fábrica.
  if (h.automaticos === "dias_del_equipo") base.automaticos = "dias_del_equipo";
  const feriados = Array.isArray(h.feriados) ? [...new Set(h.feriados.map((x) => fechaFeriado(String(x))).filter((x): x is string => !!x))].sort() : [];
  if (feriados.length) base.feriados = feriados;
  return base;
}

/** «de lunes a viernes de 9 a 20», «lunes, miércoles y viernes de 10 a 18», «todos los días de 9 a 21». */
export function textoHorario(h: HorarioEquipo): string {
  const orden = SEMANA.filter((d) => h.dias.includes(d));
  const nombres = orden.map((d) => NOMBRES_DIAS[d]);
  const seguidos = orden.every((d, i) => i === 0 || SEMANA.indexOf(d) === SEMANA.indexOf(orden[i - 1]) + 1);
  let dias: string;
  if (orden.length === 7) dias = "todos los días";
  else if (orden.length >= 3 && seguidos) dias = `de ${nombres[0]} a ${nombres.at(-1)}`;
  else if (nombres.length === 1) dias = `los ${nombres[0]}${/s$/.test(nombres[0]) ? "" : "s"}`;
  else dias = `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
  const horas = h.desde === 0 && h.hasta === 24 ? "todo el día" : `de ${h.desde} a ${h.hasta}`;
  return `${dias} ${horas}`;
}

const DIA_Y_HORA = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", hour: "numeric", hourCycle: "h23" });
const DIAS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** ¿Está trabajando el equipo ahora? */
export function equipoTrabajando(ahora: Date, h: HorarioEquipo = HORARIO_EQUIPO_DE_FABRICA): boolean {
  const partes = DIA_Y_HORA.formatToParts(ahora);
  const dia = DIAS_EN.indexOf(partes.find((p) => p.type === "weekday")?.value ?? "");
  const hora = Number(partes.find((p) => p.type === "hour")?.value);
  return h.dias.includes(dia) && hora >= h.desde && hora < h.hasta;
}
