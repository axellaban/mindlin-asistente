import type { MensajeHistorial } from "../chatwoot/evento";
import type { ReglasEtapa } from "../etapas/reglas";
import type { HorarioEquipo } from "../agente/horario";
import type { Linea } from "../lineas";
import type { FlujoActivo, Paso } from "../flujos/modelo";
import type { Corrida, EstadoCorrida, ResultadoCorrida } from "../flujos/motor";

/** La ficha de un desarrollo: lo único que el agente puede decir sobre él. */
export interface Proyecto {
  id: string;
  nombre: string;
  palabras_clave: string[];
  /** Cómo presentarlo la primera vez (lo que antes mandaba el bot de Kommo). */
  presentacion: string;
  descripcion: string;
  ubicacion: string;
  etapa_obra: string;
  entrega: string;
  tipologias: string;
  precios: string;
  financiacion: string;
  disponibilidad: string;
  amenities: string;
  preguntas_frecuentes: string;
  links: string;
}

export interface Tono {
  instrucciones: string;
  criterios_comerciales: string;
  cuando_pasar_a_persona: string;
  /** Quiénes son, trayectoria y preguntas frecuentes: vale para todos los proyectos. */
  sobre_la_empresa?: string;
  /** Cómo responder objeciones, cómo hablarle a cada perfil, señales y qué no decir. */
  objeciones?: string;
  /**
   * Modo «presenta y pasa». Desde el 15/11 es de cada línea (Linea.pasar_al_responder): este queda
   * solo para un asistente sin líneas (las pruebas viejas).
   */
  pasar_al_responder?: boolean;
  /** Cuándo trabaja el equipo comercial. Sin él, el de fábrica (de lunes a viernes de 9 a 20). */
  horario_equipo?: HorarioEquipo;
}

export interface Ejemplo {
  titulo: string;
  conversacion: string;
}

/** Lo que el asistente ya anotó de la persona (lo mismo que manda al CRM). Lo que no sabe, no está. */
export interface Anotado {
  nombre?: string;
  para?: string;
  ambientes?: string;
  presupuesto_usd?: string;
  forma_de_pago?: string;
  plazo?: string;
  /** De dónde es o en qué zona vive. */
  zona?: string;
  /** Hace cuánto está buscando. */
  busca_desde?: string;
  /** El último resumen que escribió para el equipo. */
  resumen?: string;
}

/** Lo que el asistente recuerda de cada conversación de Chatwoot. */
export interface Conversacion {
  chatwoot_id: number;
  proyecto: string | null;
  crm_contacto_id: string | null;
  telefono: string | null;
  nombre: string | null;
  interesado?: Anotado;
  /** Cuándo salió el último seguimiento automático (solo se lee: lo anota la corrida de seguimientos). */
  ultimo_seguimiento?: string | null;
  /** De qué línea es (lib/lineas.ts). */
  linea?: string | null;
  /** La bandeja de Chatwoot por la que entró. */
  bandeja?: number | null;
}

/** «Si queda en tal etapa y pasan tantos días sin respuesta, mandar este mensaje», con versiones. */
export interface ReglaSeguimiento {
  id: number;
  etapa: string;
  paso: number;
  dias_sin_respuesta: number;
  version: number;
  estado: "activa" | "a_prueba" | "archivada";
  /** Null: vale para todos los proyectos. */
  proyecto: string | null;
  mensaje: string;
  /** Null: vale para todas las líneas. */
  linea?: string | null;
}

/** Una conversación que el bot atiende, quedó sin respuesta del interesado y puede llevar seguimiento. */
export interface CandidatoSeguimiento {
  chatwoot_id: number;
  nombre: string | null;
  /** El nombre que le dijo al asistente (puede ser distinto del de WhatsApp). */
  nombre_anotado?: string | null;
  telefono: string | null;
  proyecto: string | null;
  crm_contacto_id: string | null;
  /** Cuántos seguimientos ya se mandaron desde la última vez que escribió. */
  paso_seguimiento: number;
  /** El último mensaje que le mandamos (del bot, del equipo o un seguimiento). */
  ultima_salida: string;
  /** De qué línea es la conversación. */
  linea?: string | null;
}

export interface SeguimientoEnviado {
  conversacion: number;
  regla: number;
  etapa: string;
  paso: number;
  version: number;
  texto: string;
  mensaje_id: number | null;
  enviado: string;
}

export type TipoRegistro = "respuesta" | "paso_a_persona" | "la_tomo_una_persona" | "volvio_al_bot" | "seguimiento" | "crm" | "etapa" | "pausa" | "flujo" | "error";

/** Lo que pasa entre el asistente y el equipo: quién tiene la conversación (Almacen.laDevolvioElEquipo). */
export const TIPOS_DEL_EQUIPO: TipoRegistro[] = ["paso_a_persona", "la_tomo_una_persona", "volvio_al_bot"];

/** Un archivo que mandan los flujos (foto, audio, PDF), guardado en la base. */
export interface Archivo {
  id: number;
  nombre: string;
  tipo: string;
  datos: Uint8Array;
}

