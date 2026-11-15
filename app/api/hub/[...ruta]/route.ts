import { NextResponse } from "next/server";
import { probarConAlmacen } from "@/lib/agente/prueba";
import { describirIA } from "@/lib/agente/proveedor";
import { estadoConfig } from "@/lib/config";
import { enlacesChatwoot, manejarHub } from "@/lib/hub/api";
import { chequear, datos } from "@/lib/panel/servidor";
import { conexionesDesdeEnv } from "@/lib/servicios";
import { responderDesdeElHub } from "@/lib/agente/servicio";
import { lectorDeAdjuntos } from "@/lib/chatwoot/adjuntos";

export const dynamic = "force-dynamic";
// «Probar» es un pedido a la IA (con herramientas puede llevar más de una vuelta, y un flujo, varias).
// Los archivos de los flujos (hasta 2,5 MB) llegan en base64.
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
  const { almacen, modelo, crm, chatwoot } = conexionesDesdeEnv();
  const r = await manejarHub(
    { metodo: req.method, ruta, cuerpo, autorizacion: req.headers.get("authorization"), usuario: nombreDelEncabezado(req.headers.get("x-hub-usuario")) },
    {
      clave: process.env.HUB_CLAVE,
      datos: datos(),
      faltan: estadoConfig(process.env).faltan,
      ia: describirIA(process.env),
      probar: almacen && modelo ? (estado, texto, o) => probarConAlmacen(almacen, modelo, estado, texto, o) : null,
      chequear: () => chequear(),
      enlaceChatwoot: enlacesChatwoot(process.env),
      contactosCRM: crm ? () => crm.contactos() : null,
      adjuntos: lectorDeAdjuntos(process.env),
      responder: almacen && chatwoot ? (conversacion, texto, por) => responderDesdeElHub({ almacen, chatwoot }, conversacion, texto, por) : null,
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
