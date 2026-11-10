import Link from "next/link";
import { notFound } from "next/navigation";
import { datos, exigirSesion, linkChatwoot } from "@/lib/panel/servidor";
import { fecha, Marco, SinBase, type Avisos } from "../../marco";

export const dynamic = "force-dynamic";

const QUIEN = { interesado: "Interesado", bot: "Asistente", persona: "Equipo" } as const;

export default async function Conversacion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const d = datos();
  const [mensajes, registro] = d ? await Promise.all([d.mensajes(id), d.registro({ conversacion: id, limite: 50 })]) : [[], []];
  const chatwoot = linkChatwoot(id);
  return (
    <Marco nombre={nombre} actual="/panel/conversaciones" titulo={`Conversación #${id}`} avisos={searchParams}>
      <p>
        <Link href="/panel/conversaciones">← Todas</Link>
        {chatwoot && (
          <>
            {" · "}
            <a href={chatwoot} target="_blank" rel="noreferrer">Abrir en Chatwoot</a>
          </>
        )}
      </p>
      {!d ? (
        <SinBase />
      ) : (
        <>
          <div className="chat">
            {mensajes.length === 0 && <p className="nota">No hay mensajes guardados de esta conversación.</p>}
            {mensajes.map((m) => (
              <div key={m.id} className={`burbuja ${m.rol === "interesado" ? "" : "nuestra"}`}>
                {m.texto}
                <small>{QUIEN[m.rol]} · {fecha(m.fecha)}</small>
              </div>
            ))}
          </div>
          {registro.length > 0 && (
            <details>
              <summary>Lo que hizo el asistente ({registro.length})</summary>
              <ul>
                {registro.map((r, i) => (
                  <li key={i}>
                    {fecha(r.fecha)} · <strong>{r.tipo}</strong> · {r.detalle}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Marco>
  );
}
