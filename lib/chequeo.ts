/**
 * Probar las conexiones de verdad, no solo que las variables existan (eso lo dice /api/salud).
 * Nació el 13/11: con el Chatwoot reinstalado, /api/salud decía «completo» pero las claves
 * cargadas eran las del Chatwoot anterior y el asistente no contestaba.
 *
 * No manda nada a nadie ni cambia nada:
 * - Chatwoot: lee la versión y prueba el token del Agent Bot pidiendo cambiar el estado de una
 *   conversación que no existe (la 0). Chatwoot revisa el token antes de buscar la conversación: un
 *   token que no sirve da 401, y uno que sirve llega a buscarla y da 404. Ese 404 («Resource could
 *   not be found» en Chatwoot 4.19.1) es el mismo si la cuenta no existe, así que la cuenta se
 *   confirma de verdad con las respuestas: si estuviera mal, el error aparece en «Respuestas del asistente».
 * - Base: lee la pausa, las reglas y lo último que pasó (el último mensaje que llegó, la última
 *   respuesta y el último error).
 * - CRM: lee los títulos de las dos pestañas y los compara con las columnas que espera el asistente.
 * - IA: un pedido mínimo (cuesta una fracción de centavo).
 *
 * Lo usan el panel (/panel/chequeo) y el hub (GET /api/hub/chequeo).
 */

import type { ConfigChatwoot } from "./chatwoot/api";
import { COLUMNAS_ACTIVIDAD, COLUMNAS_CONTACTOS, letraColumna, PESTANIA_ACTIVIDAD, PESTANIA_CONTACTOS, type Hoja } from "./crm/planilla";
import type { Modelo } from "./agente/agente";
import type { DatosPanel } from "./panel/datos";
import { CORRIDA } from "./seguimientos/reglas";

export type EstadoPrueba = "ok" | "aviso" | "falla";

export interface PruebaConexion {
  /** Qué se probó: «Chatwoot», «Base de datos»… */
  que: string;
  estado: EstadoPrueba;
  /** Qué pasó, listo para mostrarle a una persona. */
  detalle: string;
}

export interface Chequeo {
  /** Ninguna prueba falló (los avisos no cuentan como falla). */
  ok: boolean;
  fecha: string;
  pruebas: PruebaConexion[];
}

export interface DependenciasChequeo {
  chatwoot: ConfigChatwoot | null;
  datos: Pick<DatosPanel, "estado" | "reglas" | "ultimaActividad"> | null;
  hoja: Hoja | null;
  modelo: Modelo | null;
  ia: { proveedor: string | null; modelo: string | null };
  /** Si está CRON_SECRET (sin ella no sale ningún seguimiento). */
  cron: boolean;
  pedir?: typeof fetch;
  ahora?: () => Date;
}

/** Cuánto esperar cada prueba. */
export const TIEMPO_MAXIMO_PRUEBA_MS = 25_000;

const detalleDe = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

const FECHA = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** «13/11, 15:20» (hora de Buenos Aires). */
export const cuando = (iso: string) => FECHA.format(new Date(iso));

function conTiempo<T>(p: Promise<T>, ms = TIEMPO_MAXIMO_PRUEBA_MS): Promise<T> {
  return Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`no contestó en ${ms / 1000} segundos`)), ms))]);
}

export async function chequearConexiones(d: DependenciasChequeo): Promise<Chequeo> {
  const ahora = d.ahora ?? (() => new Date());
  const grupos = await Promise.all([probarChatwoot(d), probarBase(d), probarCRM(d), probarIA(d)]);
  const pruebas = grupos.flat();
  return { ok: pruebas.every((p) => p.estado !== "falla"), fecha: ahora().toISOString(), pruebas };
}

