import { NextResponse } from "next/server";
import { estadoDesdeNavegador, MAX_LARGO_PRUEBA, probar } from "@/lib/agente/prueba";
import { describirIA } from "@/lib/agente/proveedor";
import { estadoConfig } from "@/lib/config";
import { manejarHub } from "@/lib/hub/api";
import { chequear, datos } from "@/lib/panel/servidor";
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
    { metodo: req.method, ruta, cuerpo, autorizacion: req.headers.get("authorization"), usuario: nombreDelEncabezado(req.headers.get("x-hub-usuario")) },
    {
      clave: process.env.HUB_CLAVE,
      datos: datos(),
      faltan: estadoConfig(process.env).faltan,
      ia: describirIA(process.env),
      probar:
        almacen && modelo
          ? async (estado, texto) => {
              const [proyectos, tono, ejemplos, reglasEtapa] = await Promise.all([almacen.proyectosActivos(), almacen.tono(), almacen.ejemplos(), almacen.reglasEtapa().catch(() => ({}))]);
              return probar({ modelo, proyectos, tono, ejemplos, reglasEtapa, estado: estadoDesdeNavegador(estado), texto: texto.slice(0, MAX_LARGO_PRUEBA) });
            }
          : null,
      chequear: () => chequear(),
    },
  );
  return NextResponse.json(r.json, { status: r.status, headers: { "Cache-Control": "no-store" } });
}

/** Los encabezados no llevan acentos: el hub manda el nombre codificado («Jos%C3%A9»). Si viene sin codificar, se usa tal cual. */
function nombreDelEncabezado(valor: string | null): string | null {
  if (!valor) return null;
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

export { atender as GET, atender as PUT, atender as POST, atender as PATCH, atender as DELETE };
