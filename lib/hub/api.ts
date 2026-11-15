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
import { HORARIO_EQUIPO_DE_FABRICA, NOMBRES_DIAS } from "../agente/horario";
import { bearerCorrecto } from "../cron";
import type { DatosPanel } from "../panel/datos";
import { queFalta } from "../panel/listo";
import { limpiarNombre } from "../panel/sesion";
import {
  CAMPOS_FICHA,
  ESTADOS_REGLA,
  ETAPAS_SEGUIMIENTO,
  MAX_ARCHIVO_BYTES,
  MAX_CAMPO_FICHA,
  TIPOS_ARCHIVO,
  validarArchivo,
  validarEjemplo,
  validarFlujo,
  validarLinea,
  validarProyecto,
  validarRegla,
  validarReglaEtapa,
  validarTono,
} from "../panel/validar";
import { LIMITES, TIPOS_DE_PASO, VARIABLES_FLUJO } from "../flujos/modelo";
import { PLANTILLAS } from "../flujos/plantillas";
import { TIPOS_LINEA } from "../lineas";
import { MAX_FRASE, MAX_FRASES, MAX_NOMBRE_CAMPANIA, MIN_FRASE, validarCampania } from "../campanias";
import { resultadosPor } from "../resultados";
import type { ContactoCRM } from "../crm/planilla";
import { ETAPAS_DESTINO, EVENTOS } from "../etapas/reglas";
import { CORRIDA, HORARIO, MAX_PASOS, VARIABLES } from "../seguimientos/reglas";
import { TOPE_POR_CORRIDA } from "../seguimientos/correr";
import type { ReglaSeguimiento } from "../datos/tipos";
import type { Chequeo } from "../chequeo";

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
  /** Probar el asistente (lib/agente/prueba.ts), con una línea y sus flujos. Null si falta la clave de la IA. */
  probar?: ((estado: unknown, texto: string, o: { linea: string | null; vencer: boolean }) => Promise<RespuestaPrueba>) | null;
  /** Probar las conexiones de verdad (lib/chequeo.ts). */
  chequear?: (() => Promise<Chequeo>) | null;
  /** El link a una conversación en Chatwoot (con CHATWOOT_URL y CHATWOOT_ACCOUNT_ID). Null si falta. */
  enlaceChatwoot?: ((conversacion: number) => string | null) | null;
  /** Los contactos del CRM, para medir qué vende (lib/resultados.ts). Null si el CRM no está conectado. */
  contactosCRM?: (() => Promise<ContactoCRM[]>) | null;
}

/** Cuántos días para atrás se mide qué vende cada flujo y cada seguimiento. */
export const DIAS_RESULTADOS = 90;

/**
 * El link a una conversación en Chatwoot, para «Abrir en Chatwoot» (las fotos, los audios y las
 * notas internas no están en la base del asistente). Null si falta CHATWOOT_URL o la cuenta.
 */
