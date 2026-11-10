import { datos, exigirSesion } from "@/lib/panel/servidor";
import { MAX_CAMPO_FICHA } from "@/lib/panel/validar";
import { activarEjemplo, agregarEjemplo, borrarEjemplo, guardarTono } from "../acciones";
import { fecha, Marco, SinBase, type Avisos } from "../marco";

export const dynamic = "force-dynamic";

export default async function Tono({ searchParams }: { searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const d = datos();
  if (!d) {
    return (
      <Marco nombre={nombre} actual="/panel/tono" titulo="Tono y ejemplos" avisos={searchParams}>
        <SinBase />
      </Marco>
    );
  }
  const [t, ejemplos] = await Promise.all([d.tono(), d.ejemplos()]);
  return (
    <Marco nombre={nombre} actual="/panel/tono" titulo="Tono y ejemplos" avisos={searchParams}>
      <p className="nota">
        Cómo habla el asistente. Además de esto, siempre cumple unas reglas fijas: no inventa precios ni condiciones, no mezcla proyectos y dice que es un asistente virtual si se lo preguntan.
        {t.actualizado && ` Último cambio: ${fecha(t.actualizado)}${t.actualizado_por ? ` (${t.actualizado_por})` : ""}.`}
      </p>
      <form action={guardarTono}>
        <label htmlFor="instrucciones">
          Quién es y cómo habla <small>El tono, el trato (vos o usted), el largo de los mensajes.</small>
        </label>
        <textarea id="instrucciones" name="instrucciones" className="alto" required maxLength={MAX_CAMPO_FICHA} defaultValue={t.instrucciones} />
        <label htmlFor="criterios_comerciales">
          Criterios comerciales <small>Qué preguntar primero, qué ofrecer, qué evitar.</small>
        </label>
        <textarea id="criterios_comerciales" name="criterios_comerciales" className="alto" maxLength={MAX_CAMPO_FICHA} defaultValue={t.criterios_comerciales} />
        <label htmlFor="cuando_pasar_a_persona">
          Cuándo pasar la conversación al equipo <small>Por ejemplo: si quiere visitar, reservar o negociar el precio.</small>
        </label>
        <textarea id="cuando_pasar_a_persona" name="cuando_pasar_a_persona" maxLength={MAX_CAMPO_FICHA} defaultValue={t.cuando_pasar_a_persona} />
        <div className="acciones">
          <button type="submit">Guardar el tono</button>
        </div>
      </form>

      <h2>Conversaciones de ejemplo</h2>
      <p className="nota">Charlas reales que salieron bien, para que el asistente copie la forma. Sin nombres, teléfonos ni datos de la persona.</p>
      {ejemplos.map((e) => (
        <details key={e.id}>
          <summary>
            {e.titulo} {!e.activo && <span className="etiqueta">No se usa</span>}
          </summary>
          <p style={{ whiteSpace: "pre-wrap" }}>{e.conversacion}</p>
          <div className="acciones">
            <form action={activarEjemplo}>
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="activo" value={e.activo ? "0" : "1"} />
              <button type="submit" className="secundario">{e.activo ? "Dejar de usarlo" : "Volver a usarlo"}</button>
            </form>
            <form action={borrarEjemplo}>
              <input type="hidden" name="id" value={e.id} />
              <button type="submit" className="enlace">Borrar</button>
            </form>
          </div>
        </details>
      ))}
      <details open={ejemplos.length === 0}>
        <summary>Agregar un ejemplo</summary>
        <form action={agregarEjemplo}>
          <label htmlFor="titulo">Título</label>
          <input id="titulo" name="titulo" type="text" required maxLength={200} placeholder="Consulta por 2 ambientes para invertir" />
          <label htmlFor="conversacion">
            La conversación <small>Una línea por mensaje: «Interesado: …» y «Mindlin: …».</small>
          </label>
          <textarea id="conversacion" name="conversacion" className="alto" required maxLength={20000} />
          <div className="acciones">
            <button type="submit">Agregar</button>
          </div>
        </form>
      </details>
    </Marco>
  );
}
