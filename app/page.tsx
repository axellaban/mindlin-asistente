import Link from "next/link";
import { estadoConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Por ahora, el estado de la configuración: qué variables están cargadas en Vercel y cuáles faltan. */
export default function Inicio() {
  const { listo, grupos } = estadoConfig(process.env);
  return (
    <main>
      <h1>Asistente comercial</h1>
      <p className="sub">
        Mindlin Developers · {listo ? "La configuración está completa." : "En construcción: falta cargar algunas variables en Vercel."}
      </p>
      <p>
        <Link href="/panel">Entrar al panel</Link> (fichas, tono, ejemplos, seguimientos y conversaciones).
      </p>
      {grupos.map((g) => (
        <section key={g.nombre}>
          <h2>
            {g.nombre} <span className={g.listo ? "ok" : "falta"}>{g.listo ? "✓" : "· falta"}</span>
          </h2>
          <ul className="variables">
            {g.variables.map((v) => (
              <li key={v.nombre}>
                <span className={v.cargada ? "ok" : "falta"} aria-label={v.cargada ? "Cargada" : "Falta"}>
                  {v.cargada ? "✓" : "✗"}
                </span>
                <code>{v.nombre}</code>
                <small>{v.para}</small>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
