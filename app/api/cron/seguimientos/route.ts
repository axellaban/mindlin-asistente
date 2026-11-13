import { NextResponse } from "next/server";
import { autorizado } from "@/lib/cron";
import { correrSeguimientos } from "@/lib/seguimientos";
import { conexionesDesdeEnv } from "@/lib/servicios";

/**
 * Manda los seguimientos que correspondan. Lo llama el cron del servidor cada 15 minutos
 * (infra/servidor.sh seguimientos) con «Authorization: Bearer <CRON_SECRET>».
 */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

async function correr(req: Request) {
  if (!process.env.CRON_SECRET?.trim()) return NextResponse.json({ error: "Falta CRON_SECRET en Vercel." }, { status: 503 });
  if (!autorizado(req.headers.get("authorization"), process.env.CRON_SECRET)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { almacen, chatwoot, crm } = conexionesDesdeEnv();
  if (!almacen || !chatwoot) return NextResponse.json({ error: "Falta configurar la base o Chatwoot en Vercel." }, { status: 503 });
  const resultado = await correrSeguimientos({ almacen, chatwoot, crm });
  console.log("seguimientos:", JSON.stringify(resultado));
  return NextResponse.json(resultado);
}

export const GET = correr;
export const POST = correr;
