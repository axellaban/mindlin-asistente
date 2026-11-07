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

export type TipoRegistro = "respuesta" | "paso_a_persona" | "la_tomo_una_persona" | "seguimiento" | "crm" | "error";

/** Dónde guarda y lee el asistente (Supabase en producción, memoria en las pruebas). */
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
  registrar(r: { tipo: TipoRegistro; conversacion: number | null; detalle: string; datos?: unknown }): Promise<void>;
}
