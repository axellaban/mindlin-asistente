/**
 * Los flujos en una conversación real: cuándo arranca uno, qué pasa cuando la persona responde a
 * una espera y qué hace el cron cuando una espera vence. El recorrido de los pasos está en
 * lib/flujos/motor.ts; acá se conecta con Chatwoot, la IA, el CRM y la base (a través de la Charla).
 *
 * - Arranca solo con una persona nueva (que nunca habló con el asistente ni con el equipo) en una
 *   línea de leads con un flujo activo: el del proyecto que nombró o el general de la línea.
 * - Si la persona responde mientras el flujo espera, sigue por «Si responde».
 * - Si el flujo terminó con «Que siga la IA», contesta la IA (como siempre).
 * - Si terminó con «Terminar» y la persona escribe, pasa al equipo.
 * - Si algo falla, la conversación pasa al equipo con una nota: nadie queda sin respuesta.
 */

import { prepararCharla, LARGO_HISTORIAL, type Charla, type Servicios } from "../agente/charla";
import type { Corrida } from "../datos/tipos";
import type { Linea } from "../lineas";
import { elegirFlujo } from "./modelo";
import { avanzar, type Acciones, type Disparo } from "./motor";
import { escalonar } from "../seguimientos/espaciar";

const detalle = (e: unknown) => (e instanceof Error ? e.message : String(e));
const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** El último mensaje de la persona que ya se vio (los ids de Chatwoot crecen). */
const ultimoDeLaPersona = (h: { id: number; rol: string }[]) => h.reduce((max, m) => (m.rol === "interesado" && m.id > max ? m.id : max), 0);

/** Qué hizo el flujo con este mensaje. `ia`: no hay flujo que lo atienda o ya le pasó la charla a la IA. */
export type DelFlujo = { hecho: string } | { ia: boolean };

/**
 * Antes de que conteste la IA: ¿este mensaje lo atiende un flujo? Devuelve lo que hizo, o que siga
 * la IA (`ia: true` si la conversación ya pasó por un flujo: entonces no vale el modo «presenta y pasa»).
 */
export async function conFlujo(s: Servicios, ch: Charla): Promise<DelFlujo> {
  const { almacen } = s;
  const ahora = s.ahora ?? (() => new Date());
  const viva = await almacen.corridaViva(ch.conv);
  if (viva) {
    if (viva.estado === "esperando") {
      if (!(await almacen.reclamarCorrida(viva.id, { estado: "esperando", posicion: viva.posicion }, ahora().toISOString()))) return { hecho: "el flujo lo tomó otro aviso" };
      return { hecho: await correrTramo(s, ch, viva, "respuesta") };
    }
    // En curso: si la está corriendo otro aviso, este mensaje lo ve al llegar a «Esperar respuesta».
    if (!(await almacen.reclamarCorrida(viva.id, { estado: "en_curso", posicion: viva.posicion }, ahora().toISOString()))) {
      return { hecho: "el flujo está en curso: lo tiene en cuenta al llegar a «Esperar respuesta»" };
    }
    // Se había cortado a la mitad: sigue desde donde quedó, y este mensaje cuenta como respuesta.
    return { hecho: await correrTramo(s, ch, viva, "reanudar", { visto: 0 }) };
  }

  const ultima = await almacen.ultimaCorrida(ch.conv);
  if (ultima) {
    if (ultima.resultado === "fin") {
      await ch.pasarAlEquipo({ motivo: `La persona escribió después de que terminó el flujo «${ultima.nombre}».`, resumen: ch.anotado.resumen ?? "" });
      return { hecho: "pasó al equipo: escribió después de que terminó el flujo" };
    }
    return { ia: true };
  }

  // Solo con una persona nueva: si ya le escribimos (el asistente o el equipo), sigue como venía.
  if (!ch.linea || ch.linea.tipo !== "entrada" || ch.historial.some((m) => m.rol !== "interesado")) return { ia: false };
  const flujos = await almacen.flujosActivos(ch.linea.id);
  if (!flujos.length) return { ia: false };
  const texto = ch.historial.map((m) => m.texto).join(" \n ");
  const elegido = elegirFlujo(flujos, ch.proyectos, texto);
  if (!elegido) return { ia: false };

  const corrida = await almacen.iniciarCorrida({ conversacion: ch.conv, linea: ch.linea.id, flujo: elegido.flujo.id, nombre: elegido.flujo.nombre, pasos: elegido.flujo.pasos, ahora: ahora().toISOString() });
  if (!corrida) return { hecho: "el flujo ya lo arrancó otro aviso" };
  if (elegido.proyecto && elegido.proyecto !== ch.proyectoId) await ch.elegirProyecto(elegido.proyecto);
  await almacen.registrar({ tipo: "flujo", conversacion: ch.conv, detalle: `Arrancó el flujo «${elegido.flujo.nombre}».`, datos: { flujo: elegido.flujo.id, corrida: corrida.id } });
  // Como en Kommo: la persona queda en el CRM desde el primer mensaje.
  await ch.asegurarContacto(`Arrancó el flujo «${elegido.flujo.nombre}».`);
  return { hecho: await correrTramo(s, ch, corrida, "inicio") };
}

