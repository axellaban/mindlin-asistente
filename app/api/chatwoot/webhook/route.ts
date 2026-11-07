import { after, NextResponse } from "next/server";
import { conexionesDesdeEnv } from "@/lib/servicios";
import { manejarWebhook } from "@/lib/webhook";

/** Claude puede tardar: la respuesta a Chatwoot sale enseguida y el resto corre después (after). */
export const maxDuration = 120;

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
