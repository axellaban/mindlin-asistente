import { after, NextResponse } from "next/server";
import { conexionesDesdeEnv } from "@/lib/servicios";
import { manejarWebhook } from "@/lib/webhook";

/**
 * La IA puede tardar: la respuesta a Chatwoot sale enseguida y el resto corre después (after).
 * 300 segundos: la espera, los audios y hasta LIMITE_MS de vueltas con la IA (lib/agente/agente.ts).
 */
export const maxDuration = 300;

export async function POST(req: Request) {
  const cuerpo = await req.text();
  const salida = await manejarWebhook(
    cuerpo,
    { hora: req.headers.get("x-chatwoot-timestamp"), firma: req.headers.get("x-chatwoot-signature") },
    { clave: process.env.CHATWOOT_WEBHOOK_SECRET, conexiones: conexionesDesdeEnv() },
  );
  const tarea = salida.tarea;
  if (tarea) {
    after(async () => {
      try {
        console.log("asistente:", JSON.stringify(salida.json), "→", await tarea());
      } catch (e) {
        console.error("asistente: la tarea falló", e);
      }
    });
  }
  return NextResponse.json(salida.json, { status: salida.status });
}