/** Corre un tramo del flujo (hasta la próxima espera o hasta que termina) y lo deja anotado. */
export async function correrTramo(s: Servicios, ch: Charla, corrida: Corrida, disparo: Disparo, { visto: vistoAntes }: { visto?: number } = {}): Promise<string> {
  const ahora = s.ahora ?? (() => new Date());
  // En un flujo, las etapas las mueven sus pasos; las señales que marque la IA, sí cuentan.
  ch.eventos.length = 0;
  // Lo de la persona que ya se tuvo en cuenta: lo que llegue después cuenta como respuesta.
  let visto = vistoAntes ?? ultimoDeLaPersona(ch.historial);
  const guardar: Acciones["guardar"] = (cambios) => s.almacen.guardarCorrida(corrida.id, cambios, ahora().toISOString());
  // Para medir cuántos responden a cada flujo.
  const respondio = () => s.almacen.guardarCorrida(corrida.id, { respondio: ahora().toISOString() }, ahora().toISOString());
  if (disparo === "respuesta") await respondio();
  const acciones: Acciones = {
    enviar: (texto, archivo) => ch.enviar(texto, archivo),
    async ia(consigna) {
      const r = await ch.turnoIA({ consigna });
      await ch.mover();
      ch.eventos.length = 0;
      return { pasar: r.pasar };
    },
    etapa: (etapa) => ch.moverA(etapa, `flujo «${corrida.nombre}»`),
    equipo: (p) => ch.pasarAlEquipo(p),
    dormir: s.dormir ?? dormirReal,
    guardar,
    async escribioDeNuevo() {
      const ultimos = await s.almacen.historial(ch.conv, LARGO_HISTORIAL);
      const ultimo = ultimoDeLaPersona(ultimos);
      if (ultimo <= visto) return false;
      visto = ultimo;
      await respondio();
      await ch.refrescarHistorial();
      return true;
    },
    ahora,
  };
  try {
    const r = await avanzar(corrida, disparo, acciones);
    const que =
      r.estado === "esperando"
        ? `espera la respuesta hasta el ${new Date(r.vence!).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`
        : r.resultado === "equipo"
          ? "pasó al equipo"
          : r.resultado === "ia"
            ? "sigue la IA"
            : "terminó";
    const por = disparo === "respuesta" ? "La persona respondió: " : disparo === "vencio" ? "No respondió a tiempo: " : "";
    await s.almacen.registrar({ tipo: "flujo", conversacion: ch.conv, detalle: `Flujo «${corrida.nombre}»: ${por}${r.enviados ? `mandó ${r.enviados} ${r.enviados === 1 ? "mensaje" : "mensajes"} y ` : ""}${que}.`, datos: { corrida: corrida.id, ...r } });
    return `flujo «${corrida.nombre}»: ${que}`;
  } catch (e) {
    await s.almacen.registrar({ tipo: "error", conversacion: ch.conv, detalle: `Flujo «${corrida.nombre}»: ${detalle(e)}` }).catch(() => {});
    await guardar({ estado: "terminado", resultado: "error" }).catch(() => {});
    await ch.pasarAlEquipo({ motivo: `El flujo «${corrida.nombre}» tuvo un error y no pudo seguir.`, resumen: detalle(e).slice(0, 300) }).catch(() => {});
    return `flujo con error: ${detalle(e)}`;
  }
}

