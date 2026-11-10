/**
 * Lo que le falta al asistente para atender bien, en el orden en que conviene resolverlo. Lo
 * muestra el Resumen del panel. Puro: recibe lo que hay cargado.
 */

import type { Tono } from "../datos/tipos";
import type { FichaEditable } from "./validar";

export interface Paso {
  listo: boolean;
  texto: string;
  /** A dónde ir para resolverlo (si se resuelve desde el panel). */
  link?: string;
}

/** Los datos que más preguntan: sin ellos, el asistente pasa casi todo al equipo. */
const CLAVE: (keyof FichaEditable)[] = ["precios", "disponibilidad", "financiacion", "tipologias", "ubicacion"];
const NOMBRES: Partial<Record<keyof FichaEditable, string>> = {
  precios: "precios",
  disponibilidad: "disponibilidad",
  financiacion: "financiación",
  tipologias: "tipologías",
  ubicacion: "ubicación",
};

export function queFalta({
  tono,
  proyectos,
  reglas,
  archivadas = 0,
  faltan,
}: {
  tono: Tono;
  proyectos: FichaEditable[];
  /** Reglas de seguimiento activas o a prueba. */
  reglas: number;
  /** Reglas cargadas pero archivadas (por ejemplo, los borradores de Kommo). */
  archivadas?: number;
  faltan: string[];
}): Paso[] {
  const pasos: Paso[] = [];
  const activos = proyectos.filter((p) => p.activo);
  pasos.push(
    faltan.length
      ? { listo: false, texto: `Falta cargar en Vercel: ${faltan.join(", ")} (lo hace Axel).` }
      : { listo: true, texto: "Todas las conexiones están configuradas." },
  );
  pasos.push(
    tono.instrucciones.trim() && tono.criterios_comerciales.trim()
      ? { listo: true, texto: "El tono y los criterios comerciales están cargados." }
      : { listo: false, texto: "Completá el tono y los criterios comerciales.", link: "/panel/tono" },
  );
  if (!activos.length) pasos.push({ listo: false, texto: "No hay ningún proyecto activo: el asistente no tiene qué ofrecer.", link: "/panel/proyectos" });
  for (const p of activos) {
    const vacios = CLAVE.filter((c) => !String(p[c] ?? "").trim()).map((c) => NOMBRES[c]);
    pasos.push(
      vacios.length
        ? { listo: false, texto: `A la ficha de ${p.nombre} le falta: ${vacios.join(", ")}. Sin eso, el asistente pasa esas consultas al equipo.`, link: `/panel/proyectos/${p.id}` }
        : { listo: true, texto: `La ficha de ${p.nombre} tiene lo principal.` },
    );
  }
  pasos.push(
    reglas
      ? { listo: true, texto: `Hay ${reglas === 1 ? "1 regla" : `${reglas} reglas`} de seguimiento.` }
      : archivadas
        ? { listo: false, texto: `Hay ${archivadas === 1 ? "1 regla de seguimiento cargada, pero está archivada" : `${archivadas} reglas de seguimiento cargadas, pero están archivadas`}: revisalas y pasá a «Activa» las que quieras usar.`, link: "/panel/seguimientos" }
        : { listo: false, texto: "Todavía no hay reglas de seguimiento: nadie recibe un segundo mensaje si deja de responder.", link: "/panel/seguimientos" },
  );
  return pasos;
}
