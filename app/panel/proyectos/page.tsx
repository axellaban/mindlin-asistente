import Link from "next/link";
import { datos, exigirSesion } from "@/lib/panel/servidor";
import { CAMPOS_FICHA } from "@/lib/panel/validar";
import { Marco, SinBase, type Avisos } from "../marco";

export const dynamic = "force-dynamic";

export default async function Proyectos({ searchParams }: { searchParams: Avisos }) {
  const nombre = await exigirSesion();
  const d = datos();
  const proyectos = d ? await d.proyectos() : [];
  return (
    <Marco nombre={nombre} actual="/panel/proyectos" titulo="Fichas de los proyectos" avisos={searchParams}>
      <p className="nota">
        El asistente dice solo lo que está en la ficha: si un dato no está (precio, disponibilidad, plazos), no lo inventa y ofrece que lo contacte el equipo.
      </p>
      {!d ? (
        <SinBase />
      ) : (
        <div className="tabla">
          <table>
            <thead>
              <tr><th>Proyecto</th><th>Estado</th><th>Completa</th></tr>
            </thead>
            <tbody>
              {proyectos.map((p) => {
                const llenos = CAMPOS_FICHA.filter(([c]) => String(p[c] ?? "").trim()).length;
                return (
                  <tr key={p.id}>
                    <td><Link href={`/panel/proyectos/${p.id}`}>{p.nombre}</Link></td>
                    <td><span className={`etiqueta ${p.activo ? "activa" : ""}`}>{p.activo ? "Activo" : "No lo usa el asistente"}</span></td>
                    <td className="num">{llenos} de {CAMPOS_FICHA.length} datos</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="acciones">
        <Link className="boton" href="/panel/proyectos/nuevo">Nuevo proyecto</Link>
      </div>
    </Marco>
  );
}
