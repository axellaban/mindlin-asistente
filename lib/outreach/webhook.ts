/**
 * Los mensajes de la línea de outreach (docs/outreach.md, «Las respuestas»), en el webhook.
 *
 * - **Lo que sale** por la línea (el saludo desde WhatsApp Web, el celular o WAHA) llega a Chatwoot
 *   como un mensaje del equipo. Acá no es «la tomó una persona»: si es el que estaba tomado, se
 *   confirma solo, y la conversación queda como estaba.
 * - **Lo que entra** de alguien de la base: una respuesta automática se anota y nada más; un «no»
 *   o un número equivocado lo cierran; la baja corta todo (en todas las líneas) y se le contesta
 *   una vez; una respuesta de verdad corta la secuencia, entra al CRM y hace lo que diga la línea:
 *   pasa al equipo (con la nota y el aviso en el hub) o la atiende la IA.
 * - Alguien que **no está en la base** escribe a la línea 1: pasa al equipo, como antes.
 */

import type { Accion, MensajeHistorial } from "../chatwoot/evento";
import type { Chatwoot } from "../chatwoot/api";
import type { CRM } from "../crm/planilla";
import type { Almacen } from "../datos/tipos";
import type { AvisarAlEquipo } from "../hub/aviso";
import type { Linea } from "../lineas";
import { NOTA_BAJA } from "../baja";
import type { DatosOutreach } from "./datos";
import { clasificarRespuesta, RESPUESTA_BAJA } from "./respuestas";

export interface ServiciosOutreach {
  outreach: DatosOutreach;
  almacen: Almacen;
  chatwoot: Chatwoot | null;
  crm: CRM | null;
  avisarAlEquipo?: AvisarAlEquipo | null;
  ahora?: () => Date;
}

/** Lo que el webhook tiene que hacer después: nada más, o seguir como una línea de leads (la IA). */
export type Decision = { fin: true; json: Record<string, unknown>; tarea?: () => Promise<unknown> } | { fin: false; linea: Linea };

/** La etiqueta del CRM para los que vienen de una base de outreach. */
export const etiquetaOutreach = (lote: string) => `Outreach: ${lote}`.slice(0, 40);

