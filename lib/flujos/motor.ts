/**
 * El motor de los flujos: recorre los pasos de una corrida desde donde quedó hasta la próxima espera
 * o hasta que termina. No sabe de Chatwoot, de la IA ni de la base: recibe lo que tiene que hacer
 * (`Acciones`). Así lo usan igual una conversación real (lib/flujos/servicio.ts), el cron de las
 * esperas vencidas y «Probar» (que muestra lo que haría, sin mandar nada).
 *
 * Cómo avanza:
 * - Antes de hacer un paso, anota que pasó al siguiente. Si la función se corta a la mitad, la
 *   corrida sigue en el paso de después: mejor un mensaje menos que uno repetido.
 * - «Esperar respuesta»: si la persona ya escribió mientras corría este tramo, sigue directo por
 *   «Si responde». Si no, queda esperando hasta `vence` (el cron la retoma por «Si no responde»;
 *   el webhook, por «Si responde», apenas escriba).
 * - «Terminar» (o el final de un camino): si la persona escribió y nadie le contestó (respondió al
 *   flujo y el camino no le manda nada, o escribió mientras corría), pasa al equipo. Nadie queda
 *   sin respuesta.
 */

import { pasoEn, rama, siguiente, ubicar, type Paso, type Posicion } from "./modelo";

export type EstadoCorrida = "en_curso" | "esperando" | "terminado";
export type ResultadoCorrida = "equipo" | "ia" | "fin" | "cancelado" | "error";

export interface Corrida {
  id: number;
  conversacion: number;
  linea: string | null;
  flujo: number | null;
  nombre: string;
  pasos: Paso[];
  posicion: Posicion;
  estado: EstadoCorrida;
  resultado: ResultadoCorrida | null;
  espera_desde: string | null;
  vence: string | null;
  inicio: string;
}

/**
 * Qué la puso en marcha: arrancó con una persona nueva, la persona respondió a una espera, venció
 * el plazo de una espera, o se retoma una que se había cortado a la mitad.
 */
export type Disparo = "inicio" | "respuesta" | "vencio" | "reanudar";

export interface PedidoDeEquipo {
  motivo: string;
  resumen: string;
}

export interface Acciones {
  /** Manda un mensaje fijo (las variables las completa quien lo manda). */
  enviar(texto: string, archivo: number | null): Promise<void>;
  /**
   * La IA escribe y manda un mensaje. Con consigna, sigue esa consigna; sin consigna, contesta lo
   * que escribió la persona. Devuelve si la IA pidió pasar la conversación al equipo.
   */
  ia(consigna: string | null): Promise<{ pasar: PedidoDeEquipo | null }>;
  etapa(etapa: string): Promise<void>;
  /** Nota interna y la conversación pasa a una persona. */
  equipo(p: PedidoDeEquipo): Promise<void>;
  dormir(ms: number): Promise<void>;
  /** Anota cómo va la corrida (y, mientras corre, que sigue ocupada). */
  guardar(cambios: Partial<Pick<Corrida, "posicion" | "estado" | "resultado" | "espera_desde" | "vence">>): Promise<void>;
  /**
   * ¿La persona escribió algo nuevo desde que arrancó este tramo (o desde la última vez que se
   * preguntó)? Lo que contesta queda «visto»: la próxima pregunta mira solo lo que llegue después.
   */
  escribioDeNuevo(): Promise<boolean>;
  ahora(): Date;
}

export interface Salida {
  estado: EstadoCorrida;
  resultado: ResultadoCorrida | null;
  posicion: Posicion;
  vence: string | null;
  /** Mensajes que mandó en este tramo (fijos o de la IA). */
  enviados: number;
}

/** Hasta cuántos pasos recorre en un tramo (los flujos tienen como mucho 60: es solo un seguro). */
const MAX_PASOS_POR_TRAMO = 100;

export async function avanzar(c: Pick<Corrida, "nombre" | "pasos" | "posicion">, disparo: Disparo, a: Acciones): Promise<Salida> {
  let pos = c.posicion;
  let enviados = 0;
  // Hay algo de la persona sin contestar: su primer mensaje o su respuesta a una espera.
  let sinContestar = disparo === "inicio" || disparo === "respuesta";

  if (disparo === "respuesta" || disparo === "vencio") {
    const espera = pasoEn(c.pasos, pos);
    if (espera?.tipo !== "esperar") throw new Error(`La corrida no está en una espera (posición ${pos}).`);
    pos = rama(pos, disparo === "respuesta" ? "si" : "no");
  }

  const terminar = async (resultado: ResultadoCorrida): Promise<Salida> => {
    await a.guardar({ estado: "terminado", resultado, posicion: pos, vence: null });
    return { estado: "terminado", resultado, posicion: pos, vence: null, enviados };
  };
  const alEquipo = async (p: PedidoDeEquipo) => {
    await a.equipo(p);
    return terminar("equipo");
  };

  for (let vueltas = 0; vueltas < MAX_PASOS_POR_TRAMO; vueltas++) {
    if (!ubicar(c.pasos, pos)) throw new Error(`La posición ${pos} no existe en el flujo «${c.nombre}».`);
    const paso = pasoEn(c.pasos, pos);

    if (!paso || paso.tipo === "fin") {
      // Escribió y nadie le contestó: que lo vea el equipo.
      const escribio = await a.escribioDeNuevo();
      if (escribio || (sinContestar && enviados === 0)) {
        return alEquipo({ motivo: `La persona escribió y el flujo «${c.nombre}» terminó sin contestarle.`, resumen: "" });
      }
      return terminar("fin");
    }

    if (paso.tipo === "esperar") {
      if (await a.escribioDeNuevo()) {
        // Escribió mientras salía este tramo: ya respondió.
        pos = rama(pos, "si");
        sinContestar = true;
        enviados = 0;
        await a.guardar({ posicion: pos });
        continue;
      }
      const ahora = a.ahora();
      const vence = new Date(ahora.getTime() + paso.horas * 3_600_000).toISOString();
      await a.guardar({ estado: "esperando", posicion: pos, espera_desde: ahora.toISOString(), vence });
      return { estado: "esperando", resultado: null, posicion: pos, vence, enviados };
    }

    if (paso.tipo === "equipo") {
      return alEquipo({ motivo: `El flujo «${c.nombre}» pasó la conversación al equipo.`, resumen: paso.nota });
    }

    if (paso.tipo === "seguir_ia") {
      // Si hay algo sin contestar, la IA lo contesta ahora; si no, contesta cuando escriba.
      if ((await a.escribioDeNuevo()) || sinContestar) {
        const r = await a.ia(null);
        enviados++;
        if (r.pasar) return alEquipo(r.pasar);
      }
      return terminar("ia");
    }

    // Un paso que no cierra: primero se anota que se pasó al siguiente.
    const despues = siguiente(pos);
    await a.guardar({ posicion: despues });
    switch (paso.tipo) {
      case "mensaje":
        await a.enviar(paso.texto, paso.archivo);
        enviados++;
        break;
      case "pausa":
        await a.dormir(paso.segundos * 1000);
        break;
      case "ia": {
        const r = await a.ia(paso.consigna);
        enviados++;
        sinContestar = false;
        if (r.pasar) {
          pos = despues;
          return alEquipo(r.pasar);
        }
        break;
      }
      case "etapa":
        await a.etapa(paso.etapa);
        break;
    }
    pos = despues;
  }
  throw new Error(`El flujo «${c.nombre}» recorrió demasiados pasos de una vez.`);
}
