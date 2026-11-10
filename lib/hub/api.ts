/**
 * La API para el hub de Mindlin: todo lo que se configura del asistente (fichas, tono, ejemplos,
 * reglas de seguimiento, pausa) se puede leer y cambiar desde afuera, con una clave compartida
 * (HUB_CLAVE). Así el hub arma sus propias pantallas sobre la misma configuración que usa el
 * panel del asistente: no hay dos copias.
 *
 * Las reglas son las mismas que en el panel (lib/panel/validar.ts): lo que el hub manda se
 * revisa igual. El contrato está en docs/api-hub.md.
 *
 * Puro en lo que importa: recibe el pedido ya leído y las dependencias; la ruta de Next
 * (app/api/hub/[...ruta]/route.ts) solo lo conecta.
 */

import { estadoInicial, type EstadoPrueba, type RespuestaPrueba } from "../agente/prueba-comun";
import { HORARIO_EQUIPO } from "../agente/contexto";
import { bearerCorrecto } from "../cron";
import type { DatosPanel } from "../panel/datos";
import { queFalta } from "../panel/listo";
import { limpiarNombre } from "../panel/sesion";
import { CAMPOS_FICHA, ESTADOS_REGLA, ETAPAS_SEGUIMIENTO, MAX_CAMPO_FICHA, validarEjemplo, validarProyecto, validarRegla, validarTono } from "../panel/validar";
import { HORARIO, MAX_PASOS, VARIABLES } from "../seguimientos/reglas";
import { TOPE_POR_CORRIDA } from "../seguimientos/correr";
import type { ReglaSeguimiento } from "../datos/tipos";

export interface PedidoHub {
  metodo: string;
  /** Lo que viene después de /api/hub/, partido por «/». */
  ruta: string[];
  cuerpo: unknown;
  autorizacion: string | null;
  /** Quién hizo el cambio en el hub (encabezado X-Hub-Usuario): queda anotado. */
  usuario?: string | null;
}

export interface DependenciasHub {
  clave: string | undefined;
  datos: DatosPanel | null;
  /** Variables que faltan en Vercel y qué IA responde: para el resumen de «qué falta». */
  faltan?: string[];
  ia?: unknown;
  /** Probar el asistente (lib/agente/prueba.ts). Null si falta la clave de la IA. */
  probar?: ((estado: unknown, texto: string) => Promise<RespuestaPrueba>) | null;
}

export interface RespuestaHub {
  status: number;
  json: Record<string, unknown>;
}

type Objeto = Record<string, unknown>;
const error = (status: number, mensaje: string): RespuestaHub => ({ status, json: { error: mensaje } });
const esObjeto = (x: unknown): x is Objeto => Boolean(x) && typeof x === "object" && !Array.isArray(x);

/** Un objeto JSON visto como un formulario, para usar las mismas validaciones que el panel. */
function formulario(o: Objeto): Pick<FormData, "get"> {
  return {
    get(campo: string) {
      const v = o[campo];
      if (v == null) return null;
      if (Array.isArray(v)) return v.map(String).join(", ");
      if (typeof v === "boolean") return v ? "on" : null;
      return String(v);
    },
  };
}

