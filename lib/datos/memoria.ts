import type { MensajeHistorial } from "../chatwoot/evento";
import type { Almacen, CandidatoSeguimiento, Conversacion, Ejemplo, Proyecto, ReglaSeguimiento, Tono, TipoRegistro } from "./tipos";

/** El almacén en memoria: para las pruebas. */
export function almacenEnMemoria(inicial: { proyectos?: Proyecto[]; tono?: Tono; ejemplos?: Ejemplo[]; reglas?: ReglaSeguimiento[] } = {}) {
  const mensajes = new Map<number, MensajeHistorial>();
  const respondidos = new Set<number>();
  const conversaciones = new Map<number, Conversacion>();
  const seguimientos = new Map<number, { permitido: boolean; paso: number; ultimo: string | null; regla: number | null }>();
  const estadoSeguimiento = (id: number) => seguimientos.get(id) ?? { permitido: true, paso: 0, ultimo: null, regla: null };
  const registro: { tipo: TipoRegistro; conversacion: number | null; detalle: string; datos?: unknown }[] = [];
  const tono: Tono = inicial.tono ?? { instrucciones: "", criterios_comerciales: "", cuando_pasar_a_persona: "" };
  const almacen: Almacen = {
    async guardarMensaje(m) {
      if (!mensajes.has(m.id)) mensajes.set(m.id, m);
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
    async permitirSeguimientos(conversacion, permitido) {
      seguimientos.set(conversacion, { ...estadoSeguimiento(conversacion), permitido });
    },
    async reglasSeguimiento() {
      return (inicial.reglas ?? []).filter((r) => r.estado !== "archivada");
    },
    async candidatosSeguimiento(hasta) {
      const salida: CandidatoSeguimiento[] = [];
      for (const c of conversaciones.values()) {
        const seg = estadoSeguimiento(c.chatwoot_id);
        const ms = [...mensajes.values()].filter((m) => m.conversacion === c.chatwoot_id).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
        const ultimo = ms.at(-1);
        const ultimoInteresado = ms.filter((m) => m.rol === "interesado").at(-1);
        if (!seg.permitido || !ultimo || ultimo.rol !== "bot" || !ultimoInteresado || ms.some((m) => m.rol === "persona")) continue;
        if (Date.parse(ultimo.fecha) > hasta.getTime()) continue;
        const paso = !seg.ultimo || ultimoInteresado.fecha > seg.ultimo ? 0 : seg.paso;
        salida.push({ chatwoot_id: c.chatwoot_id, nombre: c.nombre, telefono: c.telefono, proyecto: c.proyecto, paso, ultimo_mensaje: ultimo.fecha });
      }
      return salida.sort((a, b) => a.ultimo_mensaje.localeCompare(b.ultimo_mensaje));
    },
    async anotarSeguimiento(conversacion, paso, regla, fecha) {
      seguimientos.set(conversacion, { ...estadoSeguimiento(conversacion), paso, regla, ultimo: fecha });
    },
    async registrar(r) {
      registro.push(r);
    },
  };
  return { almacen, mensajes, conversaciones, registro, seguimientos };
}
