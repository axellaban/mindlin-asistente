/**
 * La corrida de seguimientos (el cron, una vez por día): busca las conversaciones del bot que
 * quedaron sin respuesta, mira en el CRM en qué etapa está cada persona, elige la regla y manda
 * el mensaje por Chatwoot (así queda a la vista del equipo en la bandeja).
 *
 * Frena solo: si la persona responde, el paso vuelve a cero; si una persona del equipo tomó la
 * conversación, no lleva más seguimientos (lib/datos/postgres.ts, guardarMensaje y sinSeguimientos).
 */

import type { Chatwoot } from "../chatwoot/api";
import { claveTelefono, type ContactoCRM, type CRM } from "../crm/planilla";
import type { Almacen } from "../datos/tipos";
import { moverEtapa } from "../etapas/mover";
import type { ReglasEtapa } from "../etapas/reglas";
import { elegirRegla, enHorario, nombreDePila, pasaronLosDias, textoSeguimiento } from "./reglas";
import type { Modelo } from "../agente/agente";
import { retomarFlujos } from "../flujos/servicio";
import type { AvisarAlEquipo } from "../hub/aviso";
import { pausaAlAzar, PRESUPUESTO_MS } from "./espaciar";
import { diaDeAutomaticos } from "../agente/horario";

/** Cuántos seguimientos como mucho por corrida: WhatsApp por WAHA no es oficial y no conviene mandar de a muchos. */
export const TOPE_POR_CORRIDA = 20;

export interface ResultadoCorrida {
  estado: "listo" | "pausado" | "fuera de horario" | "sin reglas" | "sin CRM";
  revisadas: number;
  enviados: number;
  errores: number;
  /** Leads que cambiaron de etapa en el CRM en esta corrida (lib/etapas/reglas.ts). */
  movidos: number;
  /** Flujos que siguieron porque venció una espera (o se habían cortado). Cuentan para el tope. */
  flujos: number;
  /** Seguimientos que no entraron en el tiempo de la función (por las pausas): salen en la corrida siguiente. */
  postergados: number;
}

