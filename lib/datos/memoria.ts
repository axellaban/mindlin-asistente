import type { MensajeHistorial } from "../chatwoot/evento";
import type { Almacen, Conversacion, Ejemplo, Proyecto, Tono, TipoRegistro } from "./tipos";

/** El almacén en memoria: para las pruebas. */
export function almacenEnMemoria(inicial: { proyectos?: Proyecto[]; tono?: Tono; ejemplos?: Ejemplo[] } = {}) {
  const mensajes = new Map<number, MensajeHistorial>();
  const respondidos = new Set<number>();
  const conversaciones = new Map<number, Conversacion>();
  const registro: { tipo: TipoRegistro; conversacion: number | null; detalle: string; datos?: unknown }[] = [];
  const tono: Tono = inicial.tono ?? { instrucciones: "", criterios_comerciales: "", cuando_pasar_a_persona: "" };
  const almacen: Almacen = {
    async guardarMensaje(m) {
      if (!mensajes.has(m.id)) mensajes.set(m.id, m);
    },
    async actualizarTextoMensaje(id, texto) {
      const m = mensajes.get(id);
      if (m) mensajes.set(id, { ...m, texto });
    },
    async historial(conversacion, limite) {
      return [...mensajes.values()]
        .filter((m) => m.conversacion === conversacion)
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
        .slice(-limite);
    },
    async reclamarMensaje(mensaje) {
      if (respondidos.has(mensaje)) return false;
      respondidos.add(mensaje);
      return true;
    },
    async conversacion(id) {
      return conversaciones.get(id) ?? null;
    },
    async guardarConversacion(c) {
      const antes = conversaciones.get(c.chatwoot_id) ?? { chatwoot_id: c.chatwoot_id, proyecto: null, crm_contacto_id: null, telefono: null, nombre: null };
      conversaciones.set(c.chatwoot_id, { ...antes, ...c });
    },
    async proyectosActivos() {
      return inicial.proyectos ?? [];
    },
    async tono() {
      return tono;
    },
    async ejemplos() {
      return inicial.ejemplos ?? [];
    },
    async registrar(r) {
      registro.push(r);
    },
  };
  return { almacen, mensajes, conversaciones, registro };
}
