import "server-only";
import { configChatwoot, crearChatwoot, type Chatwoot } from "./chatwoot/api";
import { crearCRM, type CRM } from "./crm/planilla";
import { hojaGoogle } from "./crm/google";
import { almacenPostgres } from "./datos/postgres";
import type { Almacen } from "./datos/tipos";
import { modeloClaude } from "./agente/claude";
import type { Modelo } from "./agente/agente";

export interface Conexiones {
  almacen: Almacen | null;
  chatwoot: Chatwoot | null;
  modelo: Modelo | null;
  crm: CRM | null;
}

/** Las conexiones que se pueden armar con las variables cargadas (las que faltan quedan en null). */
export function conexionesDesdeEnv(env: Record<string, string | undefined> = process.env): Conexiones {
  const cw = configChatwoot(env);
  const hoja = hojaGoogle(env);
  return {
    almacen: almacenPostgres(env),
    chatwoot: cw ? crearChatwoot(cw) : null,
    modelo: modeloClaude(env),
    crm: hoja ? crearCRM(hoja, { responsable: env.CRM_RESPONSABLE?.trim() ?? "" }) : null,
  };
}