const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const detalle = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function correrSeguimientos({
  almacen,
  chatwoot,
  crm,
  ahora = new Date(),
  tope = TOPE_POR_CORRIDA,
  modelo = null,
  dormir = dormirReal,
  avisarAlEquipo = null,
  azar = Math.random,
  reloj = Date.now,
}: {
  almacen: Almacen;
  chatwoot: Chatwoot;
  crm: CRM | null;
  ahora?: Date;
  tope?: number;
  /** Para los pasos «La IA escribe» de los flujos. Sin ella, esos flujos pasan al equipo. */
  modelo?: Modelo | null;
  dormir?: (ms: number) => Promise<void>;
  /** Para avisar en el hub si un flujo pasa la conversación al equipo. */
  avisarAlEquipo?: AvisarAlEquipo | null;
  /** Para las pausas al azar entre mensajes (lib/seguimientos/espaciar.ts). */
  azar?: () => number;
  /** El tiempo que pasó de verdad (en milisegundos), para no pasarse de la función. */
  reloj?: () => number;
}): Promise<ResultadoCorrida> {
  const inicio = reloj();
  const resultado: ResultadoCorrida = { estado: "listo", revisadas: 0, enviados: 0, errores: 0, movidos: 0, flujos: 0, postergados: 0 };
  if (!enHorario(ahora)) return { ...resultado, estado: "fuera de horario" };
  if (await almacen.pausado()) return { ...resultado, estado: "pausado" };
  // Si Mindlin eligió que los automáticos salgan solo los días del equipo (sin feriados), hoy no sale nada:
  // ni seguimientos ni esperas de flujos. Lo que vence, sale el próximo día hábil.
  const horario = (await almacen.tono().catch(() => null))?.horario_equipo;
  if (horario && !diaDeAutomaticos(ahora, horario)) return { ...resultado, estado: "fuera de horario" };

  // Primero los flujos con esperas vencidas: son parte de una secuencia que ya arrancó.
  const sinIA: Modelo = async () => {
    throw new Error("Falta la clave de la IA en Vercel.");
  };
  const f = await retomarFlujos({ almacen, chatwoot, crm, modelo: modelo ?? sinIA, ahora: () => ahora, dormir, avisarAlEquipo }, { tope, azar }).catch(async (e) => {
    await almacen.registrar({ tipo: "error", conversacion: null, detalle: `Flujos (cron): ${detalle(e)}` }).catch(() => {});
    return { revisadas: 0, retomadas: 0, errores: 1 };
  });
  resultado.flujos = f.retomadas;
  resultado.errores += f.errores;
  tope = Math.max(0, tope - f.retomadas - f.errores);

  const reglas = await almacen.reglasVigentes();
  if (!reglas.length) return { ...resultado, estado: "sin reglas" };
  const [candidatos, proyectos, reglasEtapa] = await Promise.all([
    almacen.candidatosSeguimiento(ahora.toISOString()),
    almacen.proyectosActivos(),
    almacen.reglasEtapa().catch((): ReglasEtapa => ({})),
  ]);
  if (!candidatos.length) return resultado;

  // La etapa sale del CRM. Si el CRM está conectado pero no responde, no se manda nada: sin la
  // etapa se le podría escribir a alguien que el equipo ya está atendiendo.
  let contactos: ContactoCRM[] = [];
  if (crm) {
    try {
      contactos = await crm.contactos();
    } catch (e) {
      await almacen.registrar({ tipo: "error", conversacion: null, detalle: `Seguimientos: no se pudo leer el CRM: ${detalle(e)}` });
      return { ...resultado, estado: "sin CRM" };
    }
  }
  const porId = new Map(contactos.map((c) => [c.id, c]));
  const porTelefono = new Map(contactos.filter((c) => claveTelefono(c.telefono).length >= 8).map((c) => [claveTelefono(c.telefono), c]));

  // Espaciados (lib/seguimientos/espaciar.ts): unos segundos al azar entre un mensaje y el siguiente,
  // también después de los flujos, y sin pasarse del tiempo de la función.
  let salioAlgo = f.retomadas > 0;
  for (const c of candidatos) {
    if (resultado.enviados >= tope) break;
    resultado.revisadas++;
    const contacto = (c.crm_contacto_id && porId.get(c.crm_contacto_id)) || (c.telefono && porTelefono.get(claveTelefono(c.telefono))) || null;
    const etapa = contacto?.etapa ?? "Nuevo";
    const paso = c.paso_seguimiento + 1;
    const regla = elegirRegla(reglas, { etapa, paso, proyecto: c.proyecto, conversacion: c.chatwoot_id, linea: c.linea });
    if (!regla) {
      // Ya recibió seguimientos, no hay un paso más y desde el último pasó al menos una corrida
      // (los candidatos son los callados desde la corrida anterior): «no respondió a ningún seguimiento».
      if (c.paso_seguimiento >= 1 && (await moverEtapa({ crm, almacen, conversacion: c.chatwoot_id, contacto, eventos: ["sin_respuesta"], reglas: reglasEtapa, ahora: ahora.toISOString() }))) {
        resultado.movidos++;
      }
      continue;
    }
    if (!pasaronLosDias(c, regla, ahora)) continue;
    if (salioAlgo) {
      const pausa = pausaAlAzar(azar);
      if (reloj() - inicio + pausa > PRESUPUESTO_MS) {
        // No se reclamó: sigue siendo candidato y sale en la corrida siguiente.
        resultado.postergados++;
        continue;
      }
      await dormir(pausa);
    }

    const cuando = ahora.toISOString();
    if (!(await almacen.reclamarSeguimiento({ conversacion: c.chatwoot_id, pasoAnterior: c.paso_seguimiento, regla: regla.id, ahora: cuando }))) continue;
    const proyecto = proyectos.find((p) => p.id === (c.proyecto ?? regla.proyecto)) ?? (proyectos.length === 1 ? proyectos[0] : null);
    const texto = textoSeguimiento(regla.mensaje, { nombre: [contacto?.nombre, c.nombre_anotado, c.nombre].map(nombreDePila).find(Boolean) ?? "", proyecto: proyecto?.nombre ?? "" });
    try {
      const mensajeId = await chatwoot.enviar(c.chatwoot_id, texto);
      await almacen.anotarSeguimiento({ conversacion: c.chatwoot_id, regla: regla.id, etapa, paso, version: regla.version, texto, mensaje_id: mensajeId, enviado: cuando });
      await almacen.registrar({ tipo: "seguimiento", conversacion: c.chatwoot_id, detalle: texto.slice(0, 500), datos: { regla: regla.id, etapa, paso, version: regla.version } });
      if (crm && contacto) {
        await crm.anotarActividad({ contacto, detalle: `Seguimiento automático (${paso}.º): ${texto}`, ahora: cuando }).catch(() => {});
      }
      if (await moverEtapa({ crm, almacen, conversacion: c.chatwoot_id, contacto, eventos: ["seguimiento_enviado"], reglas: reglasEtapa, ahora: cuando })) resultado.movidos++;
      resultado.enviados++;
      salioAlgo = true;
    } catch (e) {
      // Ya quedó contado: no se reintenta en la próxima corrida (mejor uno menos que uno repetido).
      resultado.errores++;
      await almacen.registrar({ tipo: "error", conversacion: c.chatwoot_id, detalle: `Seguimiento: ${detalle(e)}`, datos: { regla: regla.id, paso } }).catch(() => {});
    }
  }
  return resultado;
}