async function probarChatwoot({ chatwoot: cfg, pedir = fetch }: DependenciasChequeo): Promise<PruebaConexion[]> {
  const que = "Chatwoot";
  if (!cfg) return [{ que, estado: "falla", detalle: "Faltan las variables de Chatwoot en Vercel (CHATWOOT_URL, CHATWOOT_ACCOUNT_ID y CHATWOOT_BOT_TOKEN)." }];
  let version = "";
  try {
    const r = await conTiempo(pedir(`${cfg.url}/api`, { signal: AbortSignal.timeout(TIEMPO_MAXIMO_PRUEBA_MS) }));
    if (!r.ok) return [{ que, estado: "falla", detalle: `${cfg.url}/api respondió ${r.status}: no parece un Chatwoot andando (revisá CHATWOOT_URL).` }];
    version = String(((await r.json().catch(() => null)) as { version?: unknown } | null)?.version ?? "");
  } catch (e) {
    return [{ que, estado: "falla", detalle: `No se llega a ${cfg.url}: ${detalleDe(e)}. Revisá CHATWOOT_URL y que el servidor esté andando.` }];
  }
  const cual = `Chatwoot${version ? ` ${version}` : ""} en ${cfg.url}`;
  try {
    const r = await conTiempo(
      pedir(`${cfg.url}/api/v1/accounts/${encodeURIComponent(cfg.cuenta)}/conversations/0/toggle_status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify({ status: "open" }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_PRUEBA_MS),
      }),
    );
    const cuerpo = (await r.text().catch(() => "")).slice(0, 200);
    // Si Chatwoot dice que lo que no encuentra es la cuenta, es CHATWOOT_ACCOUNT_ID.
    if (r.status === 404 && /account/i.test(cuerpo) && !/conversation/i.test(cuerpo)) {
      return [{ que, estado: "falla", detalle: `${cual} responde, pero no tiene la cuenta ${cfg.cuenta}: revisá CHATWOOT_ACCOUNT_ID.` }];
    }
    // Cualquier otro 404 («Resource could not be found» en 4.19.1): el token pasó y buscó la conversación 0, que no existe.
    if (r.status === 404 || r.ok) return [{ que, estado: "ok", detalle: `${cual} responde y acepta el token del Agent Bot (cuenta ${cfg.cuenta}).` }];
    if (r.status === 401 && /bot is not authorized|account/i.test(cuerpo)) {
      return [{ que, estado: "falla", detalle: `${cual} reconoce el token, pero el Agent Bot no está asignado a ninguna bandeja de la cuenta ${cfg.cuenta} (o la cuenta es otra). Respuesta: ${cuerpo}` }];
    }
    if (r.status === 401) {
      return [{ que, estado: "falla", detalle: `${cual} no acepta el token del Agent Bot (CHATWOOT_BOT_TOKEN): puede ser el de un Chatwoot anterior. Respuesta: ${cuerpo || "401"}` }];
    }
    return [{ que, estado: "aviso", detalle: `${cual} responde, pero no se pudo confirmar el token del Agent Bot: respondió ${r.status} ${cuerpo}` }];
  } catch (e) {
    return [{ que, estado: "falla", detalle: `${cual} responde, pero no se pudo probar el token del Agent Bot: ${detalleDe(e)}` }];
  }
}

async function probarBase({ datos, cron }: DependenciasChequeo): Promise<PruebaConexion[]> {
  if (!datos) return [{ que: "Base de datos", estado: "falla", detalle: "Falta la base (DATABASE_URL) en Vercel: sin ella el asistente no puede atender." }];
  try {
    const [estado, reglas, act] = await conTiempo(Promise.all([datos.estado(), datos.reglas(), datos.ultimaActividad()]));
    const quien = [estado.cambiado_por && `lo pausó ${estado.cambiado_por}`, estado.cambiado && `el ${cuando(estado.cambiado)}`].filter(Boolean).join(", ");
    const pruebas: PruebaConexion[] = [
      estado.pausado
        ? { que: "Base de datos", estado: "aviso", detalle: `Responde, pero el asistente está pausado${quien ? ` (${quien})` : ""}: cada conversación pasa al equipo. Se reactiva desde el Resumen.` }
        : { que: "Base de datos", estado: "ok", detalle: "Responde, y el asistente está prendido." },
    ];

    if (!act.ultimo_mensaje) {
      pruebas.push({ que: "Mensajes de WhatsApp", estado: "aviso", detalle: "Todavía no llegó ninguno. Mandá un WhatsApp de prueba a la línea desde un número al que nadie del equipo le haya respondido." });
    } else {
      pruebas.push({ que: "Mensajes de WhatsApp", estado: "ok", detalle: `Chatwoot le avisa al asistente: el último llegó el ${cuando(act.ultimo_mensaje.fecha)} (conversación ${act.ultimo_mensaje.conversacion}).` });
    }

    const { ultima_respuesta: resp, ultimo_error: err } = act;
    if (err && (!resp || Date.parse(err.fecha) > Date.parse(resp.fecha))) {
      pruebas.push({
        que: "Respuestas del asistente",
        estado: "aviso",
        detalle: `${resp ? `La última salió el ${cuando(resp.fecha)}, pero después` : "Todavía no respondió ninguna, y"} hubo un error el ${cuando(err.fecha)}${err.conversacion != null ? ` (conversación ${err.conversacion})` : ""}: ${err.detalle.slice(0, 200)}`,
      });
    } else if (resp) {
      pruebas.push({ que: "Respuestas del asistente", estado: "ok", detalle: `La última salió el ${cuando(resp.fecha)}${resp.conversacion != null ? ` (conversación ${resp.conversacion})` : ""}.` });
    } else {
      pruebas.push({ que: "Respuestas del asistente", estado: "aviso", detalle: "Todavía no respondió ninguna. Si ya llegaron mensajes, fijate que la conversación esté «Pendiente» en Chatwoot: si está abierta, la atiende el equipo." });
    }

    const enUso = reglas.filter((r) => r.estado !== "archivada").length;
    if (!cron) pruebas.push({ que: "Seguimientos", estado: "aviso", detalle: "Falta CRON_SECRET en Vercel: no sale ninguno." });
    else if (!enUso) pruebas.push({ que: "Seguimientos", estado: "aviso", detalle: `Corren ${CORRIDA.texto}, pero no hay ninguna regla en uso: no sale ninguno.` });
    else pruebas.push({ que: "Seguimientos", estado: "ok", detalle: `Corren ${CORRIDA.texto}, con ${enUso === 1 ? "1 regla" : `${enUso} reglas`} en uso.` });
    return pruebas;
  } catch (e) {
    return [{ que: "Base de datos", estado: "falla", detalle: `No responde: ${detalleDe(e)}` }];
  }
}

async function probarCRM({ hoja }: DependenciasChequeo): Promise<PruebaConexion[]> {
  const que = "CRM (planilla)";
  if (!hoja) return [{ que, estado: "aviso", detalle: "No está conectado (faltan GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY o CRM_SHEET_ID): el asistente atiende igual, pero no anota nada en el CRM." }];
  try {
    const [contactos, actividad] = await conTiempo(
      Promise.all([hoja.leer(`'${PESTANIA_CONTACTOS}'!A1:${letraColumna(COLUMNAS_CONTACTOS.length)}1`), hoja.leer(`'${PESTANIA_ACTIVIDAD}'!A1:${letraColumna(COLUMNAS_ACTIVIDAD.length)}1`)]),
    );
    const distintas = [...diferencias(PESTANIA_CONTACTOS, contactos[0] ?? [], COLUMNAS_CONTACTOS), ...diferencias(PESTANIA_ACTIVIDAD, actividad[0] ?? [], COLUMNAS_ACTIVIDAD)];
    if (distintas.length) {
      return [{ que, estado: "falla", detalle: `La planilla responde, pero las columnas no son las que espera el asistente: ${distintas.slice(0, 3).join(" ")}${distintas.length > 3 ? ` (y ${distintas.length - 3} más)` : ""}` }];
    }
    return [{ que, estado: "ok", detalle: "La planilla responde y sus columnas son las que espera el asistente." }];
  } catch (e) {
    return [{ que, estado: "falla", detalle: `No se pudo leer la planilla: ${detalleDe(e)}. Revisá que esté compartida con la cuenta de servicio y que CRM_SHEET_ID sea el de la planilla.` }];
  }
}

/** Las columnas que no coinciden, en castellano («En «CRM Contactos», la columna E dice «Correo» y tendría que decir «Mail».»). */
function diferencias(pestania: string, titulos: string[], esperadas: readonly string[]): string[] {
  if (!titulos.length) return [`La pestaña «${pestania}» no existe o está vacía.`];
  return esperadas.flatMap((esperada, i) => {
    const hay = (titulos[i] ?? "").trim();
    if (hay.toLowerCase() === esperada.toLowerCase()) return [];
    return [`En «${pestania}», la columna ${letraColumna(i + 1)} ${hay ? `dice «${hay}»` : "está vacía"} y tendría que decir «${esperada}».`];
  });
}

async function probarIA({ modelo, ia }: DependenciasChequeo): Promise<PruebaConexion[]> {
  const que = "IA";
  if (!modelo) return [{ que, estado: "falla", detalle: "Falta la clave de la IA en Vercel (ANTHROPIC_API_KEY u OPENAI_API_KEY): el asistente no puede responder." }];
  const nombre = `${ia.proveedor === "openai" ? "OpenAI" : "Claude"}${ia.modelo ? ` (${ia.modelo})` : ""}`;
  const inicio = Date.now();
  try {
    const r = await conTiempo(
      modelo({ system: [{ type: "text", text: "Es una prueba de conexión. Contestá solo: ok" }], tools: [], messages: [{ role: "user", content: "¿Me escuchás?" }] }),
      60_000,
    );
    const texto = r.content.some((b) => b.type === "text" && b.text.trim());
    const segundos = ((Date.now() - inicio) / 1000).toFixed(1).replace(".", ",");
    return [{ que, estado: texto ? "ok" : "aviso", detalle: texto ? `Responde ${nombre}, en ${segundos} segundos.` : `${nombre} contestó sin texto (terminó por «${r.stop_reason ?? "?"}»).` }];
  } catch (e) {
    return [{ que, estado: "falla", detalle: `${nombre} no respondió: ${detalleDe(e)}` }];
  }
}