export function enlacesChatwoot(env: Record<string, string | undefined>): ((conversacion: number) => string | null) | null {
  const url = env.CHATWOOT_URL?.trim().replace(/\/+$/, "");
  const cuenta = env.CHATWOOT_ACCOUNT_ID?.trim();
  if (!url || !/^https?:\/\//.test(url) || !cuenta || !/^\d+$/.test(cuenta)) return null;
  return (conversacion) => `${url}/app/accounts/${cuenta}/conversations/${conversacion}`;
}

/** Cuántos mensajes de cada conversación se mandan al hub (los más nuevos). */
export const MENSAJES_POR_CONVERSACION = 300;
/** Cuántas conversaciones de un mismo contacto (puede haber escrito por más de una línea). */
const CONVERSACIONES_POR_CONTACTO = 5;

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

/** El horario del equipo viaja como objeto; el formulario lo lee en campos sueltos, como el panel. */
function camposHorario(h: unknown): Objeto {
  if (!esObjeto(h)) return {};
  const campos: Objeto = {};
  if (h.dias !== undefined) campos.equipo_dias = Array.isArray(h.dias) ? h.dias : String(h.dias);
  if (h.desde !== undefined) campos.equipo_desde = h.desde;
  if (h.hasta !== undefined) campos.equipo_hasta = h.hasta;
  return campos;
}

const idDe = (t: string | undefined) => {
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** La base rechazó un valor repetido (por ejemplo, dos líneas con la misma bandeja). */
const repetido = (e: unknown) => (e as { code?: string } | null)?.code === "23505";

/** Lo que el hub necesita para dibujar sus formularios sin copiar las reglas. */
export const OPCIONES = {
  campos_ficha: CAMPOS_FICHA.map(([campo, titulo]) => ({ campo, titulo })),
  largo_maximo_campo: MAX_CAMPO_FICHA,
  etapas_seguimiento: ETAPAS_SEGUIMIENTO,
  /** Etapas automáticas: los eventos que pueden mover a un lead y a qué etapas puede mandarlo el asistente. */
  eventos_de_etapa: EVENTOS.map(([evento, titulo]) => ({ evento, titulo })),
  etapas_destino: ETAPAS_DESTINO,
  estados_regla: ESTADOS_REGLA,
  pasos_maximos: MAX_PASOS,
  variables_del_mensaje: VARIABLES,
  /** `corre`: cada cuánto sale la tanda de seguimientos («una vez por día, a las 10»). */
  horario_seguimientos: { ...HORARIO, tope_por_corrida: TOPE_POR_CORRIDA, corre: CORRIDA.texto },
  /** El horario del equipo de fábrica (el que vale está en `tono.horario_equipo`) y los nombres de los días: 0 es domingo. */
  horario_equipo: HORARIO_EQUIPO_DE_FABRICA,
  dias_semana: NOMBRES_DIAS,
  /** Las líneas: para qué es cada tipo. */
  tipos_linea: TIPOS_LINEA.map(([tipo, titulo, ayuda]) => ({ tipo, titulo, ayuda })),
  /** Los flujos: los pasos que se pueden usar, sus límites, las variables y los modelos para arrancar. */
  tipos_de_paso: TIPOS_DE_PASO.map(([tipo, titulo, ayuda]) => ({ tipo, titulo, ayuda })),
  limites_flujo: LIMITES,
  variables_flujo: VARIABLES_FLUJO,
  plantillas_flujo: PLANTILLAS,
  tipos_archivo: TIPOS_ARCHIVO,
  max_archivo_bytes: MAX_ARCHIVO_BYTES,
  /** Las campañas: el largo del nombre (queda como etiqueta en el CRM) y de las frases. */
  limites_campania: { nombre: MAX_NOMBRE_CAMPANIA, frase_min: MIN_FRASE, frase_max: MAX_FRASE, frases: MAX_FRASES },
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
        const [proyectos, tono, ejemplos, reglas, estado, etapas, lineas, flujos, archivos, campanias] = await Promise.all([
          datos.proyectos(),
          datos.tono(),
          datos.ejemplos(),
          datos.reglas(),
          datos.estado(),
          datos.etapas(),
          datos.lineas(),
          datos.flujos(),
          datos.archivos(),
          datos.campanias(),
        ]);
        const falta = queFalta({ tono, proyectos, reglas: reglas.filter((r) => r.estado !== "archivada").length, archivadas: reglas.filter((r) => r.estado === "archivada").length, faltan: d.faltan ?? [] });
        return { status: 200, json: { proyectos, tono, ejemplos, reglas, etapas, estado, falta, lineas, flujos, archivos, campanias, ia: d.ia ?? null, opciones: OPCIONES } };
      }

      case "resumen": {
        // /resumen: todas las líneas; /resumen/linea-3: solo esa.
        if (metodo !== "GET") return noSePuede();
        if (id && !(await datos.linea(id))) return error(404, "Esa línea no existe.");
        const [ultimos7Dias, registro, porCampania] = await Promise.all([datos.resumen(7, id ?? null), datos.registro({ limite: 50, linea: id ?? null }), datos.porCampania(30, id ?? null)]);
        return { status: 200, json: { ultimos_7_dias: ultimos7Dias, registro, por_campania_30_dias: porCampania } };
      }

      case "conversaciones": {
        // /conversaciones: las más recientes de todas las líneas; /conversaciones/linea-3: solo esa.
        if (metodo !== "GET") return noSePuede();
        if (id && !(await datos.linea(id))) return error(404, "Esa línea no existe.");
        const conversaciones = await datos.conversacionesHub({ linea: id ?? null });
        return { status: 200, json: { conversaciones: conversaciones.map((c) => ({ ...c, enlace: d.enlaceChatwoot?.(c.chatwoot_id) ?? null })) } };
      }

      case "conversacion": {
        // Una conversación entera: los mensajes, lo anotado, el flujo y lo que hizo el asistente.
        if (metodo !== "GET") return noSePuede();
        const n = idDe(id);
        if (!n) return noSePuede();
        const [detalle, [resumen], mensajes, registro] = await Promise.all([
          datos.conversacion(n),
          datos.conversacionesHub({ conversacion: n, limite: 1 }),
          datos.mensajes(n, MENSAJES_POR_CONVERSACION),
          datos.registro({ conversacion: n, limite: 30 }),
        ]);
        if (!detalle) return error(404, "Esa conversación no existe.");
        return {
          status: 200,
          json: { conversacion: { ...(resumen ?? {}), ...detalle, enlace: d.enlaceChatwoot?.(n) ?? null }, mensajes, registro },
        };
      }

      case "contacto": {
        // Las conversaciones de un contacto del CRM, con sus mensajes: por su ID o por su teléfono.
        // Es una lectura, pero va por POST: el teléfono no viaja en la dirección.
        if (metodo !== "POST" || id) return noSePuede();
        const contacto = { id: typeof cuerpo.id === "string" ? cuerpo.id : null, telefono: typeof cuerpo.telefono === "string" ? cuerpo.telefono : null };
        if (!contacto.id && !contacto.telefono) return error(400, "Mandá el «id» del contacto del CRM o su «telefono».");
        const conversaciones = await datos.conversacionesHub({ contacto, limite: CONVERSACIONES_POR_CONTACTO });
        const conMensajes = await Promise.all(
          conversaciones.map(async (c) => ({ ...c, enlace: d.enlaceChatwoot?.(c.chatwoot_id) ?? null, historial: await datos.mensajes(c.chatwoot_id, MENSAJES_POR_CONVERSACION) })),
        );
        return { status: 200, json: { conversaciones: conMensajes } };
      }

      case "resultados": {
        // Qué flujo y qué seguimiento venden: a cuántos les tocó y cuántos llegaron a visita,
        // negociación y reserva en el CRM. Lee el CRM entero: se pide cuando se abre la solapa.
        if (metodo !== "GET" || id) return noSePuede();
        const vacio = { dias: DIAS_RESULTADOS, flujos: [], seguimientos: [] };
        if (!d.contactosCRM) return { status: 200, json: { ...vacio, crm: false, error: "El CRM no está conectado (falta la planilla o la cuenta de Google en Vercel): no se puede saber a qué etapa llegó cada lead." } };
        const [leads, contactos] = await Promise.all([datos.leadsDeResultados(DIAS_RESULTADOS), d.contactosCRM().catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))))]);
        if (contactos instanceof Error) return { status: 200, json: { ...vacio, crm: false, error: `No se pudo leer el CRM: ${contactos.message}` } };
        const flujos = resultadosPor(leads.flujos.map((l) => ({ ...l, clave: String(l.flujo) })), contactos);
        const seguimientos = resultadosPor(leads.seguimientos.map((l) => ({ ...l, clave: `${l.regla}-${l.version}` })), contactos);
        return {
          status: 200,
          json: {
            dias: DIAS_RESULTADOS,
            crm: true,
            flujos: [...flujos].map(([k, v]) => ({ flujo: Number(k), ...v })),
            seguimientos: [...seguimientos].map(([k, v]) => {
              const [regla, version] = k.split("-").map(Number);
              return { regla, version, ...v };
            }),
          },
        };
      }

      case "campanias": {
        // De qué campaña viene cada lead (lib/campanias.ts): alta, cambio y baja.
        const listo = async (status = 200, extra: Objeto = {}) => ({ status, json: { ...extra, campanias: await datos.campanias() } });
        if (metodo === "GET" && !id) return listo();
        const lineas = async () => (await datos.lineas()).map((l) => l.id);
        if (metodo === "POST" && !id) {
          const r = validarCampania(cuerpo, await lineas());
          if (!r.ok) return error(400, r.error);
          return listo(201, { id: await datos.agregarCampania(r.valor, por) });
        }
        const n = idDe(id);
        if (!n) return noSePuede();
        const actual = (await datos.campanias()).find((c) => c.id === n);
        if (!actual) return error(404, "Esa campaña no existe.");
        if (metodo === "PUT") {
          // Solo cambia lo que viene.
          const r = validarCampania({ nombre: actual.nombre, linea: actual.linea, frases: actual.frases, activa: actual.activa, ...cuerpo }, await lineas());
          if (!r.ok) return error(400, r.error);
          await datos.guardarCampania(n, r.valor, por);
          return listo();
        }
        if (metodo === "DELETE") {
          await datos.borrarCampania(n);
          return listo();
        }
        return noSePuede();
      }

      case "lineas": {
        if (metodo === "GET" && !id) return { status: 200, json: { lineas: await datos.lineas() } };
        if (metodo !== "PUT" || !id) return noSePuede();
        const actual = await datos.linea(id);
        if (!actual) return error(404, "Esa línea no existe.");
        // Solo cambia lo que viene: lo demás queda como estaba.
        const r = validarLinea(formulario({ ...actual, ...cuerpo }), (await datos.proyectos()).map((p) => p.id));
        if (!r.ok) return error(400, r.error);
        try {
          await datos.guardarLinea(id, r.valor, por);
        } catch (e) {
          if (!repetido(e)) throw e;
          const otra = (await datos.lineas()).find((l) => l.bandeja === r.valor.bandeja);
          return error(409, `La bandeja ${r.valor.bandeja} ya es de la línea «${otra?.nombre ?? "otra"}». Cada línea tiene su propia bandeja en Chatwoot.`);
        }
        return { status: 200, json: { linea: await datos.linea(id), lineas: await datos.lineas() } };
      }

      case "flujos": {
        const proyectos = async () => (await datos.proyectos()).map((p) => p.id);
        const archivos = async () => new Set((await datos.archivos()).map((a) => a.id));
        const listo = async (status = 200, extra: Objeto = {}) => ({ status, json: { ...extra, flujos: await datos.flujos() } });
        if (metodo === "GET" && !id) return listo();
        if (metodo === "POST" && !id) {
          const linea = await datos.linea(String(cuerpo.linea ?? ""));
          if (!linea) return error(400, "Elegí una línea que exista («linea»: linea-3).");
          if (linea.tipo !== "entrada") return error(400, `La línea «${linea.nombre}» no es de leads entrantes: los flujos son para esas líneas.`);
          const r = validarFlujo(cuerpo, { proyectos: await proyectos(), archivos: await archivos() });
          if (!r.ok) return error(400, r.error);
          const nuevo = await datos.agregarFlujo({ ...r.valor, linea: linea.id }, por);
          if (cuerpo.activo === true) await datos.activarFlujo(nuevo, true, por);
          return listo(201, { id: nuevo });
        }
        const n = idDe(id);
        if (!n) return noSePuede();
        const actual = await datos.flujo(n);
        if (!actual) return error(404, "Ese flujo no existe.");
        if (metodo === "PUT") {
          const r = validarFlujo({ nombre: actual.nombre, proyecto: actual.proyecto, pasos: actual.pasos, ...cuerpo }, { proyectos: await proyectos(), archivos: await archivos() });
          if (!r.ok) return error(400, r.error);
          try {
            await datos.guardarFlujo(n, r.valor, por);
          } catch (e) {
            if (!repetido(e)) throw e;
            return error(409, "Ya hay un flujo activo para ese proyecto en esta línea: apagá uno de los dos antes.");
          }
          return listo();
        }
        if (metodo === "PATCH") {
          if (typeof cuerpo.activo !== "boolean") return error(400, "Mandá «activo»: true o false.");
          await datos.activarFlujo(n, cuerpo.activo, por);
          return listo();
        }
        if (metodo === "DELETE") {
          await datos.borrarFlujo(n);
          return listo();
        }
        return noSePuede();
      }

      case "archivos": {
        if (metodo === "GET" && !id) return { status: 200, json: { archivos: await datos.archivos() } };
        if (metodo === "POST" && !id) {
          const r = validarArchivo(cuerpo);
          if (!r.ok) return error(400, r.error);
          const nuevo = await datos.subirArchivo(r.valor, por);
          const archivos = await datos.archivos();
          return { status: 201, json: { archivo: archivos.find((a) => a.id === nuevo), archivos } };
        }
        const n = idDe(id);
        if (!n) return noSePuede();
        if (metodo === "GET") {
          const a = await datos.archivoConDatos(n);
          return a ? { status: 200, json: { archivo: a } } : error(404, "Ese archivo no existe.");
        }
        if (metodo === "DELETE") {
          if (!(await datos.borrarArchivo(n))) return error(409, "Ese archivo lo usa un flujo (o ya no existe): sacalo del flujo antes de borrarlo.");
          return { status: 200, json: { archivos: await datos.archivos() } };
        }
        return noSePuede();
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
        if (cuerpo.horario_equipo !== undefined && !esObjeto(cuerpo.horario_equipo)) return error(400, "«horario_equipo» va como { dias: [1, 2, 3, 4, 5], desde: 9, hasta: 20 }.");
        const actual = await datos.tono();
        // Lo que no viene queda como estaba, también dentro del horario (se puede mandar solo «hasta»).
        const r = validarTono(formulario({ ...actual, ...camposHorario(actual.horario_equipo), ...cuerpo, ...camposHorario(cuerpo.horario_equipo) }));
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
          const r = validarRegla(
            formulario(cuerpo),
            (await datos.proyectos()).map((x) => x.id),
            (await datos.lineas()).map((l) => l.id),
          );
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

      case "etapas": {
        if (metodo !== "PUT" || !id) return noSePuede();
        const r = validarReglaEtapa(id, cuerpo.etapa);
        if (!r.ok) return error(400, r.error);
        await datos.guardarEtapa(r.valor.evento, r.valor.etapa, por);
        return { status: 200, json: { etapas: await datos.etapas() } };
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
        const vencer = cuerpo.vencer === true;
        const texto = String(cuerpo.texto ?? "").trim();
        if (!texto && !vencer) return error(400, "Mandá «texto»: el mensaje del interesado.");
        const linea = typeof cuerpo.linea === "string" && cuerpo.linea ? cuerpo.linea : null;
        if (linea && !(await datos.linea(linea))) return error(404, "Esa línea no existe.");
        const estado: EstadoPrueba | unknown = cuerpo.estado ?? estadoInicial(typeof cuerpo.proyecto === "string" ? cuerpo.proyecto : null, linea);
        try {
          return { status: 200, json: { ...(await d.probar(estado, texto, { linea, vencer })) } };
        } catch (e) {
          // Por ejemplo, «Simular que no respondió» sin un flujo esperando.
          if (vencer) return error(400, e instanceof Error ? e.message : String(e));
          throw e;
        }
      }

      case "chequeo": {
        if (metodo !== "GET" || id) return noSePuede();
        if (!d.chequear) return error(503, "El chequeo de conexiones no está disponible.");
        return { status: 200, json: { chequeo: await d.chequear() } };
      }

      default:
        return error(404, "Esa dirección no existe. Ver docs/api-hub.md.");
    }
  } catch (e) {
    return error(500, `No se pudo completar: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}`);
  }
}
