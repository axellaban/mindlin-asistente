import Link from "next/link";
import { salir } from "./acciones";

const SECCIONES = [
  ["/panel", "Resumen"],
  ["/panel/conversaciones", "Conversaciones"],
  ["/panel/proyectos", "Fichas"],
  ["/panel/tono", "Tono y ejemplos"],
  ["/panel/seguimientos", "Seguimientos"],
  ["/panel/etapas", "Etapas"],
  ["/panel/probar", "Probar"],
] as const;

export type Avisos = Promise<{ ok?: string; error?: string }>;

/** El marco de cada página del panel: menú, quién entró y el aviso de lo último que se hizo. */
export async function Marco({ nombre, actual, titulo, avisos, children }: { nombre: string; actual: string; titulo: string; avisos?: Avisos; children: React.ReactNode }) {
  const { ok, error } = (await avisos) ?? {};
  return (
    <main className="panel">
      <header className="panel-cabecera">
        <p className="marca">Asistente comercial · Mindlin</p>
        <nav aria-label="Secciones del panel">
          {SECCIONES.map(([ruta, texto]) => (
            <Link key={ruta} href={ruta} aria-current={ruta === actual ? "page" : undefined}>
              {texto}
            </Link>
          ))}
        </nav>
        <form action={salir} className="quien">
          <span>{nombre}</span>
          <button type="submit" className="enlace">
            Salir
          </button>
        </form>
      </header>
      <h1>{titulo}</h1>
      {ok && (
        <p className="aviso ok" role="status">
          {ok}
        </p>
      )}
      {error && (
        <p className="aviso error" role="alert">
          {error}
        </p>
      )}
      {children}
    </main>
  );
}

export function SinBase() {
  return <p className="aviso error">Falta la base de datos (DATABASE_URL) en Vercel: el panel no tiene de dónde leer.</p>;
}

const FECHA = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const fecha = (iso: string | null) => (iso ? FECHA.format(new Date(iso)) : "—");
