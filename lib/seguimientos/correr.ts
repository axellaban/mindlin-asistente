/**
 * La corrida de seguimientos (el cron, cada 15 minutos): busca las conversaciones del bot que
 * quedaron sin respuesta, mira en el CRM en qué etapa está cada persona, elige la regla y manda
 * el mensaje por Chatwoot (así queda a la vista del equipo en la bandeja).
 *
 * Frena solo: si la persona responde, el paso vuelve a cero; si una persona del equipo tomó la
 * conversación, no lleva más seguimientos (lib/datos/postgres.ts, guardarMensaje y sinSeguimientos).
 */

import type { Chatwoot } from "../chatwoot/api";
import { claveTelefono, type ContactoCRM, type CRM } from "../crm/planilla";
import type { Almacen } from "../datos/tipos";
import { elegirRegla, enHorario, nombreDePila, pasaronLosDias, textoSeguimiento } from "./reglas";

/** Cuántos seguimientos como mucho por corrida: WhatsApp por WAHA no es oficial y no conviene mandar de a muchos. */
export const TOPE_POR_CORRIDA = 20;

export interface ResultadoCorrida {
  estado: "listo" | "pausado" | "fuera de horario" | "sin reglas" | "sin CRM";
  revisadas: number;
  enviados: number;
  errores: number;
}

const detalle = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function correrSeguimientos({
  almacen,
  chatwoot,
  crm,
  ahora = new Date(),
  tope = TOPE_POR_CORRIDA,
}: {
  almacen: Almacen;
  chatwoot: Chatwoot;
  crm: CRM | null;
  ahora?: Date;
  tope?: number;
}): Promise<ResultadoCorrida> {
  const resultado: ResultadoCorrida = { estado: "listo", revisadas: 0, enviados: 0, errores: 0 };
  if (!enHorario(ahora)) return { ...resultado, estado: "fuera de horario" };
  if (await almacen.pausado()) return { ...resultado, estado: "pausado" };
  const reglas = await almacen.reglasVigentes();
  if (!reglas.length) return { ...resultado, estado: "sin reglas" };
  const [candidatos, proyectos] = await Promise.all([almacen.candidatosSeguimiento(ahora.toISOString()), almacen.proyectosActivos()]);
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

  for (const c of candidatos) {
    if (resultado.enviados >= tope) break;
    resultado.revisadas++;
    const contacto = (c.crm_contacto_id && porId.get(c.crm_contacto_id)) || (c.telefono && porTelefono.get(claveTelefono(c.telefono))) || null;
    const etapa = contacto?.etapa ?? "Nuevo";
    const paso = c.paso_seguimiento + 1;
    const regla = elegirRegla(reglas, { etapa, paso, proyecto: c.proyecto, conversacion: c.chatwoot_id });
    if (!regla || !pasaronLosDias(c, regla, ahora)) continue;

    const cuando = ahora.toISOString();
    if (!(await almacen.reclamarSeguimiento({ conversacion: c.chatwoot_id, pasoAnterior: c.paso_seguimiento, regla: regla.id, ahora: cuando }))) continue;
    const proyecto = proyectos.find((p) => p.id === (c.proyecto ?? regla.proyecto)) ?? (proyectos.length === 1 ? proyectos[0] : null);
    const texto = textoSeguimiento(regla.mensaje, { nombre: nombreDePila(contacto?.nombre || c.nombre), proyecto: proyecto?.nombre ?? "" });
    try {
      const mensajeId = await chatwoot.enviar(c.chatwoot_id, texto);
      await almacen.anotarSeguimiento({ conversacion: c.chatwoot_id, regla: regla.id, etapa, paso, version: regla.version, texto, mensaje_id: mensajeId, enviado: cuando });
      await almacen.registrar({ tipo: "seguimiento", conversacion: c.chatwoot_id, detalle: texto.slice(0, 500), datos: { regla: regla.id, etapa, paso, version: regla.version } });
      if (crm && contacto) {
        await crm.anotarActividad({ contacto, detalle: `Seguimiento automático (${paso}.º): ${texto}`, ahora: cuando }).catch(() => {});
      }
      resultado.enviados++;
    } catch (e) {
      // Ya quedó contado: no se reintenta en la próxima corrida (mejor uno menos que uno repetido).
      resultado.errores++;
      await almacen.registrar({ tipo: "error", conversacion: c.chatwoot_id, detalle: `Seguimiento: ${detalle(e)}`, datos: { regla: regla.id, paso } }).catch(() => {});
    }
  }
  return resultado;
}