export interface ResultadoFlujos {
  revisadas: number;
  retomadas: number;
  errores: number;
}

/**
 * Lo que hace el cron con los flujos: las esperas que vencieron siguen por «Si no responde» (o por
 * «Si responde», si la persona escribió y el aviso no llegó a tomarla) y las corridas que se
 * cortaron a la mitad siguen desde donde quedaron. Hasta `tope` por corrida del cron, todas en
 * paralelo (cada una puede tener pausas: así entran en los 300 segundos), pero escalonadas: cada
 * una arranca unos segundos después de la anterior, todas dentro de los primeros 90 segundos.
 */
export async function retomarFlujos(s: Servicios, { tope, azar = Math.random }: { tope: number; azar?: () => number }): Promise<ResultadoFlujos> {
  const ahora = s.ahora ?? (() => new Date());
  const resultado: ResultadoFlujos = { revisadas: 0, retomadas: 0, errores: 0 };
  const corridas = (await s.almacen.corridasParaRetomar(ahora().toISOString())).slice(0, tope);
  if (!corridas.length) return resultado;
  const lineas = await s.almacen.lineas();
  // Escalonados (lib/seguimientos/espaciar.ts): no salen todos en el mismo segundo desde el mismo número.
  const inicios = escalonar(corridas.length, azar);
  const dormir = s.dormir ?? dormirReal;
  await Promise.all(
    corridas.map(async (c, i) => {
      resultado.revisadas++;
      try {
        if (inicios[i]) await dormir(inicios[i]);
        if (!(await s.almacen.reclamarCorrida(c.id, { estado: c.estado, posicion: c.posicion }, ahora().toISOString()))) return;
        const linea: Linea | null = lineas.find((l) => l.id === c.linea) ?? null;
        const historial = await s.almacen.historial(c.conversacion, LARGO_HISTORIAL);
        const ch = await prepararCharla(s, { conv: c.conversacion, linea, historial });
        // Pidió que no le escriban (lib/baja.ts): el flujo se corta acá, sin mandar nada.
        if (ch.guardada?.pidio_baja) {
          await s.almacen.cancelarCorridas(c.conversacion);
          await s.almacen.registrar({ tipo: "flujo", conversacion: c.conversacion, detalle: `Flujo «${c.nombre}»: se cortó porque la persona pidió que no le escriban más.`, datos: { corrida: c.id } });
          return;
        }
        let disparo: Disparo = c.estado === "en_curso" ? "reanudar" : "vencio";
        if (c.estado === "esperando" && c.espera_desde && historial.some((m) => m.rol === "interesado" && m.fecha > c.espera_desde!)) disparo = "respuesta";
        const que = await correrTramo(s, ch, c, disparo);
        if (que.startsWith("flujo con error")) resultado.errores++;
        else resultado.retomadas++;
      } catch (e) {
        resultado.errores++;
        await s.almacen.registrar({ tipo: "error", conversacion: c.conversacion, detalle: `Flujo «${c.nombre}» (retomar): ${detalle(e)}` }).catch(() => {});
      }
    }),
  );
  return resultado;
}
