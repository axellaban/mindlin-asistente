import { datos, exigirSesion } from "@/lib/panel/servidor";
import { MAX_CAMPO_FICHA } from "@/lib/panel/validar";
import { describirPasos } from "@/lib/flujos/modelo";
import { tituloTipoLinea } from "@/lib/lineas";
import { guardarLinea } from "../acciones";
import { fecha, Marco, SinBase, type Avisos } from "../marco";

export const dynamic = "force-dynamic";

/**
 * Las líneas de WhatsApp: a qué bandeja de Chatwoot está atada cada una, si el asistente responde ahí
 * y cómo. Los flujos se arman en el hub (Comercial → Asistente de WhatsApp): acá se ven en texto.
 */
export default async function Lineas({ searchParams }: { searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const d = datos();
  if (!d) {
    return (
      <Marco nombre={nombre} actual="/panel/lineas" titulo="Líneas" avisos={searchParams}>
        <SinBase />
      </Marco>
    );
  }
  const [lineas, flujos, proyectos] = await Promise.all([d.lineas(), d.flujos(), d.proyectos()]);
  const nombreProyecto = (id: string | null) => (id ? (proyectos.find((p) => p.id === id)?.nombre ?? id) : "General");
  return (
    <Marco nombre={nombre} actual="/panel/lineas" titulo="Líneas" avisos={searchParams}>
      <p className="nota">
        Cada número de WhatsApp es una bandeja de Chatwoot. El asistente de ventas responde solo en las líneas de leads entrantes; si alguien escribe en otra línea, o en una bandeja que no es de ninguna, la conversación pasa al equipo con una nota. Los flujos
        (mensajes con pausas, esperas y caminos, como los bots de Kommo) se arman en el hub.
      </p>
      {lineas.map((l) => {
        const suyos = flujos.filter((f) => f.linea === l.id);
        return (
          <details key={l.id} open={l.tipo === "entrada"}>
            <summary>
              {l.orden}. {l.nombre} <span className="etiqueta">{tituloTipoLinea(l.tipo)}</span>{" "}
              <span className={`etiqueta ${l.pausada ? "error" : l.bandeja ? "activa" : ""}`}>{l.pausada ? "Pausada" : l.bandeja ? `Bandeja ${l.bandeja}` : "Sin conectar"}</span>
              {l.tipo === "entrada" && ` · ${l.conversaciones_7_dias} en 7 días`}
            </summary>
            <form action={guardarLinea}>
              <input type="hidden" name="id" value={l.id} />
              <div className="fila-campos">
                <div>
                  <label htmlFor={`nombre-${l.id}`}>Nombre</label>
                  <input id={`nombre-${l.id}`} name="nombre" type="text" required maxLength={80} defaultValue={l.nombre} />
                </div>
                <div>
                  <label htmlFor={`telefono-${l.id}`}>Número</label>
                  <input id={`telefono-${l.id}`} name="telefono" type="text" maxLength={40} defaultValue={l.telefono} placeholder="+54 9 11 …" />
                </div>
                <div>
                  <label htmlFor={`bandeja-${l.id}`}>Bandeja de Chatwoot</label>
                  <input id={`bandeja-${l.id}`} name="bandeja" type="number" min={1} step={1} defaultValue={l.bandeja ?? ""} />
                </div>
              </div>
              <label htmlFor={`descripcion-${l.id}`}>Para qué es</label>
              <textarea id={`descripcion-${l.id}`} name="descripcion" maxLength={1000} defaultValue={l.descripcion} />
              {l.tipo === "entrada" && (
                <>
                  <label htmlFor={`instrucciones-${l.id}`}>
                    Instrucciones de esta línea <small>Lo que el asistente tiene que saber de esta línea, además del tono (por ejemplo, de qué campaña vienen).</small>
                  </label>
                  <textarea id={`instrucciones-${l.id}`} name="instrucciones" maxLength={MAX_CAMPO_FICHA} defaultValue={l.instrucciones} />
                  <fieldset className="horario">
                    <legend>Proyectos que atiende (ninguno marcado: todos los activos)</legend>
                    <div className="dias">
                      {proyectos.map((p) => (
                        <label key={p.id} className="casilla">
                          <input type="checkbox" name={`proyecto_${p.id}`} defaultChecked={l.proyectos.includes(p.id)} /> {p.nombre}
                          {!p.activo && " (inactivo)"}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="casilla">
                    <input type="checkbox" name="pasar_al_responder" defaultChecked={l.pasar_al_responder} /> Modo «presenta y pasa»: cuando la persona responde a la presentación, la conversación pasa al equipo
                  </label>
                </>
              )}
              {l.tipo !== "entrada" && <input type="hidden" name="instrucciones" value={l.instrucciones} />}
              <label className="casilla">
                <input type="checkbox" name="pausada" defaultChecked={l.pausada} /> Pausada: cada conversación nueva de esta línea pasa al equipo y no salen seguimientos ni flujos
              </label>
              <div className="acciones">
                <button type="submit">Guardar la línea</button>
              </div>
            </form>
            {l.tipo === "entrada" && (
              <>
                <h3>Flujos</h3>
                {suyos.length === 0 ? (
                  <p className="nota">Sin flujos: atiende la IA desde el primer mensaje. Se arman en el hub.</p>
                ) : (
                  suyos.map((f) => (
                    <details key={f.id}>
                      <summary>
                        {f.nombre} <span className={`etiqueta ${f.activo ? "activa" : ""}`}>{f.activo ? "Activo" : "Apagado"}</span> · {nombreProyecto(f.proyecto)} · arrancó con {f.corridas}, respondieron {f.respondieron}, esperan {f.esperando}
                      </summary>
                      <pre className="nota" style={{ whiteSpace: "pre-wrap" }}>
                        {describirPasos(f.pasos).join("\n")}
                      </pre>
                      <p className="nota">
                        Último cambio: {fecha(f.actualizado)}
                        {f.actualizado_por ? ` (${f.actualizado_por})` : ""}
                      </p>
                    </details>
                  ))
                )}
              </>
            )}
          </details>
        );
      })}
    </Marco>
  );
}
