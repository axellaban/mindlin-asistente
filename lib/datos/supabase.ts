import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MensajeHistorial } from "../chatwoot/evento";
import type { Almacen, Conversacion, Ejemplo, Proyecto, Tono } from "./tipos";

/** La base del asistente en Supabase (con la clave de servidor: las tablas no tienen políticas públicas). */
export function almacenSupabase(env: Record<string, string | undefined> = process.env): Almacen | null {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return crearAlmacen(createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } }));
}

function falla(que: string, error: { message: string } | null): void {
  if (error) throw new Error(`Supabase (${que}): ${error.message}`);
}

const COLUMNAS_PROYECTO =
  "id,nombre,palabras_clave,descripcion,ubicacion,etapa_obra,entrega,tipologias,precios,financiacion,disponibilidad,amenities,preguntas_frecuentes,links";

export function crearAlmacen(db: SupabaseClient): Almacen {
  return {
    async guardarMensaje(m) {
      const { error } = await db.from("mensajes").upsert(m, { onConflict: "id", ignoreDuplicates: true });
      falla("guardar mensaje", error);
    },
    async historial(conversacion, limite) {
      const { data, error } = await db
        .from("mensajes")
        .select("id,conversacion,rol,texto,fecha")
        .eq("conversacion", conversacion)
        .order("fecha", { ascending: false })
        .order("id", { ascending: false })
        .limit(limite);
      falla("leer historial", error);
      return ((data ?? []) as MensajeHistorial[]).reverse();
    },
    async reclamarMensaje(mensaje, conversacion) {
      const { error } = await db.from("mensajes_respondidos").insert({ mensaje_id: mensaje, conversacion });
      if (error?.code === "23505") return false;
      falla("reclamar mensaje", error);
      return true;
    },
    async conversacion(id) {
      const { data, error } = await db
        .from("conversaciones")
        .select("chatwoot_id,proyecto,crm_contacto_id,telefono,nombre")
        .eq("chatwoot_id", id)
        .maybeSingle();
      falla("leer conversación", error);
      return (data as Conversacion | null) ?? null;
    },
    async guardarConversacion(c) {
      const { error } = await db.from("conversaciones").upsert({ ...c, actualizada: new Date().toISOString() }, { onConflict: "chatwoot_id" });
      falla("guardar conversación", error);
    },
    async proyectosActivos() {
      const { data, error } = await db.from("proyectos").select(COLUMNAS_PROYECTO).eq("activo", true).order("nombre");
      falla("leer proyectos", error);
      return (data ?? []) as Proyecto[];
    },
    async tono() {
      const { data, error } = await db.from("tono").select("instrucciones,criterios_comerciales,cuando_pasar_a_persona").eq("id", 1).maybeSingle();
      falla("leer tono", error);
      return (data as Tono | null) ?? { instrucciones: "", criterios_comerciales: "", cuando_pasar_a_persona: "" };
    },
    async ejemplos() {
      const { data, error } = await db.from("ejemplos").select("titulo,conversacion").eq("activo", true).order("id");
      falla("leer ejemplos", error);
      return (data ?? []) as Ejemplo[];
    },
    async registrar(r) {
      const { error } = await db.from("registro").insert({ tipo: r.tipo, conversacion: r.conversacion, detalle: r.detalle.slice(0, 4000), datos: r.datos ?? null });
      falla("registrar", error);
    },
  };
}
