/**
 * Seguimientos: si alguien consultó, el bot le contestó y la persona no volvió a escribir, le
 * manda un mensaje corto después de unos días. Lo que dice y cuándo lo deciden las reglas que
 * carga Mindlin en la tabla `reglas_seguimiento` (por etapa del CRM y por paso).
 *
 * Cuidados, porque WhatsApp por WAHA no es oficial y un número que molesta termina bloqueado:
 * - Solo a quien escribió primero y en conversaciones que atiende el bot. Si una persona del
 *   equipo escribió o tomó la conversación, nunca más.
 * - De lunes a sábado, de 9 a 20 (hora de Buenos Aires).
 * - Tope de pasos (los que haya en las reglas, hasta 5) y de envíos por corrida, con una pausa
 *   entre uno y otro.
 * - Si la persona vuelve a escribir, la cuenta de pasos empieza de cero.
 * - El mensaje es el texto de la regla, tal cual lo aprobó Mindlin: no lo inventa la IA.
 *
 * Lo dispara un cron cada 15 minutos (desde el servidor, ver infra/servidor.sh) con CRON_SECRET.
 */

import type { Chatwoot } from "./chatwoot/api";
import type { CRM } from "./crm/planilla";
import type { Almacen, CandidatoSeguimiento, ReglaSeguimiento } from "./datos/tipos";

export const HORA_DESDE = 9;
export const HORA_HASTA = 20;
export const MAXIMO_POR_CORRIDA = 10;
export const PAUSA_MS = 5000;
const DIA_MS = 86_400_000;

/** La hora y el día de la semana en Buenos Aires. */
function enBuenosAires(ahora: Date): { hora: number; dia: number } {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(ahora);
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(partes.find((p) => p.type === "weekday")?.value ?? "");
  return { hora, dia };
}

/** De lunes a sábado, de 9 a 20 en Buenos Aires. */
export function enHorario(ahora: Date): boolean {
  const { hora, dia } = enBuenosAires(ahora);
  return dia >= 1 && dia <= 6 && hora >= HORA_DESDE && hora < HORA_HASTA;
}

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/**
 * La regla para este paso. Gana la del proyecto sobre la general. Si hay una «activa» y otra
 * «a_prueba» para lo mismo, se reparten las conversaciones mitad y mitad (pares e impares) para
 * comparar cuál funciona mejor.
 */
export function elegirRegla(reglas: ReglaSeguimiento[], c: { etapa: string; paso: number; proyecto: string | null; conversacion: number }): ReglaSeguimiento | null {
  const aplican = reglas.filter((r) => r.estado !== "archivada" && r.paso === c.paso && normalizar(r.etapa) === normalizar(c.etapa) && (r.proyecto === null || r.proyecto === c.proyecto));
  if (!aplican.length) return null;
  const propias = aplican.filter((r) => r.proyecto !== null);
  const grupo = propias.length ? propias : aplican;
  const ultima = (estado: ReglaSeguimiento["estado"]) =>
    grupo.filter((r) => r.estado === estado).sort((a, b) => b.version - a.version || b.id - a.id)[0];
  const activa = ultima("activa");
  const aPrueba = ultima("a_prueba");
  if (activa && aPrueba) return c.conversacion % 2 === 0 ? activa : aPrueba;
  return activa ?? aPrueba ?? null;
}

/** Reemplaza {{nombre}} (solo el primer nombre) y {{proyecto}}. Si no hay nombre, lo saca sin dejar «Hola ,». */
export function armarMensaje(plantilla: string, { nombre, proyecto }: { nombre: string | null; proyecto: string | null }): string {
  const primero = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  return plantilla
    .replace(/\s*\{\{\s*nombre\s*\}\}/g, primero ? ` ${primero}` : "")
    .replace(/\{\{\s*proyecto\s*\}\}/g, proyecto ?? "el proyecto")
    .replace(/^\s+/, "")
    .replace(/ +([,.!?])/g, "$1");
}

