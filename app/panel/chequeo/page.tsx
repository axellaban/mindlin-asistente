import { chequear, exigirSesion } from "@/lib/panel/servidor";
import type { EstadoPrueba } from "@/lib/chequeo";
import { fecha, Marco } from "../marco";

export const dynamic = "force-dynamic";
// El pedido de prueba a la IA puede tardar (hasta 60 segundos).
export const maxDuration = 120;

const ICONO: Record<EstadoPrueba, string> = { ok: "✅", aviso: "⚠️", falla: "❌" };
const ESTADO: Record<EstadoPrueba, string> = { ok: "Anda", aviso: "Revisar", falla: "No anda" };

/**
 * Probar las conexiones de verdad (lib/chequeo.ts). Solo corre al tocar el botón: así no se gasta
 * un pedido a la IA cada vez que alguien abre la página.
 */
export default async function Chequeo({ searchParams }: { searchParams: Promise<{ probar?: string }> }) {
  const nombre = await exigirSesion();
  const { probar } = await searchParams;
  const resultado = probar ? await chequear() : null;
  return (
    <Marco nombre={nombre} actual="/panel/chequeo" titulo="Conexiones">
      <p className="nota">
        Prueba de verdad cada pieza: que Chatwoot acepte el token del asistente, la base, la planilla del CRM y la IA, y muestra lo último que pasó. No manda nada a nadie ni cambia nada. Cada prueba hace un pedido chico a la IA (cuesta una fracción de
        centavo).
      </p>
      <form action="/panel/chequeo" className="acciones">
        <input type="hidden" name="probar" value="1" />
        <button type="submit">{resultado ? "Probar de nuevo" : "Probar las conexiones"}</button>
      </form>
      {resultado && (
        <>
          <h2>{resultado.ok ? "Todo conectado" : "Hay algo que no anda"}</h2>
          <p className="nota">Probado el {fecha(resultado.fecha)}.</p>
          <div className="tabla">
            <table>
              <thead>
                <tr>
                  <th>Qué</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {resultado.pruebas.map((p, i) => (
                  <tr key={i}>
                    <td>{p.que}</td>
                    <td className="num">
                      <span aria-hidden="true">{ICONO[p.estado]}</span> {ESTADO[p.estado]}
                    </td>
                    <td>{p.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Marco>
  );
}
