import { NextResponse } from "next/server";
import { estadoConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Qué variables faltan (solo los nombres, nunca los valores). Sirve para revisar la configuración de Vercel. */
export function GET() {
  const { listo, faltan } = estadoConfig(process.env);
  return NextResponse.json({ ok: true, configuracionCompleta: listo, faltan });
}
