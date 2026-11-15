/** Lo de «Probar el asistente» que usa también el navegador (sin nada del servidor). */

import type { Anotado } from "../datos/tipos";
import type { Paso } from "../flujos/modelo";

export interface MensajePrueba {
  rol: "interesado" | "bot";
  texto: string;
}

/** Un flujo en la prueba: la copia de sus pasos y por dónde va (como una corrida de verdad). */
export interface FlujoPrueba {
  id: number;
  nombre: string;
  pasos: Paso[];
  posicion: string;
  estado: "esperando" | "terminado";
  resultado: "equipo" | "ia" | "fin" | "error" | null;
  /** Cuánto espera la respuesta (para mostrarlo). */
  horas: number | null;
}

export interface EstadoPrueba {
  mensajes: MensajePrueba[];
  proyecto: string | null;
  anotado: Anotado;
  /** Ya la pasó al equipo: en una conversación real, el asistente dejaría de responder. */
  pasada: boolean;
  /** La línea con la que se prueba (sus proyectos, sus instrucciones y sus flujos). Sin línea, como antes. */
  linea?: string | null;
  /** Si la conversación la está llevando un flujo. */
  flujo?: FlujoPrueba | null;
}

export interface RespuestaPrueba {
  estado: EstadoPrueba;
  /** Lo que haría además de contestar, para mostrarlo debajo de la respuesta. */
  acciones: string[];
  /** Todo lo de este mensaje en orden: los mensajes del asistente y lo que haría (pausas, etapas…). */
  turno?: { tipo: "bot" | "accion"; texto: string }[];
}

/** Cuántos mensajes como mucho en una prueba (como el historial de una conversación real). */
export const MAX_MENSAJES_PRUEBA = 40;
export const MAX_LARGO_PRUEBA = 2000;

export const estadoInicial = (proyecto: string | null = null, linea: string | null = null): EstadoPrueba => ({
  mensajes: [],
  proyecto,
  anotado: {},
  pasada: false,
  ...(linea ? { linea, flujo: null } : {}),
});
