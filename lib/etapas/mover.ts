/**
 * Mueve al lead de etapa en el CRM según lo que acaba de pasar (lib/etapas/reglas.ts) y lo deja
 * en el registro del asistente. Si el CRM falla, no rompe nada: la respuesta al interesado ya
 * salió (o sale igual) y el error queda anotado.
 */

import type { ContactoCRM, CRM } from "../crm/planilla";
import type { Almacen } from "../datos/tipos";
import { MOTIVO_DE_DESCARTE, puedeMover, resolverEtapa, tituloEvento, type Evento, type ReglasEtapa } from "./reglas";

export async function moverEtapa({
  crm,
  almacen,
  conversacion,
  contacto,
  eventos,
  reglas,
  ahora,
}: {
  crm: CRM | null;
  almacen: Almacen;
  conversacion: number | null;
  contacto: ContactoCRM | null | undefined;
  eventos: Evento[];
  reglas: ReglasEtapa;
  ahora: string;
}): Promise<ContactoCRM | null> {
  if (!crm || !contacto || !eventos.length) return null;
  // Con lo que ya se sabe del contacto: si no hay nada que mover, no se le pide nada a Google.
  const previsto = resolverEtapa(contacto.etapa, eventos, reglas);
  if (!previsto) return null;
  try {
    let por = previsto.evento;
    const movido = await crm.cambiarEtapa({
      id: contacto.id,
      // La etapa pudo cambiarla alguien del equipo recién: se decide con la que tiene la fila ahora.
      permitido: (actual) => {
        const r = resolverEtapa(actual, eventos, reglas);
        if (r) por = r.evento;
        return r?.etapa ?? null;
      },
      por: tituloEvento(por).toLowerCase(),
      motivoDeDescarte: MOTIVO_DE_DESCARTE[por],
      ahora,
    });
    if (!movido) return null;
    await almacen.registrar({ tipo: "etapa", conversacion, detalle: `${contacto.etapa} → ${movido.etapa}: ${tituloEvento(por).toLowerCase()}.`, datos: { contacto: contacto.id, evento: por, etapa: movido.etapa } });
    return movido;
  } catch (e) {
    await almacen.registrar({ tipo: "error", conversacion, detalle: `CRM (mover de etapa): ${e instanceof Error ? e.message : String(e)}` }).catch(() => {});
    return null;
  }
}

/**
 * Mueve al lead a una etapa puntual, porque lo dice un paso de un flujo («Mover de etapa»). Con los
 * mismos cuidados que las etapas automáticas (puedeMover): no toca Reserva ni Vendido y no
 * retrocede. Si el CRM falla, queda anotado y el flujo sigue.
 */
export async function moverAEtapa({
  crm,
  almacen,
  conversacion,
  contacto,
  etapa,
  por,
  ahora,
}: {
  crm: CRM | null;
  almacen: Almacen;
  conversacion: number | null;
  contacto: ContactoCRM | null | undefined;
  etapa: string;
  /** Por qué, para la actividad del CRM («flujo «Lerma 439»»). */
  por: string;
  ahora: string;
}): Promise<ContactoCRM | null> {
  if (!crm || !contacto) return null;
  if (!puedeMover(contacto.etapa, etapa)) return null;
  try {
    const movido = await crm.cambiarEtapa({
      id: contacto.id,
      permitido: (actual) => puedeMover(actual, etapa),
      por,
      motivoDeDescarte: etapa === "Descartado" ? "Otro" : undefined,
      ahora,
    });
    if (!movido) return null;
    await almacen.registrar({ tipo: "etapa", conversacion, detalle: `${contacto.etapa} → ${movido.etapa}: ${por}.`, datos: { contacto: contacto.id, etapa: movido.etapa, por } });
    return movido;
  } catch (e) {
    await almacen.registrar({ tipo: "error", conversacion, detalle: `CRM (mover de etapa): ${e instanceof Error ? e.message : String(e)}` }).catch(() => {});
    return null;
  }
}
