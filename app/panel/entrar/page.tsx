import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/panel/servidor";
import { entrar } from "../acciones";
import type { Avisos } from "../marco";

export const dynamic = "force-dynamic";

export default async function Entrar({ searchParams }: { searchParams: Avisos }) {
  if (await sesionActual()) redirect("/panel");
  const { error } = await searchParams;
  return (
    <main className="entrar">
      <h1>Panel del asistente</h1>
      <p className="sub">Mindlin Developers · fichas, tono y seguimientos</p>
      {error && (
        <p className="aviso error" role="alert">
          {error}
        </p>
      )}
      <form action={entrar}>
        <label htmlFor="nombre">
          Tu nombre <small>Queda anotado en lo que cambies.</small>
        </label>
        <input id="nombre" name="nombre" type="text" autoComplete="name" required maxLength={60} />
        <label htmlFor="clave">Clave del panel</label>
        <input id="clave" name="clave" type="password" autoComplete="current-password" required />
        <div className="acciones">
          <button type="submit">Entrar</button>
        </div>
      </form>
    </main>
  );
}
