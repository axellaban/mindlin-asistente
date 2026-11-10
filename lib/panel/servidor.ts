import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { poolDesdeEnv } from "../datos/postgres";
import { datosPanel, type DatosPanel } from "./datos";
import { COOKIE_SESION, leerToken } from "./sesion";

/** Quién entró al panel, o null. */
export async function sesionActual(): Promise<string | null> {
  return leerToken((await cookies()).get(COOKIE_SESION)?.value, process.env.PANEL_CLAVE);
}

/** Para cada página y cada acción del panel: sin sesión, a la pantalla de entrada. */
export async function exigirSesion(): Promise<string> {
  const nombre = await sesionActual();
  if (!nombre) redirect("/panel/entrar");
  return nombre;
}

/** Los datos del panel, o null si falta la base (DATABASE_URL). */
export function datos(): DatosPanel | null {
  const db = poolDesdeEnv();
  return db ? datosPanel(db) : null;
}

/** El link a una conversación en Chatwoot, si están las variables. */
export function linkChatwoot(conversacion: number): string | null {
  const url = process.env.CHATWOOT_URL?.trim().replace(/\/+$/, "");
  const cuenta = process.env.CHATWOOT_ACCOUNT_ID?.trim();
  return url && cuenta ? `${url}/app/accounts/${cuenta}/conversations/${conversacion}` : null;
}
