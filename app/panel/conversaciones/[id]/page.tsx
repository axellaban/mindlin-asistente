import Link from "next/link";
import { notFound } from "next/navigation";
import { describirAnotado } from "@/lib/agente/anotado";
import { datos, exigirSesion, linkChatwoot } from "@/lib/panel/servidor";
import { fecha, Marco, SinBase, type Avisos } from "../../marco";
import { TextoWhatsApp } from "../../texto-whatsapp";

export const dynamic = "force-dynamic";

const QUIEN = { interesado: "Interesado", bot: "Asistente", persona: "Equipo" } as const;
const TIPOS: Record<string, string> = {
  respuesta: "Respondió",
  paso_a_persona: "Pasó al equipo",
  la_tomo_una_persona: "La tomó el equipo",
  volvio_al_bot: "Volvió al asistente",
  seguimiento: "Seguimiento",
  crm: "CRM",
  etapa: "Cambio de etapa",
  error: "Error",
};

export default async function Conversacion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const d = datos();
  const [c, mensajes, registro, proyectos] = d ? await Promise.all([d.conversacion(id), d.mensajes(id), d.registro({ conversacion: id, limite: 50 }), d.proyectos()]) : [null, [], [], []];
  const chatwoot = linkChatwoot(id);
  const sabe = describirAnotado(c?.interesado);
  const proyecto = c?.proyecto ? (proyectos.find((p) => p.id === c.proyecto)?.nombre ?? c.proyecto) : null;
  const titulo = c?.interesado?.nombre || c?.nombre || (c?.telefono ? `+${c.telefono}` : `Conversación #${id}`);
  return (
    <Marco nombre={nombre} actual="/panel/conversaciones" titulo={titulo} avisos={searchParams}>
      <p>
        <Link href="/panel/conversaciones">← Todas</Link>
        {chatwoot && (
          <>
            {" · "}
            <a href={chatwoot} target="_blank" rel="noreferrer">
              Abrir en Chatwoot para responder
            </a>
          </>
        )}
      </p>
      {!d ? (
        <SinBase />
      ) : (
        <>
          {c && (
            <dl className="ficha-conversacion">
              <dt>Quién la atiende</dt>
              <dd>{c.sin_seguimientos ? "El equipo (el asistente no responde ni manda seguimientos)" : "El asistente"}</dd>
              {c.telefono && (
                <>
                  <dt>Teléfono</dt>
                  <dd>+{c.telefono}</dd>
                </>
              )}
              <dt>Proyecto</dt>
              <dd>{proyecto ?? "Todavía no se sabe"}</dd>
              <dt>Lo que anotó el asistente</dt>
              <dd>{sabe || "Nada todavía"}</dd>
              {c.interesado?.resumen && (
                <>
                  <dt>Su último resumen</dt>
                  <dd>{c.interesado.resumen}</dd>
                </>
              )}
              <dt>CRM</dt>
              <dd>{c.crm_contacto_id ? `Contacto ${c.crm_contacto_id}` : "Todavía no está en el CRM"}</dd>
              <dt>Seguimientos</dt>
              <dd>
                {c.paso_seguimiento ? `${c.paso_seguimiento} enviado(s) desde que escribió por última vez` : "Ninguno pendiente"}
                {c.ultimo_seguimiento && ` · el último, ${fecha(c.ultimo_seguimiento)}`}
              </dd>
            </dl>
          )}
          <div className="chat">
            {mensajes.length === 0 && <p className="nota">No hay mensajes guardados de esta conversación.</p>}
            {mensajes.map((m) => (
              <div key={m.id} className={`burbuja ${m.rol === "interesado" ? "" : "nuestra"}`}>
                <TextoWhatsApp texto={m.texto} />
                <small>
                  {QUIEN[m.rol]} · {fecha(m.fecha)}
                </small>
              </div>
            ))}
          </div>
          {registro.length > 0 && (
            <details>
              <summary>Lo que hizo el asistente ({registro.length})</summary>
              <ul>
                {registro.map((r, i) => (
                  <li key={i}>
                    {fecha(r.fecha)} · <strong>{TIPOS[r.tipo] ?? r.tipo}</strong> · {r.detalle}
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
