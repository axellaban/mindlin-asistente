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
}

export const HORARIO_EQUIPO_DE_FABRICA: HorarioEquipo = { dias: [1, 2, 3, 4, 5], desde: 9, hasta: 20 };

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
  return { dias: SEMANA.filter((d) => dias.includes(d)), desde, hasta };
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
