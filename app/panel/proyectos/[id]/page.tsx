import Link from "next/link";
import { notFound } from "next/navigation";
import { datos, exigirSesion } from "@/lib/panel/servidor";
import { CAMPOS_FICHA, MAX_CAMPO_FICHA, type FichaEditable } from "@/lib/panel/validar";
import { guardarProyecto } from "../../acciones";
import { Marco, SinBase, type Avisos } from "../../marco";

export const dynamic = "force-dynamic";

const AYUDA: Partial<Record<keyof FichaEditable, string>> = {
  precios: "Tal como se le pueden decir a un interesado. Si está vacío, el asistente no da precios.",
  disponibilidad: "Qué unidades quedan. Conviene actualizarla cuando se vende algo.",
  preguntas_frecuentes: "Pregunta y respuesta, una debajo de la otra.",
  links: "Folleto, planos, ubicación en el mapa: el asistente los puede compartir.",
};

export default async function Ficha({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const { id } = await params;
  const d = datos();
  const nuevo = id === "nuevo";
  const p = d && !nuevo ? await d.proyecto(id) : null;
  if (d && !nuevo && !p) notFound();
  return (
    <Marco nombre={nombre} actual="/panel/proyectos" titulo={nuevo ? "Nuevo proyecto" : `Ficha de ${p?.nombre ?? id}`} avisos={searchParams}>
      <p><Link href="/panel/proyectos">← Todas las fichas</Link></p>
      {!d ? (
        <SinBase />
      ) : (
        <form action={guardarProyecto}>
          {nuevo ? <input type="hidden" name="nuevo" value="1" /> : <input type="hidden" name="id" value={p!.id} />}
          <div className="fila-campos">
            <div>
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" required maxLength={120} defaultValue={p?.nombre} />
            </div>
            {nuevo && (
              <div>
                <label htmlFor="id">
                  Identificador <small>Opcional: se arma solo con el nombre (por ejemplo «lerma-439»).</small>
                </label>
                <input id="id" name="id" type="text" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} />
              </div>
            )}
          </div>
          <label htmlFor="palabras_clave">
            Palabras para reconocerlo <small>Separadas por comas: la calle, el barrio, cómo lo llaman.</small>
          </label>
          <input id="palabras_clave" name="palabras_clave" type="text" defaultValue={p?.palabras_clave.join(", ")} />
          {CAMPOS_FICHA.map(([campo, titulo]) => (
            <div key={campo}>
              <label htmlFor={campo}>
                {titulo} {AYUDA[campo] && <small>{AYUDA[campo]}</small>}
              </label>
              <textarea id={campo} name={campo} maxLength={MAX_CAMPO_FICHA} defaultValue={String(p?.[campo] ?? "")} />
            </div>
          ))}
          <label htmlFor="notas_internas">
            Notas internas <small>Para el equipo: el asistente no las lee.</small>
          </label>
          <textarea id="notas_internas" name="notas_internas" maxLength={MAX_CAMPO_FICHA} defaultValue={p?.notas_internas} />
          <label className="casilla">
            <input type="checkbox" name="activo" defaultChecked={p?.activo ?? true} /> Activo: el asistente lo ofrece
          </label>
          <div className="acciones">
            <button type="submit">Guardar la ficha</button>
          </div>
        </form>
      )}
    </Marco>
  );
}
