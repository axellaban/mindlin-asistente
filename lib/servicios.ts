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

export interface Conexiones {
  almacen: Almacen | null;
  chatwoot: Chatwoot | null;
  modelo: Modelo | null;
  crm: CRM | null;
  /** Pasa los audios a texto (necesita OPENAI_API_KEY). Sin él, el bot pide que lo escriban. */
  transcribir?: Transcriptor | null;
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
  };
}
