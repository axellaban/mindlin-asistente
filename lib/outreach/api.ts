/**
 * La API del outreach para el hub (docs/api-hub.md, «Outreach»): /api/hub/outreach/…
 *
 * - GET    outreach/<línea>                  el estado: cuidados, tope, envíos de hoy, si se puede mandar y las bases
 * - PUT    outreach/<línea>/config           guardar los cuidados, la secuencia y los textos
 * - POST   outreach/<línea>/vista-previa     { texto, incluir_descartados } qué pasaría con cada fila (no guarda)
 * - POST   outreach/<línea>/lotes            { nombre, texto, incluir_descartados } cargar una base
 * - POST   outreach/<línea>/contactos        { lote?, etapa?, buscar?, limite? } buscar en las bases
 * - GET    outreach/<línea>/cola             los próximos (no toma a nadie)
 * - GET    outreach/<línea>/aprendizajes     qué responde mejor, por variable del puntaje y por franja
 * - POST   outreach/<línea>/recalcular       volver a calcular los puntajes (después de prender o apagar una ficha)
 * - POST   outreach/<línea>/tomar            { modo, contacto? } el siguiente, por 10 minutos, con el texto
 * - POST   outreach/<línea>/enviar           WAHA nativo: manda el siguiente (uno por pedido)
 * - POST   outreach/<línea>/verificar        WAHA: si los próximos 20 tienen WhatsApp (no manda nada)
 * - POST   outreach/<línea>/prueba           { telefono } WAHA: el saludo de prueba a un número del equipo
 * - GET    outreach/<línea>/waha             si la sesión de WAHA de la línea está conectada
 * - POST   outreach/<línea>/resultados       { dias?, lote? } el embudo contra la meta, por base, por versión y por día
 * - POST   outreach/<línea>/seguir           sacar el freno
 * - POST   outreach/<línea>/mandar-igual     fuera de franja, solo hoy
 * - PATCH  outreach/lotes/<id>               { pausado }
 * - DELETE outreach/lotes/<id>
 * - POST   outreach/contactos/<id>/confirmar { clave, modo, ejecutor } salió (cuenta una sola vez)
 * - POST   outreach/contactos/<id>/fallo     { clave, falla, modo, ejecutor } no salió / sin WhatsApp / número incorrecto
 * - POST   outreach/contactos/<id>/soltar    | saltar
 * - GET    outreach/<línea>/respuestas       la bandeja «Responder»: quienes respondieron, con su último mensaje
 * - POST   outreach/contactos/<id>/marcar    { etapa: interesado | cerrado } cómo siguió
 * - PUT    outreach/contactos/<id>/telefono  { telefono } corregir uno «por revisar»
 *
 * `ejecutor` es «bot» cuando opera un agente con computer use (la pestaña con ?agente=1 en el hub).
 */

import type { ContactoCRM } from "../crm/planilla";
import type { Linea } from "../lineas";
import type { DatosOutreach, EtapaOutreach, Falla } from "./datos";
import { validarConfigOutreach, type Modo } from "./reglas";
import type { Waha } from "./waha";

export interface DependenciasOutreach {
  outreach: DatosOutreach;
  linea: (id: string) => Promise<Linea | null>;
  contactosCRM: (() => Promise<ContactoCRM[]>) | null;
  ahora: () => Date;
  /** WAHA directo (WAHA_URL y WAHA_API_KEY). Null si falta: el modo WAHA no está disponible. */
  waha?: Waha | null;
}

