import "server-only";
import { JWT } from "google-auth-library";
import type { Hoja } from "./planilla";

/**
 * La planilla del CRM por la API de Google Sheets, con la cuenta de servicio propia del asistente
 * (tiene su propio límite de pedidos por minuto: no le come cuota al hub).
 */
export function hojaGoogle(env: Record<string, string | undefined> = process.env): Hoja | null {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const clave = env.GOOGLE_PRIVATE_KEY;
  const planilla = env.CRM_SHEET_ID;
  if (!email || !clave || !planilla) return null;
  const cliente = new JWT({ email, key: clave.replace(/\\n/g, "\n"), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(planilla)}/values`;
  // Si Google no contesta, mejor un error a tiempo: el asistente sigue sin el CRM.
  const timeout = 20_000;
  return {
    async leer(rango) {
      const r = await cliente.request<{ values?: string[][] }>({ url: `${base}/${encodeURIComponent(rango)}`, timeout });
      return r.data.values ?? [];
    },
    async agregar(pestania, filas) {
      await cliente.request({
        url: `${base}/${encodeURIComponent(`'${pestania}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        method: "POST",
        data: { values: filas },
        timeout,
      });
    },
  };
}