/** Para arrancar un flujo con una persona. */
export interface CorridaNueva {
  conversacion: number;
  linea: string;
  flujo: number;
  nombre: string;
  pasos: Paso[];
  ahora: string;
}

/** `respondio`: cuándo respondió la persona por primera vez (se anota una sola vez, para medir). */
export type CambiosCorrida = Partial<Pick<Corrida, "posicion" | "estado" | "resultado" | "espera_desde" | "vence">> & { respondio?: string };

export type { Corrida, EstadoCorrida, ResultadoCorrida, FlujoActivo, Linea };

/** Dónde guarda y lee el asistente (Postgres en Neon en producción, memoria en las pruebas). */
export interface Almacen {
  guardarMensaje(m: MensajeHistorial): Promise<void>;
  /** Cambia el texto de un mensaje ya guardado (por ejemplo, para sumar la transcripción de un audio). */
  actualizarTextoMensaje(id: number, texto: string): Promise<void>;
  /** Los últimos mensajes de la conversación, del más viejo al más nuevo. */
  historial(conversacion: number, limite: number): Promise<MensajeHistorial[]>;
  /** True la primera vez que se pide para ese mensaje: así no se contesta dos veces si Chatwoot reintenta. */
  reclamarMensaje(mensaje: number, conversacion: number): Promise<boolean>;
  conversacion(id: number): Promise<Conversacion | null>;
  guardarConversacion(c: Partial<Conversacion> & { chatwoot_id: number }): Promise<void>;
  proyectosActivos(): Promise<Proyecto[]>;
  tono(): Promise<Tono>;
  ejemplos(): Promise<Ejemplo[]>;
  registrar(r: { tipo: TipoRegistro; conversacion: number | null; detalle: string; datos?: unknown }): Promise<void>;
  /** La conversación ya no lleva seguimientos automáticos (la tomó una persona). */
  sinSeguimientos(conversacion: number): Promise<void>;
  /**
   * El equipo le devolvió la conversación al bot (la volvió a poner pendiente): vuelve a llevar
   * seguimientos. True si estaba en manos del equipo.
   */
  volvioAlBot(conversacion: number): Promise<boolean>;
  /**
   * ¿Lo último que pasó entre el asistente y el equipo en esta conversación fue que el equipo se la
   * devolvió? (en el registro: «volvio_al_bot» después del último paso al equipo). Queda así hasta
   * que vuelva a pasar al equipo: el aviso del cambio de estado suele llegar antes que el mensaje.
   */
  laDevolvioElEquipo(conversacion: number): Promise<boolean>;
  /** Si alguien pausó el asistente entero desde el panel. */
  pausado(): Promise<boolean>;
  /** Conversaciones del bot donde lo último lo dijimos nosotros hace más de un día. */
  candidatosSeguimiento(ahora: string): Promise<CandidatoSeguimiento[]>;
  /** A qué etapa del CRM mueve cada evento (lib/etapas/reglas.ts). Lo que no está o es null, no mueve. */
  reglasEtapa(): Promise<ReglasEtapa>;
  /** Las reglas activas y a prueba (no las archivadas). */
  reglasVigentes(): Promise<ReglaSeguimiento[]>;
  /**
   * Anota que sale el seguimiento: suma un paso si nadie lo hizo antes (dos corridas a la vez
   * mandan uno solo). True si lo reclamó esta corrida.
   */
  reclamarSeguimiento(r: { conversacion: number; pasoAnterior: number; regla: number; ahora: string }): Promise<boolean>;
  anotarSeguimiento(s: SeguimientoEnviado): Promise<void>;

  // Líneas y flujos (docs/lineas.md, docs/flujos.md).
  lineas(): Promise<Linea[]>;
  /** Los flujos activos de una línea (uno general y uno por proyecto, como mucho). */
  flujosActivos(linea: string): Promise<FlujoActivo[]>;
  archivo(id: number): Promise<Archivo | null>;
  /** La corrida que está en marcha o esperando en esta conversación (hay una sola a la vez). */
  corridaViva(conversacion: number): Promise<Corrida | null>;
  /** La última corrida de la conversación, en cualquier estado. */
  ultimaCorrida(conversacion: number): Promise<Corrida | null>;
  /** Arranca una corrida. Null si ya había una viva (otro aviso la arrancó recién). */
  iniciarCorrida(c: CorridaNueva): Promise<Corrida | null>;
  /**
   * La toma para correrla: solo si sigue como se la vio (esperando en esa posición, o en curso pero
   * abandonada). Dos avisos a la vez, o el cron y un aviso, no la corren los dos.
   */
  reclamarCorrida(id: number, como: { estado: EstadoCorrida; posicion: string }, ahora: string): Promise<boolean>;
  guardarCorrida(id: number, cambios: CambiosCorrida, ahora: string): Promise<void>;
  /** Termina las corridas vivas de la conversación (la tomó el equipo, se pausó…). */
  cancelarCorridas(conversacion: number, resultado?: ResultadoCorrida): Promise<void>;
  /**
   * Las corridas para el cron: las que esperan y ya vencieron (con el margen de media corrida) y las
   * que quedaron en curso abandonadas. No trae las de líneas pausadas.
   */
  corridasParaRetomar(ahora: string): Promise<Corrida[]>;
}