export interface ServiciosSeguimiento {
  almacen: Almacen;
  chatwoot: Chatwoot;
  crm: CRM | null;
  ahora?: () => Date;
  dormir?: (ms: number) => Promise<void>;
  maximo?: number;
  pausaMs?: number;
}

export interface ResultadoSeguimientos {
  enviados: number;
  revisados: number;
  motivo?: string;
  errores: string[];
}

const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const detalle = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function correrSeguimientos(s: ServiciosSeguimiento): Promise<ResultadoSeguimientos> {
  const ahora = (s.ahora ?? (() => new Date()))();
  if (!enHorario(ahora)) return { enviados: 0, revisados: 0, motivo: "fuera de horario (lunes a sábado de 9 a 20)", errores: [] };
  const reglas = (await s.almacen.reglasSeguimiento()).filter((r) => r.estado !== "archivada");
  if (!reglas.length) return { enviados: 0, revisados: 0, motivo: "no hay reglas activas", errores: [] };
  const minimoDias = Math.min(...reglas.map((r) => r.dias_sin_respuesta));
  const candidatos = await s.almacen.candidatosSeguimiento(new Date(ahora.getTime() - minimoDias * DIA_MS));
  const nombres = new Map((await s.almacen.proyectosActivos()).map((p) => [p.id, p.nombre]));

  const maximo = s.maximo ?? MAXIMO_POR_CORRIDA;
  const errores: string[] = [];
  let enviados = 0;
  for (const c of candidatos) {
    if (enviados >= maximo) break;
    try {
      const enviado = await seguir(s, c, reglas, nombres, ahora);
      if (!enviado) continue;
      enviados++;
      if (enviados < maximo) await (s.dormir ?? dormirReal)(s.pausaMs ?? PAUSA_MS);
    } catch (e) {
      errores.push(`conversación ${c.chatwoot_id}: ${detalle(e)}`);
      await s.almacen.registrar({ tipo: "error", conversacion: c.chatwoot_id, detalle: `Seguimiento: ${detalle(e)}` }).catch(() => {});
    }
  }
  return { enviados, revisados: candidatos.length, errores };
}

async function seguir(s: ServiciosSeguimiento, c: CandidatoSeguimiento, reglas: ReglaSeguimiento[], nombres: Map<string, string>, ahora: Date): Promise<boolean> {
  const contacto = s.crm && c.telefono ? await s.crm.buscarPorTelefono(c.telefono) : null;
  const etapa = contacto?.etapa || "Nuevo";
  const paso = c.paso + 1;
  const regla = elegirRegla(reglas, { etapa, paso, proyecto: c.proyecto, conversacion: c.chatwoot_id });
  if (!regla) return false;
  if (ahora.getTime() - Date.parse(c.ultimo_mensaje) < regla.dias_sin_respuesta * DIA_MS) return false;

  const texto = armarMensaje(regla.mensaje, { nombre: c.nombre || contacto?.nombre || null, proyecto: c.proyecto ? (nombres.get(c.proyecto) ?? null) : null });
  // Primero se anota (así, si algo falla después, no se manda dos veces) y después se envía.
  await s.almacen.anotarSeguimiento(c.chatwoot_id, paso, regla.id, ahora.toISOString());
  const id = await s.chatwoot.enviar(c.chatwoot_id, texto);
  // Se guarda en el historial como mensaje del bot: así cuenta como el último y no se toma por un eco.
  if (id != null) await s.almacen.guardarMensaje({ id, conversacion: c.chatwoot_id, rol: "bot", texto, fecha: ahora.toISOString() });
  await s.almacen.registrar({ tipo: "seguimiento", conversacion: c.chatwoot_id, detalle: texto.slice(0, 500), datos: { paso, regla: regla.id, version: regla.version, estado: regla.estado, etapa } });
  if (s.crm && contacto) {
    await s.crm.anotarActividad({ contacto, detalle: `Seguimiento automático ${paso} (regla ${regla.id}, versión ${regla.version}): ${texto}`, ahora: ahora.toISOString() }).catch(() => {});
  }
  return true;
}
