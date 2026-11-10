import { NextResponse } from "next/server";
import { estadoDesdeNavegador, MAX_LARGO_PRUEBA, probar } from "@/lib/agente/prueba";
import { describirIA } from "@/lib/agente/proveedor";
import { estadoConfig } from "@/lib/config";
import { manejarHub } from "@/lib/hub/api";
import { datos } from "@/lib/panel/servidor";
import { conexionesDesdeEnv } from "@/lib/servicios";

export const dynamic = "force-dynamic";
// «Probar» es un pedido a la IA (con herramientas puede llevar más de una vuelta).
export const maxDuration = 300;

/** La API para el hub de Mindlin. El contrato está en docs/api-hub.md; la lógica, en lib/hub/api.ts. */
async function atender(req: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await params;
  let cuerpo: unknown = null;
  if (req.method !== "GET" && req.method !== "DELETE") {
    try {
      cuerpo = JSON.parse((await req.text()) || "null");
    } catch {
      return NextResponse.json({ error: "El cuerpo no es JSON." }, { status: 400 });
    }
  }
  const { almacen, modelo } = conexionesDesdeEnv();
  const r = await manejarHub(
    { metodo: req.method, ruta, cuerpo, autorizacion: req.headers.get("authorization"), usuario: req.headers.get("x-hub-usuario") },
    {
      clave: process.env.HUB_CLAVE,
      datos: datos(),
      faltan: estadoConfig(process.env).faltan,
      ia: describirIA(process.env),
      probar:
        almacen && modelo
          ? async (estado, texto) => {
              const [proyectos, tono, ejemplos] = await Promise.all([almacen.proyectosActivos(), almacen.tono(), almacen.ejemplos()]);
              return probar({ modelo, proyectos, tono, ejemplos, estado: estadoDesdeNavegador(estado), texto: texto.slice(0, MAX_LARGO_PRUEBA) });
            }
          : null,
    },
  );
  return NextResponse.json(r.json, { status: r.status, headers: { "Cache-Control": "no-store" } });
}

export { atender as GET, atender as PUT, atender as POST, atender as PATCH, atender as DELETE };
