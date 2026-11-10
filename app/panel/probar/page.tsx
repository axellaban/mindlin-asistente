import Link from "next/link";
import { describirIA } from "@/lib/agente/proveedor";
import { datos, exigirSesion } from "@/lib/panel/servidor";
import { Marco, SinBase, type Avisos } from "../marco";
import { ChatDePrueba } from "./chat";

export const dynamic = "force-dynamic";
// Cada mensaje es un pedido a la IA (con herramientas puede llevar más de una vuelta).
export const maxDuration = 300;

export default async function Probar({ searchParams }: { searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const d = datos();
  const ia = describirIA(process.env);
  const proyectos = d ? (await d.proyectos()).filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre })) : [];
  return (
    <Marco nombre={nombre} actual="/panel/probar" titulo="Probar el asistente" avisos={searchParams}>
      <p className="nota">
        Chateá con el asistente como si fueras un interesado. Usa el mismo <Link href="/panel/tono">tono</Link>, las mismas{" "}
        <Link href="/panel/proyectos">fichas</Link> y la misma IA que en WhatsApp, pero no sale nada por WhatsApp ni se escribe en el CRM: lo que haría se muestra
        debajo de cada respuesta. Si cambiás una ficha o el tono, la próxima respuesta ya lo usa.
      </p>
      {!d ? (
        <SinBase />
      ) : !ia.proveedor ? (
        <p className="aviso error">Falta la clave de la IA (ANTHROPIC_API_KEY) en Vercel: sin eso el asistente no puede responder.</p>
      ) : proyectos.length === 0 ? (
        <p className="aviso error">
          No hay ningún proyecto activo: el asistente no tiene qué ofrecer. <Link href="/panel/proyectos">Cargá o activá una ficha</Link>.
        </p>
      ) : (
        <ChatDePrueba proyectos={proyectos} />
      )}
    </Marco>
  );
}
