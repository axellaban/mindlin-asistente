"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { datos, exigirSesion } from "@/lib/panel/servidor";
import { claveCorrecta, COOKIE_SESION, crearToken, DURACION_SESION_MS, limpiarNombre } from "@/lib/panel/sesion";
import { ESTADOS_REGLA, validarEjemplo, validarProyecto, validarRegla, validarTono } from "@/lib/panel/validar";
import type { ReglaSeguimiento } from "@/lib/datos/tipos";

/** Vuelve a la página con un aviso arriba (?ok=… o ?error=…). */
const volver = (ruta: string, aviso: { ok?: string; error?: string }): never => {
  const q = new URLSearchParams(Object.entries(aviso).filter(([, v]) => v) as [string, string][]);
  redirect(`${ruta}?${q}`);
};

function base(ruta: string) {
  const d = datos();
  if (!d) volver(ruta, { error: "Falta la base de datos (DATABASE_URL) en Vercel." });
  return d!;
}

export async function entrar(f: FormData) {
  const clave = process.env.PANEL_CLAVE;
  if (!clave?.trim()) volver("/panel/entrar", { error: "Todavía no hay clave del panel: Axel tiene que cargar PANEL_CLAVE en Vercel." });
  const nombre = limpiarNombre(String(f.get("nombre") ?? ""));
  if (!nombre) volver("/panel/entrar", { error: "Escribí tu nombre: queda anotado en lo que cambies." });
  if (!claveCorrecta(String(f.get("clave") ?? ""), clave)) {
    // Un segundo de espera: así no se puede probar claves de a muchas.
    await new Promise((r) => setTimeout(r, 1000));
    volver("/panel/entrar", { error: "La clave no es correcta." });
  }
  (await cookies()).set(COOKIE_SESION, crearToken(nombre, clave!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/panel",
    maxAge: DURACION_SESION_MS / 1000,
  });
  redirect("/panel");
}

export async function salir() {
  (await cookies()).delete({ name: COOKIE_SESION, path: "/panel" });
  redirect("/panel/entrar");
}

export async function pausarAsistente(f: FormData) {
  const por = await exigirSesion();
  const pausar = f.get("pausar") === "1";
  await base("/panel").pausar(pausar, por);
  volver("/panel", {
    ok: pausar
      ? "Asistente pausado: cada conversación nueva pasa al equipo y no salen seguimientos."
      : "Asistente reactivado: vuelve a responder las conversaciones pendientes.",
  });
}

export async function guardarProyecto(f: FormData) {
  const por = await exigirSesion();
  const nuevo = f.get("nuevo") === "1";
  const ruta = nuevo ? "/panel/proyectos/nuevo" : `/panel/proyectos/${String(f.get("id") ?? "")}`;
  const r = validarProyecto(f);
  if (!r.ok) return volver(ruta, { error: r.error });
  const d = base(ruta);
  if (nuevo && (await d.proyecto(r.valor.id))) return volver(ruta, { error: `Ya hay un proyecto con el identificador «${r.valor.id}».` });
  await d.guardarProyecto(r.valor, por);
  volver(`/panel/proyectos/${r.valor.id}`, { ok: "Ficha guardada. El asistente la usa desde el próximo mensaje." });
}

export async function guardarTono(f: FormData) {
  const por = await exigirSesion();
  const r = validarTono(f);
  if (!r.ok) return volver("/panel/tono", { error: r.error });
  await base("/panel/tono").guardarTono(r.valor, por);
  volver("/panel/tono", { ok: "Tono guardado." });
}

export async function agregarEjemplo(f: FormData) {
  await exigirSesion();
  const r = validarEjemplo(f);
  if (!r.ok) return volver("/panel/tono", { error: r.error });
  await base("/panel/tono").agregarEjemplo(r.valor);
  volver("/panel/tono", { ok: "Ejemplo agregado." });
}

const idDe = (f: FormData) => {
  const id = Number(f.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function activarEjemplo(f: FormData) {
  await exigirSesion();
  const id = idDe(f);
  if (id) await base("/panel/tono").activarEjemplo(id, f.get("activo") === "1");
  volver("/panel/tono", { ok: f.get("activo") === "1" ? "El asistente vuelve a usar ese ejemplo." : "El asistente deja de usar ese ejemplo." });
}

export async function borrarEjemplo(f: FormData) {
  await exigirSesion();
  const id = idDe(f);
  if (id) await base("/panel/tono").borrarEjemplo(id);
  volver("/panel/tono", { ok: "Ejemplo borrado." });
}

export async function agregarRegla(f: FormData) {
  await exigirSesion();
  const d = base("/panel/seguimientos");
  const r = validarRegla(
    f,
    (await d.proyectos()).map((p) => p.id),
  );
  if (!r.ok) return volver("/panel/seguimientos", { error: r.error });
  await d.agregarRegla(r.valor);
  volver("/panel/seguimientos", { ok: "Regla agregada." });
}

export async function cambiarEstadoRegla(f: FormData) {
  await exigirSesion();
  const id = idDe(f);
  const estado = String(f.get("estado") ?? "");
  if (!id || !(ESTADOS_REGLA as readonly string[]).includes(estado)) return volver("/panel/seguimientos", { error: "No se entendió el cambio." });
  await base("/panel/seguimientos").cambiarEstadoRegla(id, estado as ReglaSeguimiento["estado"]);
  volver("/panel/seguimientos", { ok: "Regla actualizada." });
}

export async function borrarRegla(f: FormData) {
  await exigirSesion();
  const id = idDe(f);
  if (!id) return volver("/panel/seguimientos", { error: "No se entendió qué borrar." });
  const borrada = await base("/panel/seguimientos").borrarRegla(id);
  volver("/panel/seguimientos", borrada ? { ok: "Regla borrada." } : { error: "Esa regla ya se mandó: no se borra (se perdería la medición). Archivala." });
}
