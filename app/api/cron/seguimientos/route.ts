import { NextResponse } from "next/server";
import { esElCron } from "@/lib/cron";
import { correrSeguimientos } from "@/lib/seguimientos/correr";
import { conexionesDesdeEnv } from "@/lib/servicios";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Los seguimientos: lo dispara el cron de Vercel una vez por día (vercel.json). Ver docs/seguimientos.md. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET?.trim()) return NextResponse.json({ error: "Falta CRON_SECRET en Vercel." }, { status: 503 });
  if (!esElCron(req.headers.get("authorization"), process.env.CRON_SECRET)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { almacen, chatwoot, crm } = conexionesDesdeEnv();
  if (!almacen || !chatwoot) return NextResponse.json({ estado: "falta configurar la base o Chatwoot" });
  const resultado = await correrSeguimientos({ almacen, chatwoot, crm });
  if (resultado.enviados || resultado.errores) console.log("seguimientos:", JSON.stringify(resultado));
  return NextResponse.json(resultado);
}
