import "server-only";
import { configChatwoot, crearChatwoot, type Chatwoot } from "./chatwoot/api";
import { crearCRM, type CRM } from "./crm/planilla";
import { hojaGoogle } from "./crm/google";
import { almacenPostgres } from "./datos/postgres";
import type { Almacen } from "./datos/tipos";
import { crearModeloClaude } from "./agente/claude";
import { crearModeloOpenAI, crearTranscriptorOpenAI, type Transcriptor } from "./agente/openai";
import { eleccionTranscripcion, elegirIA } from "./agente/proveedor";
import type { Modelo } from "./agente/agente";
import { avisoAlHubDesdeEnv, type AvisarAlEquipo } from "./hub/aviso";
import { poolDesdeEnv } from "./datos/postgres";
import { listaDesdeEnv, type LeerLista } from "./hub/lista";

/** Una sola por proceso: así lo leído del hub se guarda entre mensajes (10 minutos). */
let lista: { clave: string; leer: LeerLista | null } | null = null;
function listaGuardada(env: Record<string, string | undefined>): LeerLista | null {
  const clave = `${env.HUB_URL ?? ""}|${env.HUB_CLAVE ?? ""}`;
  if (!lista || lista.clave !== clave) lista = { clave, leer: listaDesdeEnv(env) };
  return lista.leer;
}
import { datosOutreach, type DatosOutreach } from "./outreach/datos";

export interface Conexiones {
  almacen: Almacen | null;
  chatwoot: Chatwoot | null;
  modelo: Modelo | null;
  crm: CRM | null;
  /** Pasa los audios a texto (necesita OPENAI_API_KEY). Sin él, el bot pide que lo escriban. */
  transcribir?: Transcriptor | null;
  /** Avisa en el hub cuando el asistente pasa una conversación al equipo (necesita HUB_URL y HUB_CLAVE). */
  avisarAlEquipo?: AvisarAlEquipo | null;
  /** El outreach frío de la línea 1 (lib/outreach/datos.ts): las respuestas de la base. */
  outreach?: DatosOutreach | null;
  /** La lista de precios del hub (necesita HUB_URL y HUB_CLAVE). */
  listaDePrecios?: LeerLista | null;
}

/** Las conexiones que se pueden armar con las variables cargadas (las que faltan quedan en null). */
export function conexionesDesdeEnv(env: Record<string, string | undefined> = process.env): Conexiones {
  const cw = configChatwoot(env);
  const hoja = hojaGoogle(env);
  const ia = elegirIA(env);
  const audios = eleccionTranscripcion(env);
  return {
    almacen: almacenPostgres(env),
    chatwoot: cw ? crearChatwoot(cw) : null,
    modelo: !ia ? null : ia.proveedor === "openai" ? crearModeloOpenAI(ia) : crearModeloClaude(ia),
    crm: hoja ? crearCRM(hoja, { responsable: env.CRM_RESPONSABLE?.trim() ?? "" }) : null,
    transcribir: audios ? crearTranscriptorOpenAI(audios) : null,
    avisarAlEquipo: avisoAlHubDesdeEnv(env),
    listaDePrecios: listaGuardada(env),
    outreach: (() => {
      const pool = poolDesdeEnv(env);
      return pool ? datosOutreach(pool) : null;
    })(),
  };
}
