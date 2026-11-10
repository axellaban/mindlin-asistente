import { NextResponse } from "next/server";
import { describirIA } from "@/lib/agente/proveedor";
import { estadoConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Qué variables faltan, qué IA responde y si la API del hub está prendida (solo nombres, nunca los valores). Sirve para revisar la configuración de Vercel. */
export function GET() {
  const { listo, faltan } = estadoConfig(process.env);
  return NextResponse.json({ ok: true, configuracionCompleta: listo, faltan, ia: describirIA(process.env), apiDelHub: Boolean(process.env.HUB_CLAVE?.trim()) });
}