export async function mensajeDeOutreach(
  s: ServiciosOutreach,
  linea: Linea,
  mensaje: MensajeHistorial,
  contacto: { nombre: string; telefono: string },
  accion: Accion,
): Promise<Decision> {
  const ahora = s.ahora ?? (() => new Date());

  if (mensaje.rol === "bot") return { fin: true, json: { accion: "ignorar", motivo: "lo mandó el bot" } };

  if (mensaje.rol === "persona") {
    const confirmado = contacto.telefono ? await s.outreach.confirmarPorChat(linea.id, contacto.telefono, mensaje.texto, ahora()).catch(() => false) : false;
    return { fin: true, json: { accion: "ignorar", motivo: confirmado ? "salió el mensaje del outreach: quedó confirmado" : "mensaje saliente de la línea de outreach" } };
  }

  // Escribió alguien.
  const c = contacto.telefono ? await s.outreach.contactoPorTelefono(linea.id, contacto.telefono) : null;
  if (!c) return { fin: false, linea: { ...linea, tipo: "outreach_frio" } };

  const clasificacion = clasificarRespuesta(mensaje.texto);
  const conversacion = mensaje.conversacion;
  await s.almacen.guardarConversacion({ chatwoot_id: conversacion, telefono: c.telefono, nombre: contacto.nombre || c.nombre || null, linea: linea.id, ...(c.crm_contacto_id ? { crm_contacto_id: c.crm_contacto_id } : {}) });

  if (clasificacion === "baja") {
    await s.outreach.baja(c.telefono!, { linea: linea.id, origen: "pidió en la línea de outreach" });
    const primera = await s.almacen.pidioBaja(conversacion, ahora().toISOString());
    await s.almacen.registrar({ tipo: "pidio_baja", conversacion, detalle: `Pidió que no le escriban más (outreach, base «${c.lote_nombre}»).` });
    return {
      fin: true,
      json: { accion: "baja", contacto: c.id },
      tarea: async () => {
        if (primera && s.chatwoot) {
          await s.chatwoot.enviar(conversacion, RESPUESTA_BAJA);
          await s.chatwoot.notaInterna(conversacion, `🚫 Pidió que no le escriban más: el outreach no le manda nada más, en ninguna línea.`).catch(() => {});
        }
        if (s.crm && c.crm_contacto_id) {
          const enCRM = await s.crm.buscar({ id: c.crm_contacto_id }).catch(() => null);
          if (enCRM) await s.crm.anotarActividad({ contacto: enCRM, detalle: NOTA_BAJA, ahora: ahora().toISOString() }).catch(() => {});
        }
      },
    };
  }

  const { primera } = await s.outreach.anotarRespuesta(c.id, { clasificacion, conversacion, mensaje: mensaje.id }, ahora());

  if (clasificacion === "automatica") return { fin: true, json: { accion: "ignorar", motivo: "respuesta automática", contacto: c.id } };
  if (clasificacion === "no" || clasificacion === "equivocado") {
    return {
      fin: true,
      json: { accion: "cerrado", motivo: clasificacion === "no" ? "dijo que no" : "número equivocado", contacto: c.id },
      tarea: async () => {
        await s.chatwoot?.notaInterna(conversacion, clasificacion === "no" ? "🙅 Dijo que no: el outreach no le escribe más." : "❓ Dice que es un número equivocado: quedó como inválido.").catch(() => {});
      },
    };
  }

  // Una respuesta de verdad.
  const cfg = await s.outreach.config(linea.id);
  const alCRM = async () => {
    if (!s.crm || !primera) return null;
    const cuando = ahora().toISOString();
    let enCRM = await s.crm.buscar({ id: c.crm_contacto_id, telefono: c.telefono }).catch(() => null);
    const detalle = `Respondió al outreach por WhatsApp (base «${c.lote_nombre}»).`;
    if (enCRM) {
      await s.crm.anotarActividad({ contacto: enCRM, detalle, ahora: cuando });
    } else {
      enCRM = await s.crm.crearContacto(
        {
          nombre: c.nombre || contacto.nombre,
          telefono: c.telefono!,
          proyecto: c.proyecto,
          para: "",
          ambientes: "",
          presupuestoUsd: "",
          formaDePago: "",
          plazo: "",
          notas: [detalle, c.proyecto_texto && `Había consultado por: ${c.proyecto_texto}.`, c.notas].filter(Boolean).join(" "),
          tags: [etiquetaOutreach(c.lote_nombre)],
        },
        cuando,
        "Contacto inicial",
      );
      await s.crm.anotarActividad({ contacto: enCRM, detalle, ahora: cuando });
    }
    await s.outreach.anotarCRM(c.id, enCRM.id);
    await s.almacen.guardarConversacion({ chatwoot_id: conversacion, crm_contacto_id: enCRM.id });
    return enCRM;
  };

  if (cfg.al_responder === "ia" && accion.tipo === "responder") {
    // La atiende el asistente, como en una línea de leads (con las instrucciones y los proyectos de esta línea).
    if (primera) await alCRM().catch(() => null);
    return { fin: false, linea: { ...linea, tipo: "entrada" } };
  }

  return {
    fin: true,
    json: { accion: "pasar_a_persona", motivo: "respondió al outreach", contacto: c.id },
    tarea: async () => {
      const enCRM = await alCRM().catch(() => null);
      if (!s.chatwoot) return;
      if (primera) {
        await s.chatwoot.notaInterna(conversacion, `🙋 Respondió al outreach (base «${c.lote_nombre}»${c.proyecto_texto ? `, había consultado por ${c.proyecto_texto}` : ""}). Sigue el equipo.`);
        await s.chatwoot.pasarAPersona(conversacion);
        await s.almacen.sinSeguimientos(conversacion);
        await s.almacen.registrar({ tipo: "paso_a_persona", conversacion, detalle: `Respondió al outreach (base «${c.lote_nombre}»).` });
        await s.avisarAlEquipo?.({
          conversacion,
          nombre: c.nombre || contacto.nombre,
          telefono: c.telefono ?? "",
          motivo: "Respondió al outreach",
          resumen: `Base «${c.lote_nombre}». Escribió: «${mensaje.texto.slice(0, 300)}»`,
          responsable: enCRM?.responsable ?? "",
          contacto: enCRM?.id ?? null,
          proyecto: c.proyecto,
          linea: linea.nombre,
        }).catch(() => {});
      }
    },
  };
}
