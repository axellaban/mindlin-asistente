import Link from "next/link";
import { datos, exigirSesion } from "@/lib/panel/servidor";
import { fecha, Marco, SinBase, type Avisos } from "../marco";

export const dynamic = "force-dynamic";

const QUIEN = { interesado: "Interesado", bot: "Asistente", persona: "Equipo" } as const;

export default async function Conversaciones({ searchParams }: { searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const d = datos();
  const [lista, proyectos] = d ? await Promise.all([d.conversaciones(150), d.proyectos()]) : [[], []];
  const nombreProyecto = (id: string) => proyectos.find((p) => p.id === id)?.nombre ?? id;
  return (
    <Marco nombre={nombre} actual="/panel/conversaciones" titulo="Conversaciones" avisos={searchParams}>
      <p className="nota">Las que pasaron por el asistente, de la más reciente a la más vieja. Para responder, se entra a Chatwoot.</p>
      {!d ? (
        <SinBase />
      ) : lista.length === 0 ? (
        <p className="nota">Todavía no hay conversaciones.</p>
      ) : (
        <div className="tabla">
          <table>
            <thead>
              <tr><th>Quién</th><th>Último mensaje</th><th>Cuándo</th><th>La atiende</th></tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.chatwoot_id}>
                  <td>
                    <Link href={`/panel/conversaciones/${c.chatwoot_id}`}>{c.nombre || (c.telefono ? `+${c.telefono}` : `#${c.chatwoot_id}`)}</Link>
                    {c.proyecto && <div className="nota">{nombreProyecto(c.proyecto)}</div>}
                  </td>
                  <td>
                    {c.ultimo_rol && <span className="etiqueta">{QUIEN[c.ultimo_rol]}</span>} <span className="recorte">{c.ultimo_texto}</span>
                  </td>
                  <td className="num">{fecha(c.ultimo)}</td>
                  <td>
                    {c.sin_seguimientos ? <span className="etiqueta">El equipo</span> : <span className="etiqueta activa">El asistente</span>}
                    {!c.sin_seguimientos && c.paso_seguimiento > 0 && <div className="nota">{c.paso_seguimiento} seguimiento(s) sin respuesta</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Marco>
  );
}