const idDe = (t: string | undefined) => {
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Lo que el hub necesita para dibujar sus formularios sin copiar las reglas. */
export const OPCIONES = {
  campos_ficha: CAMPOS_FICHA.map(([campo, titulo]) => ({ campo, titulo })),
  largo_maximo_campo: MAX_CAMPO_FICHA,
  etapas_seguimiento: ETAPAS_SEGUIMIENTO,
  estados_regla: ESTADOS_REGLA,
  pasos_maximos: MAX_PASOS,
  variables_del_mensaje: VARIABLES,
  horario_seguimientos: { ...HORARIO, tope_por_corrida: TOPE_POR_CORRIDA },
  horario_equipo: { dias: HORARIO_EQUIPO.dias, desde: HORARIO_EQUIPO.desde, hasta: HORARIO_EQUIPO.hasta },
} as const;

export async function manejarHub(p: PedidoHub, d: DependenciasHub): Promise<RespuestaHub> {
  if (!d.clave?.trim()) return error(503, "Falta HUB_CLAVE en Vercel (proyecto mindlin-asistente): sin esa clave, la API del hub está apagada.");
  if (!bearerCorrecto(p.autorizacion, d.clave)) return error(401, "Clave incorrecta. Mandá el encabezado «Authorization: Bearer <HUB_CLAVE>».");
  const datos = d.datos;
  if (!datos) return error(503, "Falta la base de datos (DATABASE_URL) en Vercel.");

  const por = limpiarNombre(p.usuario ?? "") || "Hub";
  const [recurso, id, ...resto] = p.ruta;
  if (resto.length) return error(404, "Esa dirección no existe.");
  const cuerpo: Objeto = esObjeto(p.cuerpo) ? p.cuerpo : {};
  const metodo = p.metodo.toUpperCase();
  const noSePuede = () => error(405, `No se puede hacer ${metodo} en /${p.ruta.join("/")}.`);

  try {
    switch (recurso) {
      case "config": {
        if (metodo !== "GET" || id) return noSePuede();
        const [proyectos, tono, ejemplos, reglas, estado] = await Promise.all([datos.proyectos(), datos.tono(), datos.ejemplos(), datos.reglas(), datos.estado()]);
        const falta = queFalta({ tono, proyectos, reglas: reglas.filter((r) => r.estado !== "archivada").length, archivadas: reglas.filter((r) => r.estado === "archivada").length, faltan: d.faltan ?? [] });
        return { status: 200, json: { proyectos, tono, ejemplos, reglas, estado, falta, ia: d.ia ?? null, opciones: OPCIONES } };
      }

      case "resumen": {
        if (metodo !== "GET" || id) return noSePuede();
        const [ultimos7Dias, registro] = await Promise.all([datos.resumen(7), datos.registro({ limite: 50 })]);
        return { status: 200, json: { ultimos_7_dias: ultimos7Dias, registro } };
      }

      case "proyectos": {
        if (metodo !== "PUT" || !id) return noSePuede();
        // Solo cambia lo que viene: lo demás queda como estaba (si el proyecto no existe, se crea).
        const actual = await datos.proyecto(id);
        const r = validarProyecto(formulario({ activo: true, ...(actual ?? {}), ...cuerpo, id }));
        if (!r.ok) return error(400, r.error);
        await datos.guardarProyecto(r.valor, por);
        return { status: actual ? 200 : 201, json: { proyecto: await datos.proyecto(r.valor.id) } };
      }

      case "tono": {
        if (metodo !== "PUT" || id) return noSePuede();
        const r = validarTono(formulario({ ...(await datos.tono()), ...cuerpo }));
        if (!r.ok) return error(400, r.error);
        await datos.guardarTono(r.valor, por);
        return { status: 200, json: { tono: await datos.tono() } };
      }

      case "ejemplos": {
        if (metodo === "POST" && !id) {
          const r = validarEjemplo(formulario(cuerpo));
          if (!r.ok) return error(400, r.error);
          await datos.agregarEjemplo(r.valor);
          return { status: 201, json: { ejemplos: await datos.ejemplos() } };
        }
        const n = idDe(id);
        if (!n) return noSePuede();
        if (metodo === "PATCH") {
          if (typeof cuerpo.activo !== "boolean") return error(400, "Mandá «activo»: true o false.");
          await datos.activarEjemplo(n, cuerpo.activo);
        } else if (metodo === "DELETE") await datos.borrarEjemplo(n);
        else return noSePuede();
        return { status: 200, json: { ejemplos: await datos.ejemplos() } };
      }

      case "reglas": {
        if (metodo === "POST" && !id) {
          const r = validarRegla(formulario(cuerpo), (await datos.proyectos()).map((x) => x.id));
          if (!r.ok) return error(400, r.error);
          const nueva = await datos.agregarRegla(r.valor);
          return { status: 201, json: { id: nueva, reglas: await datos.reglas() } };
        }
        const n = idDe(id);
        if (!n) return noSePuede();
        if (metodo === "PATCH") {
          const estado = String(cuerpo.estado ?? "");
          if (!(ESTADOS_REGLA as readonly string[]).includes(estado)) return error(400, `El estado tiene que ser uno de: ${ESTADOS_REGLA.join(", ")}.`);
          await datos.cambiarEstadoRegla(n, estado as ReglaSeguimiento["estado"]);
        } else if (metodo === "DELETE") {
          if (!(await datos.borrarRegla(n))) return error(409, "Esa regla ya se mandó (o no existe): no se borra, porque se perdería la medición. Archivala.");
        } else return noSePuede();
        return { status: 200, json: { reglas: await datos.reglas() } };
      }

      case "estado": {
        if (metodo !== "PUT" || id) return noSePuede();
        if (typeof cuerpo.pausado !== "boolean") return error(400, "Mandá «pausado»: true o false.");
        await datos.pausar(cuerpo.pausado, por);
        return { status: 200, json: { estado: await datos.estado() } };
      }

      case "probar": {
        if (metodo !== "POST" || id) return noSePuede();
        if (!d.probar) return error(503, "Falta la clave de la IA (ANTHROPIC_API_KEY) en Vercel.");
        const texto = String(cuerpo.texto ?? "").trim();
        if (!texto) return error(400, "Mandá «texto»: el mensaje del interesado.");
        const estado: EstadoPrueba | unknown = cuerpo.estado ?? estadoInicial(typeof cuerpo.proyecto === "string" ? cuerpo.proyecto : null);
        return { status: 200, json: { ...(await d.probar(estado, texto)) } };
      }

      default:
        return error(404, "Esa dirección no existe. Ver docs/api-hub.md.");
    }
  } catch (e) {
    return error(500, `No se pudo completar: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}`);
  }
}
