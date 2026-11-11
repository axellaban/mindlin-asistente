import type { MensajeHistorial } from "../chatwoot/evento";
import type { ReglasEtapa } from "../etapas/reglas";

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
  /** Modo «presenta y pasa»: cuando la persona responde después de la presentación, sigue el equipo. */
  pasar_al_responder?: boolean;
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

export type TipoRegistro = "respuesta" | "paso_a_persona" | "la_tomo_una_persona" | "volvio_al_bot" | "seguimiento" | "crm" | "etapa" | "pausa" | "error";

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
}
