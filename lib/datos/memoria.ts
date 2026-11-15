import type { MensajeHistorial } from "../chatwoot/evento";
import type { ReglasEtapa } from "../etapas/reglas";
import { limiteCandidatos, MARGEN_MS, MAX_PASOS } from "../seguimientos/reglas";
import { LINEAS_DE_FABRICA, type Linea } from "../lineas";
import type { Almacen, Archivo, Conversacion, Corrida, Ejemplo, FlujoActivo, Proyecto, ReglaSeguimiento, SeguimientoEnviado, Tono, TipoRegistro } from "./tipos";

/** Lo que el almacén en memoria sabe de cada conversación para los seguimientos (como las columnas de Postgres). */
interface Seguimiento {
  ultimo_mensaje_interesado: string | null;
  ultimo_mensaje_bot: string | null;
  ultimo_seguimiento: string | null;
  paso_seguimiento: number;
  sin_seguimientos: boolean;
}

/** El almacén en memoria: para las pruebas. Se comporta como el de Postgres. */
export function almacenEnMemoria(
  inicial: {
    proyectos?: Proyecto[];
    tono?: Tono;
    ejemplos?: Ejemplo[];
    reglas?: ReglaSeguimiento[];
    pausado?: boolean;
    etapas?: ReglasEtapa;
    /** Sin ellas, las cuatro de fábrica (la 3, con la bandeja 1). */
    lineas?: Linea[];
    flujos?: (FlujoActivo & { linea: string })[];
    archivos?: Archivo[];
  } = {},
) {
  const estado = { pausado: inicial.pausado ?? false };
  const mensajes = new Map<number, MensajeHistorial>();
  const respondidos = new Set<number>();
  const conversaciones = new Map<number, Conversacion>();
  const seguimiento = new Map<number, Seguimiento>();
  const enviados: (SeguimientoEnviado & { respondio: string | null })[] = [];
  const registro: { tipo: TipoRegistro; conversacion: number | null; detalle: string; datos?: unknown }[] = [];
  const lineas = (inicial.lineas ?? LINEAS_DE_FABRICA).map((l) => ({ ...l }));
  const flujos = inicial.flujos ?? [];
  const corridas: (Corrida & { ocupado_hasta: string | null; respondio?: string })[] = [];
  const copia = (c: Corrida & { ocupado_hasta?: string | null }): Corrida => {
    const { ocupado_hasta: _o, respondio: _r, ...resto } = c as Corrida & { ocupado_hasta?: string | null; respondio?: string };
    return structuredClone(resto);
  };
  const reglas = inicial.reglas ?? [];
  const tono: Tono = inicial.tono ?? { instrucciones: "", criterios_comerciales: "", cuando_pasar_a_persona: "" };
  const conv = (id: number): Conversacion => conversaciones.get(id) ?? { chatwoot_id: id, proyecto: null, crm_contacto_id: null, telefono: null, nombre: null, interesado: {} };
  const seg = (id: number): Seguimiento => {
    let s = seguimiento.get(id);
    if (!s) {
      s = { ultimo_mensaje_interesado: null, ultimo_mensaje_bot: null, ultimo_seguimiento: null, paso_seguimiento: 0, sin_seguimientos: false };
      seguimiento.set(id, s);
      conversaciones.set(id, conv(id));
    }
    return s;
  };
  const mayor = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

  const almacen: Almacen = {
    async guardarMensaje(m) {
      if (mensajes.has(m.id)) return;
      mensajes.set(m.id, m);
      const s = seg(m.conversacion);
      if (m.rol === "interesado") {
        s.ultimo_mensaje_interesado = mayor(s.ultimo_mensaje_interesado, m.fecha);
        s.paso_seguimiento = 0;
        for (const e of enviados) if (e.conversacion === m.conversacion && !e.respondio && e.enviado <= m.fecha) e.respondio = m.fecha;
      } else {
        s.ultimo_mensaje_bot = mayor(s.ultimo_mensaje_bot, m.fecha);
        if (m.rol === "persona") s.sin_seguimientos = true;
      }
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
      const c = conversaciones.get(id);
      return c ? { ...c, ultimo_seguimiento: seguimiento.get(id)?.ultimo_seguimiento ?? null } : null;
    },
    async guardarConversacion(c) {
      conversaciones.set(c.chatwoot_id, { ...conv(c.chatwoot_id), ...c });
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
    async sinSeguimientos(conversacion) {
      seg(conversacion).sin_seguimientos = true;
    },
    async volvioAlBot(conversacion) {
      const s = seguimiento.get(conversacion);
      if (!s?.sin_seguimientos) return false;
      s.sin_seguimientos = false;
      s.paso_seguimiento = 0;
      return true;
    },
    async pausado() {
      return estado.pausado;
    },
    async candidatosSeguimiento(cuando) {
      const ms = Date.parse(cuando);
      return [...seguimiento.entries()]
        .map(([id, s]) => ({ id, s, salida: mayor(s.ultimo_mensaje_bot, s.ultimo_seguimiento) }))
        .filter(({ s, salida }) => !s.sin_seguimientos && s.ultimo_mensaje_interesado && s.paso_seguimiento <= MAX_PASOS && salida && salida > s.ultimo_mensaje_interesado)
        .filter(({ salida }) => Date.parse(salida!) < Date.parse(limiteCandidatos(new Date(ms))) && ms - Date.parse(salida!) < 120 * 86_400_000)
        .filter(({ id }) => {
          const l = lineas.find((x) => x.id === conv(id).linea);
          return !l || (!l.pausada && l.tipo === "entrada");
        })
        .filter(({ id }) => !corridas.some((c) => c.conversacion === id && (c.estado !== "terminado" || c.resultado === "fin")))
        .sort((a, b) => a.salida!.localeCompare(b.salida!))
        .map(({ id, s, salida }) => {
          const c = conv(id);
          return {
            chatwoot_id: id,
            nombre: c.nombre,
            nombre_anotado: c.interesado?.nombre ?? null,
            telefono: c.telefono,
            proyecto: c.proyecto,
            crm_contacto_id: c.crm_contacto_id,
            paso_seguimiento: s.paso_seguimiento,
            ultima_salida: salida!,
            linea: c.linea ?? null,
          };
        });
    },
    async reglasEtapa() {
      return inicial.etapas ?? {};
    },
    async reglasVigentes() {
      return reglas.filter((r) => r.estado !== "archivada");
    },
    async reclamarSeguimiento({ conversacion, pasoAnterior, ahora: cuando }) {
      const s = seguimiento.get(conversacion);
      if (!s || s.sin_seguimientos || s.paso_seguimiento !== pasoAnterior) return false;
      s.paso_seguimiento++;
      s.ultimo_seguimiento = cuando;
      return true;
    },
    async anotarSeguimiento(x) {
      enviados.push({ ...x, respondio: null });
    },
    async lineas() {
      return lineas.map((l) => ({ ...l }));
    },
    async flujosActivos(linea) {
      return flujos.filter((f) => f.linea === linea).map(({ linea: _l, ...f }) => structuredClone(f));
    },
    async archivo(id) {
      return inicial.archivos?.find((a) => a.id === id) ?? null;
    },
    async corridaViva(conversacion) {
      const c = corridas.find((x) => x.conversacion === conversacion && x.estado !== "terminado");
      return c ? copia(c) : null;
    },
    async ultimaCorrida(conversacion) {
      const c = corridas.filter((x) => x.conversacion === conversacion).at(-1);
      return c ? copia(c) : null;
    },
    async iniciarCorrida(c) {
      if (corridas.some((x) => x.conversacion === c.conversacion && x.estado !== "terminado")) return null;
      const nueva = {
        id: corridas.length + 1,
        conversacion: c.conversacion,
        linea: c.linea,
        flujo: c.flujo,
        nombre: c.nombre,
        pasos: structuredClone(c.pasos),
        posicion: "0",
        estado: "en_curso" as const,
        resultado: null,
        espera_desde: null,
        vence: null,
        inicio: c.ahora,
        ocupado_hasta: new Date(Date.parse(c.ahora) + 6 * 60_000).toISOString(),
      };
      corridas.push(nueva);
      return copia(nueva);
    },
    async reclamarCorrida(id, como, cuando) {
      const c = corridas.find((x) => x.id === id);
      if (!c || c.estado !== como.estado || c.posicion !== como.posicion) return false;
      if (c.estado === "en_curso" && c.ocupado_hasta && c.ocupado_hasta >= cuando) return false;
      c.estado = "en_curso";
      c.ocupado_hasta = new Date(Date.parse(cuando) + 6 * 60_000).toISOString();
      return true;
    },
    async guardarCorrida(id, cambios, cuando) {
      const c = corridas.find((x) => x.id === id);
      if (!c) return;
      const { respondio, ...resto } = cambios;
      Object.assign(c, resto);
      if (respondio && !c.respondio) c.respondio = respondio;
      c.ocupado_hasta = c.estado === "en_curso" ? new Date(Date.parse(cuando) + 6 * 60_000).toISOString() : null;
    },
    async cancelarCorridas(conversacion, resultado = "cancelado") {
      for (const c of corridas) if (c.conversacion === conversacion && c.estado !== "terminado") Object.assign(c, { estado: "terminado", resultado, ocupado_hasta: null });
    },
    async corridasParaRetomar(cuando) {
      const limite = new Date(Date.parse(cuando) + MARGEN_MS).toISOString();
      return corridas
        .filter((c) => !lineas.find((l) => l.id === c.linea)?.pausada)
        .filter((c) => (c.estado === "esperando" && c.vence && c.vence <= limite) || (c.estado === "en_curso" && c.ocupado_hasta && c.ocupado_hasta < cuando))
        .map(copia);
    },
  };
  return { almacen, mensajes, conversaciones, seguimiento, enviados, registro, estado, lineas, corridas };
}
