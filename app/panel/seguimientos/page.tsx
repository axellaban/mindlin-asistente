import { datos, exigirSesion } from "@/lib/panel/servidor";
import { ETAPAS_SEGUIMIENTO } from "@/lib/panel/validar";
import { HORARIO, MAX_PASOS, textoSeguimiento } from "@/lib/seguimientos/reglas";
import { TOPE_POR_CORRIDA } from "@/lib/seguimientos/correr";
import { agregarRegla, borrarRegla, cambiarEstadoRegla } from "../acciones";
import { Marco, SinBase, type Avisos } from "../marco";

export const dynamic = "force-dynamic";

const ESTADOS: Record<string, string> = { activa: "Activa", a_prueba: "A prueba", archivada: "Archivada" };
const porcentaje = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

export default async function Seguimientos({ searchParams }: { searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const d = datos();
  if (!d) {
    return (
      <Marco nombre={nombre} actual="/panel/seguimientos" titulo="Seguimientos" avisos={searchParams}>
        <SinBase />
      </Marco>
    );
  }
  const [reglas, proyectos] = await Promise.all([d.reglas(), d.proyectos()]);
  const nombreProyecto = (id: string | null) => (id ? (proyectos.find((p) => p.id === id)?.nombre ?? id) : "Todos");
  const cron = Boolean(process.env.CRON_SECRET?.trim());
  return (
    <Marco nombre={nombre} actual="/panel/seguimientos" titulo="Seguimientos" avisos={searchParams}>
      <p className="nota">
        Si alguien consultó y dejó de responder, el asistente le vuelve a escribir según estas reglas: de {HORARIO.desde} a {HORARIO.hasta}, hasta {TOPE_POR_CORRIDA} cada 15 minutos, y nunca si una persona del equipo tomó la conversación. Si responde, los pasos vuelven a empezar.
        {!cron && " Ojo: falta CRON_SECRET en Vercel, así que por ahora no sale ninguno."}
      </p>
      {reglas.length === 0 ? (
        <p className="nota">Todavía no hay reglas: sin reglas no sale ningún seguimiento.</p>
      ) : (
        <div className="tabla">
          <table>
            <thead>
              <tr><th>Etapa · paso</th><th>Días</th><th>Proyecto</th><th>Mensaje</th><th>Versión</th><th>Enviados</th><th>Respondieron</th><th></th></tr>
            </thead>
            <tbody>
              {reglas.map((r) => (
                <tr key={r.id}>
                  <td>{r.etapa} · {r.paso}.º</td>
                  <td className="num">{r.dias_sin_respuesta}</td>
                  <td>{nombreProyecto(r.proyecto)}</td>
                  <td>
                    {r.mensaje}
                    {/\{\{/.test(r.mensaje) && (
                      <div className="nota">Así le llega a Ana: «{textoSeguimiento(r.mensaje, { nombre: "Ana", proyecto: r.proyecto ? nombreProyecto(r.proyecto) : (proyectos.find((p) => p.activo)?.nombre ?? "") })}»</div>
                    )}
                  </td>
                  <td>
                    v{r.version} <span className={`etiqueta ${r.estado === "activa" ? "activa" : ""}`}>{ESTADOS[r.estado]}</span>
                  </td>
                  <td className="num">{r.enviados}</td>
                  <td className="num">{r.respondieron} ({porcentaje(r.respondieron, r.enviados)})</td>
                  <td>
                    <form action={cambiarEstadoRegla}>
                      <input type="hidden" name="id" value={r.id} />
                      <select name="estado" defaultValue={r.estado} aria-label="Estado de la regla">
                        <option value="activa">Activa</option>
                        <option value="a_prueba">A prueba</option>
                        <option value="archivada">Archivada</option>
                      </select>
                      <button type="submit" className="enlace">Cambiar</button>
                    </form>
                    {r.enviados === 0 && (
                      <form action={borrarRegla}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="enlace">Borrar</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details open={reglas.length === 0}>
        <summary>Agregar una regla o una versión nueva</summary>
        <p className="nota">
          Para probar otro mensaje en la misma etapa y paso, cargalo como «A prueba»: a cada conversación le toca siempre la misma versión y acá se ve cuál consigue más respuestas. Para cambiar un mensaje, cargá una versión nueva y archivá la vieja (así no se pierde la medición).
        </p>
        <form action={agregarRegla}>
          <div className="fila-campos">
            <div>
              <label htmlFor="etapa">Etapa del CRM</label>
              <select id="etapa" name="etapa" defaultValue="Nuevo">
                {ETAPAS_SEGUIMIENTO.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="paso">Paso</label>
              <select id="paso" name="paso" defaultValue="1">
                {Array.from({ length: MAX_PASOS }, (_, i) => <option key={i} value={i + 1}>{i + 1}.º seguimiento</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="dias_sin_respuesta">Días sin respuesta</label>
              <input id="dias_sin_respuesta" name="dias_sin_respuesta" type="number" min={1} max={90} defaultValue={2} required />
            </div>
            <div>
              <label htmlFor="proyecto">Proyecto</label>
              <select id="proyecto" name="proyecto" defaultValue="">
                <option value="">Todos</option>
                {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="estado">Estado</label>
              <select id="estado" name="estado" defaultValue="activa">
                <option value="activa">Activa</option>
                <option value="a_prueba">A prueba</option>
              </select>
            </div>
          </div>
          <label htmlFor="mensaje">
            Mensaje <small>Podés usar {"{{nombre}}"} (el nombre de pila) y {"{{proyecto}}"}.</small>
          </label>
          <textarea id="mensaje" name="mensaje" required maxLength={2000} placeholder="Hola {{nombre}}, ¿pudiste ver lo de {{proyecto}}? Si querés te paso los planos." />
          <div className="acciones">
            <button type="submit">Agregar la regla</button>
          </div>
        </form>
      </details>
    </Marco>
  );
}
