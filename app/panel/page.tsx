import Link from "next/link";
import { describirIA } from "@/lib/agente/proveedor";
import { estadoConfig } from "@/lib/config";
import { datos, exigirSesion } from "@/lib/panel/servidor";
import { fecha, Marco, SinBase, type Avisos } from "./marco";

export const dynamic = "force-dynamic";

const TIPOS: Record<string, string> = {
  respuesta: "Respuesta",
  paso_a_persona: "Pasó al equipo",
  la_tomo_una_persona: "La tomó el equipo",
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
  const [r, registro] = await Promise.all([d.resumen(7), d.registro({ limite: 30 })]);
  return (
    <Marco nombre={nombre} actual="/panel" titulo="Resumen" avisos={searchParams}>
      <p className="nota">
        Responde {ia.proveedor === "openai" ? "OpenAI" : ia.proveedor === "anthropic" ? "Claude" : "nadie todavía (falta la clave de la IA)"}
        {ia.modelo ? ` (${ia.modelo})` : ""}. Audios: {ia.audios ? "se transcriben" : "pide que los escriban (falta OPENAI_API_KEY)"}.
        {faltan.length > 0 && <> Falta cargar en Vercel: {faltan.join(", ")}.</>}
      </p>
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