type Objeto = Record<string, unknown>;
const res = (status: number, json: Objeto) => ({ status, json });
const error = (status: number, mensaje: string) => res(status, { error: mensaje });
const idDe = (t: string | undefined) => {
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const MODOS: Modo[] = ["waha", "computer_use"];
const ETAPAS: EtapaOutreach[] = ["por_revisar", "por_contactar", "saludado", "respondio", "interesado", "cerrado", "invalido", "baja", "excluido"];
const FALLAS: Falla[] = ["no_salio", "sin_whatsapp", "numero_incorrecto"];

export async function manejarOutreach(ruta: string[], metodo: string, cuerpo: Objeto, por: string, d: DependenciasOutreach) {
  const [primero, id, accion, ...resto] = ruta;
  if (resto.length || !primero) return error(404, "Esa dirección no existe.");
  const noSePuede = () => error(405, `No se puede hacer ${metodo} en /outreach/${ruta.join("/")}.`);
  const o = d.outreach;

  if (primero === "lotes") {
    const n = idDe(id);
    if (!n || accion) return error(404, "Esa dirección no existe.");
    if (metodo === "PATCH") {
      if (typeof cuerpo.pausado !== "boolean") return error(400, "Mandá «pausado»: true o false.");
      return (await o.pausarLote(n, cuerpo.pausado)) ? res(200, { ok: true }) : error(404, "Esa base no existe.");
    }
    if (metodo === "DELETE") return (await o.borrarLote(n)) ? res(200, { ok: true }) : error(404, "Esa base no existe.");
    return noSePuede();
  }

  if (primero === "contactos") {
    const n = idDe(id);
    if (!n) return error(404, "Esa dirección no existe.");
    const clave = typeof cuerpo.clave === "string" ? cuerpo.clave : "";
    const modo = cuerpo.modo === "waha" || cuerpo.modo === "computer_use" ? cuerpo.modo : "a_mano";
    const ejecutor = cuerpo.ejecutor === "bot" ? "bot" : "persona";
    if (accion === "confirmar" && metodo === "POST") {
      const r = await o.confirmar(n, { clave, modo, por, ejecutor }, d.ahora());
      return "error" in r ? error(409, r.error) : res(200, r);
    }
    if (accion === "fallo" && metodo === "POST") {
      if (!FALLAS.includes(cuerpo.falla as Falla)) return error(400, "«falla» tiene que ser no_salio, sin_whatsapp o numero_incorrecto.");
      const r = await o.fallo(n, { clave, falla: cuerpo.falla as Falla, modo, por, ejecutor }, d.ahora());
      return "error" in r ? error(409, r.error) : res(200, r);
    }
    if (accion === "marcar" && metodo === "POST") {
      if (cuerpo.etapa !== "interesado" && cuerpo.etapa !== "cerrado") return error(400, "«etapa» tiene que ser interesado o cerrado.");
      return (await o.marcar(n, cuerpo.etapa, por, d.ahora())) ? res(200, { ok: true }) : error(409, "Solo se marcan los que ya respondieron.");
    }
    if (accion === "soltar" && metodo === "POST") return res(200, { ok: await o.soltar(n, por) });
    if (accion === "saltar" && metodo === "POST") return (await o.saltar(n, por, d.ahora())) ? res(200, { ok: true }) : error(409, "Lo tiene otra persona.");
    if (accion === "telefono" && metodo === "PUT") {
      const r = await o.corregirTelefono(n, String(cuerpo.telefono ?? ""));
      return "error" in r ? error(400, r.error) : res(200, r);
    }
    return noSePuede();
  }

  // outreach/<línea>/…
  const linea = await d.linea(primero);
  if (!linea) return error(404, "Esa línea no existe.");
  if (linea.tipo !== "outreach_frio") return error(400, `«${linea.nombre}» no es una línea de outreach.`);
  if (accion === undefined && id !== undefined) {
    // outreach/<línea>/<acción>
    return manejarLinea(linea.id, id, metodo, cuerpo, por, d);
  }
  if (id === undefined && metodo === "GET") {
    const [estado, lotes] = await Promise.all([o.estado(linea.id, d.ahora(), por), o.lotes(linea.id)]);
    return res(200, { estado, lotes });
  }
  return noSePuede();
}

async function manejarLinea(linea: string, accion: string, metodo: string, cuerpo: Objeto, por: string, d: DependenciasOutreach) {
  const o = d.outreach;
  const noSePuede = () => error(405, `No se puede hacer ${metodo} en /outreach/${linea}/${accion}.`);
  const crm = async () => (d.contactosCRM ? await d.contactosCRM().catch(() => null) : null);
  const incluir_descartados = cuerpo.incluir_descartados === true;
  switch (accion) {
    case "config": {
      if (metodo !== "PUT") return noSePuede();
      const r = validarConfigOutreach({ ...(await o.config(linea)), ...cuerpo });
      if ("error" in r) return error(400, r.error);
      await o.guardarConfig(linea, r.config, por);
      return res(200, { estado: await o.estado(linea, d.ahora(), por) });
    }
    case "vista-previa": {
      if (metodo !== "POST") return noSePuede();
      const contactos = await crm();
      const r = await o.vistaPrevia(linea, String(cuerpo.texto ?? ""), { incluir_descartados }, contactos);
      if ("error" in r) return error(400, r.error);
      // La vista previa muestra hasta 500 filas; los totales son de todas.
      return res(200, { ...r, filas: r.filas.slice(0, 500), crm_conectado: contactos !== null });
    }
    case "lotes": {
      if (metodo !== "POST") return noSePuede();
      const r = await o.crearLote(linea, String(cuerpo.nombre ?? ""), String(cuerpo.texto ?? ""), { incluir_descartados }, await crm(), por);
      if ("error" in r) return error(400, r.error);
      return res(201, { ...r, lotes: await o.lotes(linea) });
    }
    case "contactos": {
      if (metodo !== "POST") return noSePuede();
      const etapa = ETAPAS.includes(cuerpo.etapa as EtapaOutreach) ? (cuerpo.etapa as EtapaOutreach) : null;
      const contactos = await o.contactos(linea, {
        lote: idDe(String(cuerpo.lote ?? "")),
        etapa,
        buscar: typeof cuerpo.buscar === "string" ? cuerpo.buscar.slice(0, 100) : null,
        limite: Number(cuerpo.limite) || 200,
      });
      return res(200, { contactos });
    }
    case "recalcular":
      // Por ejemplo, después de prender o apagar una ficha (el proyecto suma distinto).
      if (metodo !== "POST") return noSePuede();
      await o.recalcular(linea, d.ahora());
      return res(200, { estado: await o.estado(linea, d.ahora(), por) });
    case "enviar": {
      // WAHA nativo: manda el siguiente (uno por pedido; la pantalla vuelve a llamar cuando termina la pausa).
      if (metodo !== "POST") return noSePuede();
      if (!d.waha) return error(503, "Falta conectar WAHA (WAHA_URL y WAHA_API_KEY en Vercel). Mientras tanto, se puede mandar con computer use.");
      return res(200, await o.enviarPorWaha(linea, d.waha, { por, ejecutor: cuerpo.ejecutor === "bot" ? "bot" : "persona" }, d.ahora()));
    }
    case "verificar": {
      if (metodo !== "POST") return noSePuede();
      if (!d.waha) return error(503, "Falta conectar WAHA (WAHA_URL y WAHA_API_KEY en Vercel).");
      const r = await o.verificarNumeros(linea, d.waha, { por }, d.ahora());
      return "error" in r ? error(409, r.error) : res(200, { ...r, estado: await o.estado(linea, d.ahora(), por) });
    }
    case "prueba": {
      if (metodo !== "POST") return noSePuede();
      if (!d.waha) return error(503, "Falta conectar WAHA (WAHA_URL y WAHA_API_KEY en Vercel).");
      const r = await o.prueba(linea, d.waha, String(cuerpo.telefono ?? ""));
      return "error" in r ? error(400, r.error) : res(200, r);
    }
    case "waha": {
      if (metodo !== "GET") return noSePuede();
      if (!d.waha) return res(200, { conectado: false, estado: "sin configurar" });
      const sesion = (await o.config(linea)).waha_sesion;
      const estado = await d.waha.estado(sesion).catch((e) => `error: ${e instanceof Error ? e.message : String(e)}`);
      return res(200, { conectado: estado === "WORKING", sesion, estado });
    }
    case "resultados": {
      // { dias?: 7 | 30 | 90 | null, lote? }
      if (metodo !== "POST") return noSePuede();
      const dias = cuerpo.dias == null ? null : Number(cuerpo.dias);
      if (dias !== null && (!Number.isInteger(dias) || dias < 1 || dias > 3650)) return error(400, "«dias» va de 1 a 3650, o null para todo.");
      return res(200, await o.resultados(linea, { dias, lote: idDe(String(cuerpo.lote ?? "")) }, await crm(), d.ahora()));
    }
    case "respuestas":
      if (metodo !== "GET") return noSePuede();
      return res(200, { respuestas: await o.respuestas(linea) });
    case "aprendizajes":
      if (metodo !== "GET") return noSePuede();
      return res(200, await o.aprendizajes(linea));
    case "cola":
      if (metodo !== "GET") return noSePuede();
      return res(200, { cola: await o.cola(linea, d.ahora()) });
    case "tomar": {
      if (metodo !== "POST") return noSePuede();
      if (!MODOS.includes(cuerpo.modo as Modo)) return error(400, "«modo» tiene que ser waha o computer_use.");
      const r = await o.tomar(linea, { modo: cuerpo.modo as Modo, por, contacto: idDe(String(cuerpo.contacto ?? "")) }, d.ahora());
      return res(200, r);
    }
    case "seguir":
      if (metodo !== "POST") return noSePuede();
      await o.seguir(linea, por);
      return res(200, { estado: await o.estado(linea, d.ahora(), por) });
    case "mandar-igual":
      if (metodo !== "POST") return noSePuede();
      await o.mandarIgualHoy(linea, por, d.ahora());
      return res(200, { estado: await o.estado(linea, d.ahora(), por) });
    default:
      return error(404, "Esa dirección no existe.");
  }
}
