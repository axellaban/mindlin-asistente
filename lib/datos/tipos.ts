import type { MensajeHistorial } from "../chatwoot/evento";

/** La ficha de un desarrollo: lo único que el agente puede decir sobre él. */
export interface Proyecto {
  id: string;
  nombre: string;
  palabras_clave: string[];
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
}

export interface Ejemplo {
  titulo: string;
  conversacion: string;
}

/** Lo que el asistente recuerda de cada conversación de Chatwoot. */
export interface Conversacion {
  chatwoot_id: number;
  proyecto: string | null;
  crm_contacto_id: string | null;
  telefono: string | null;
  nombre: string | null;
}

/** «Si quedó en tal etapa y pasaron tantos días sin respuesta, mandar este mensaje.» */
export interface ReglaSeguimiento {
  id: number;
  /** Etapa del CRM del hub (Nuevo, Contactado, Interesado, Propuesta enviada). */
  etapa: string;
  paso: number;
  dias_sin_respuesta: number;
  version: number;
  estado: "activa" | "a_prueba" | "archivada";
  /** Null: vale para todos los proyectos. */
  proyecto: string | null;
  /** Variables: {{nombre}} y {{proyecto}}. */
  mensaje: string;
}

/** Una conversación del bot donde la persona no volvió a escribir. */
export interface CandidatoSeguimiento {
  chatwoot_id: number;
  nombre: string | null;
  telefono: string | null;
  proyecto: string | null;
  /** Seguimientos ya mandados desde el último mensaje de la persona. */
  paso: number;
  /** Fecha del último mensaje de la conversación (del bot o de un seguimiento). */
  ultimo_mensaje: string;
}

export type TipoRegistro = "respuesta" | "paso_a_persona" | "la_tomo_una_persona" | "seguimiento" | "crm" | "error";

/** Dónde guarda y lee el asistente (Postgres en Neon en producción, memoria en las pruebas). */
export interface Almacen {
  guardarMensaje(m: MensajeHistorial): Promise<void>;
  /** Los últimos mensajes de la conversación, del más viejo al más nuevo. */
  historial(conversacion: number, limite: number): Promise<MensajeHistorial[]>;
  /** True la primera vez que se pide para ese mensaje: así no se contesta dos veces si Chatwoot reintenta. */
  reclamarMensaje(mensaje: number, conversacion: number): Promise<boolean>;
  conversacion(id: number): Promise<Conversacion | null>;
  guardarConversacion(c: Partial<Conversacion> & { chatwoot_id: number }): Promise<void>;
  proyectosActivos(): Promise<Proyecto[]>;
  tono(): Promise<Tono>;
  ejemplos(): Promise<Ejemplo[]>;
  /** Si el bot puede mandarle seguimientos (no, desde que la atiende una persona). */
  permitirSeguimientos(conversacion: number, permitido: boolean): Promise<void>;
  reglasSeguimiento(): Promise<ReglaSeguimiento[]>;
  /**
   * Conversaciones donde el último mensaje es del bot, antes de `hasta`, sin intervención de una
   * persona del equipo y con seguimientos permitidos.
   */
  candidatosSeguimiento(hasta: Date): Promise<CandidatoSeguimiento[]>;
  anotarSeguimiento(conversacion: number, paso: number, regla: number, fecha: string): Promise<void>;
  registrar(r: { tipo: TipoRegistro; conversacion: number | null; detalle: string; datos?: unknown }): Promise<void>;
}
