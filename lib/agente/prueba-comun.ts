/** Lo de «Probar el asistente» que usa también el navegador (sin nada del servidor). */

import type { Anotado } from "../datos/tipos";

export interface MensajePrueba {
  rol: "interesado" | "bot";
  texto: string;
}

export interface EstadoPrueba {
  mensajes: MensajePrueba[];
  proyecto: string | null;
  anotado: Anotado;
  /** Ya la pasó al equipo: en una conversación real, el asistente dejaría de responder. */
  pasada: boolean;
}

export interface RespuestaPrueba {
  estado: EstadoPrueba;
  /** Lo que haría además de contestar, para mostrarlo debajo de la respuesta. */
  acciones: string[];
}

/** Cuántos mensajes como mucho en una prueba (como el historial de una conversación real). */
export const MAX_MENSAJES_PRUEBA = 40;
export const MAX_LARGO_PRUEBA = 2000;

export const estadoInicial = (proyecto: string | null = null): EstadoPrueba => ({ mensajes: [], proyecto, anotado: {}, pasada: false });
