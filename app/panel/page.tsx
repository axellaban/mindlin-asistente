import Link from "next/link";
import { describirIA } from "@/lib/agente/proveedor";
import { estadoConfig } from "@/lib/config";
import { queFalta } from "@/lib/panel/listo";
import { datos, exigirSesion } from "@/lib/panel/servidor";
import { pausarAsistente } from "./acciones";
import { fecha, Marco, SinBase, type Avisos } from "./marco";

export const dynamic = "force-dynamic";

const TIPOS: Record<string, string> = {
  respuesta: "Respuesta",
  paso_a_persona: "Pasó al equipo",
  la_tomo_una_persona: "La tomó el equipo",
  volvio_al_bot: "Volvió al asistente",
  pausa: "Pausa",
  seguimiento: "Seguimiento",
  crm: "CRM",
  error: "Error",
};

export default async function Resumen({ searchParams }: { searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const d = datos();
  const ia = describirIA(process.env);
  const { faltan } = estadoConfig(process.env);
  if (!d) {
    return (
      <Marco nombre={nombre} actual="/panel" titulo="Resumen" avisos={searchParams}>
        <SinBase />
      </Marco>
    );
  }
  const [r, registro, estado, tono, proyectos, reglas] = await Promise.all([d.resumen(7), d.registro({ limite: 30 }), d.estado(), d.tono(), d.proyectos(), d.reglas()]);
  const pasos = queFalta({ tono, proyectos, reglas: reglas.filter((x) => x.estado !== "archivada").length, faltan });
  const pendientes = pasos.filter((p) => !p.listo);
  return (
    <Marco nombre={nombre} actual="/panel" titulo="Resumen" avisos={searchParams}>
      <p className="nota">
        Responde {ia.proveedor === "openai" ? "OpenAI" : ia.proveedor === "anthropic" ? "Claude" : "nadie todavía (falta la clave de la IA)"}
        {ia.modelo ? ` (${ia.modelo})` : ""}. Audios: {ia.audios ? "se transcriben" : "pide que los escriban (falta OPENAI_API_KEY)"}.
      </p>
      <section aria-labelledby="falta-titulo">
        <h2 id="falta-titulo">{pendientes.length ? pendientes.length === 1 ? "Para que atienda bien, falta 1 cosa" : `Para que atienda bien, faltan ${pendientes.length} cosas` : "Está todo listo"}</h2>
        <ul className="pasos">
          {pasos.map((p, i) => (
            <li key={i} className={p.listo ? "listo" : ""}>
              <span aria-hidden="true">{p.listo ? "✅" : "⬜"}</span> {p.texto} {!p.listo && p.link && <Link href={p.link}>Resolverlo</Link>}
            </li>
          ))}
        </ul>
        <p className="nota">
          Antes de abrir la línea (y cada vez que cambies una ficha o el tono), <Link href="/panel/probar">probá el asistente</Link> como si fueras un interesado.
        </p>
      </section>
      <section className={`estado ${estado.pausado ? "pausado" : ""}`} aria-labelledby="estado-titulo">
        <h2 id="estado-titulo">{estado.pausado ? "⏸️ El asistente está pausado" : "El asistente está respondiendo"}</h2>
        <p className="nota">
          {estado.pausado
            ? "Cada conversación nueva pasa al equipo con una nota, y no salen seguimientos."
            : "Atiende las conversaciones pendientes de Chatwoot. Para tomar una sola, escribí en ella o abrila desde Chatwoot; para devolvérsela, volvé a ponerla como pendiente."}
          {estado.cambiado && ` Último cambio: ${fecha(estado.cambiado)}${estado.cambiado_por ? ` (${estado.cambiado_por})` : ""}.`}
        </p>
        <form action={pausarAsistente}>
          <input type="hidden" name="pausar" value={estado.pausado ? "0" : "1"} />
          <button type="submit" className={estado.pausado ? "" : "secundario"}>{estado.pausado ? "Reactivar el asistente" : "Pausar el asistente"}</button>
        </form>
      </section>
      <h2>Últimos 7 días</h2>
      <div className="tarjetas">
        <div className="tarjeta"><strong>{r.conversaciones}</strong><span>personas escribieron</span></div>
        <div className="tarjeta"><strong>{r.respuesta}</strong><span>respuestas del asistente</span></div>
        <div className="tarjeta"><strong>{r.paso_a_persona + r.la_tomo_una_persona}</strong><span>pasaron al equipo</span></div>
        <div className="tarjeta"><strong>{r.seguimiento}</strong><span>seguimientos</span></div>
        <div className="tarjeta"><strong>{r.error}</strong><span>errores</span></div>
      </div>
      <h2>Lo último que hizo</h2>
      {registro.length === 0 ? (
        <p className="nota">Todavía nada: cuando entre el primer mensaje por WhatsApp, aparece acá.</p>
      ) : (
        <div className="tabla">
          <table>
            <thead>
              <tr><th>Cuándo</th><th>Qué</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {registro.map((x, i) => (
                <tr key={i}>
                  <td className="num">{fecha(x.fecha)}</td>
                  <td><span className={`etiqueta ${x.tipo === "error" ? "error" : ""}`}>{TIPOS[x.tipo] ?? x.tipo}</span></td>
                  <td>
                    {x.conversacion != null && <Link href={`/panel/conversaciones/${x.conversacion}`}>#{x.conversacion}</Link>} <span className="recorte">{x.detalle}</span>
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
