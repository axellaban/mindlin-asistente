import { ETAPAS_DESTINO } from "@/lib/etapas/reglas";
import { datos, exigirSesion } from "@/lib/panel/servidor";
import { guardarEtapa } from "../acciones";
import { fecha, Marco, SinBase, type Avisos } from "../marco";

export const dynamic = "force-dynamic";

export default async function Etapas({ searchParams }: { searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const d = datos();
  const etapas = d ? await d.etapas() : [];
  return (
    <Marco nombre={nombre} actual="/panel/etapas" titulo="Etapas automáticas" avisos={searchParams}>
      <p className="nota">
        El asistente mueve al lead de etapa en el CRM según lo que pasa en la conversación, y lo deja anotado en su actividad como «Cambio de etapa». Acá se elige a qué etapa
        lo manda cada cosa (o que no lo mueva).
      </p>
      <p className="nota">
        Cuidados que no cambian: no toca a quien está en <strong>Reserva</strong> o <strong>Vendido</strong>; dentro del embudo solo avanza, nunca retrocede; y a «En pausa» o
        «Descartado» solo lo manda desde Nuevo, Contacto inicial o Seguimiento. Si alguien en pausa o descartado vuelve a escribir, lo reactiva.
      </p>
      {!d ? (
        <SinBase />
      ) : (
        <div className="tabla">
          <table>
            <thead>
              <tr><th>Cuando…</th><th>Lo mueve a</th><th>Movió (30 días)</th><th>Último cambio</th></tr>
            </thead>
            <tbody>
              {etapas.map((e) => (
                <tr key={e.evento}>
                  <td>{e.titulo}</td>
                  <td>
                    <form action={guardarEtapa}>
                      <input type="hidden" name="evento" value={e.evento} />
                      <select name="etapa" defaultValue={e.etapa ?? ""} aria-label={`A qué etapa mueve: ${e.titulo}`}>
                        <option value="">No mover</option>
                        {ETAPAS_DESTINO.map((x) => <option key={x}>{x}</option>)}
                      </select>
                      <button type="submit" className="enlace">Guardar</button>
                    </form>
                  </td>
                  <td className="num">{e.movidos_30_dias}</td>
                  <td className="nota">{e.actualizado ? `${fecha(e.actualizado)}${e.actualizado_por ? ` (${e.actualizado_por})` : ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="nota">
        Ojo con «Se le mandó un seguimiento»: las reglas de seguimiento van por etapa, así que si ese evento lo mueve, el paso siguiente tiene que estar cargado para la etapa nueva.
      </p>
    </Marco>
  );
}
