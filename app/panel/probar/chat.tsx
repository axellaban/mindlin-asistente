"use client";

import { useRef, useState, useTransition } from "react";
import { estadoInicial, MAX_LARGO_PRUEBA, MAX_MENSAJES_PRUEBA, type EstadoPrueba } from "@/lib/agente/prueba-comun";
import { probarMensaje } from "../acciones";
import { TextoWhatsApp } from "../texto-whatsapp";

type Linea = { rol: "interesado" | "bot"; texto: string } | { rol: "accion"; texto: string };

/** La charla de prueba: vive en el navegador (se pierde al recargar) y nada sale por WhatsApp. */
export function ChatDePrueba({ proyectos, inicial = null }: { proyectos: { id: string; nombre: string }[]; inicial?: string | null }) {
  const [estado, setEstado] = useState<EstadoPrueba>(estadoInicial(inicial));
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [pensando, empezar] = useTransition();
  const campo = useRef<HTMLTextAreaElement>(null);

  function mandar() {
    const t = texto.trim();
    if (!t || pensando) return;
    setError("");
    setTexto("");
    setLineas((l) => [...l, { rol: "interesado", texto: t }]);
    empezar(async () => {
      const r = await probarMensaje(estado, t);
      if (!r.ok) {
        setError(r.error);
        setLineas((l) => l.slice(0, -1));
        setTexto(t);
        return;
      }
      const { estado: nuevo, acciones } = r.respuesta;
      const ultimo = nuevo.mensajes.at(-1);
      setLineas((l) => [...l, ...(ultimo?.rol === "bot" ? [ultimo] : []), ...acciones.map((a) => ({ rol: "accion" as const, texto: a }))]);
      setEstado(nuevo);
      campo.current?.focus();
    });
  }

  function reiniciar(proyecto: string | null = null) {
    setEstado(estadoInicial(proyecto));
    setLineas([]);
    setError("");
    setTexto("");
  }

  const lleno = estado.mensajes.length >= MAX_MENSAJES_PRUEBA - 1;
  return (
    <>
      <div className="fila-campos">
        {proyectos.length > 1 && (
          <div>
            <label htmlFor="proyecto-prueba">Proyecto</label>
            <select id="proyecto-prueba" value={estado.proyecto ?? ""} onChange={(e) => reiniciar(e.target.value || null)} disabled={pensando}>
              <option value="">Que lo averigüe el asistente</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="acciones abajo">
          <button type="button" className="secundario" onClick={() => reiniciar(estado.proyecto)} disabled={pensando || !lineas.length}>
            Empezar de nuevo
          </button>
        </div>
      </div>

      <div className="chat" aria-live="polite">
        {lineas.length === 0 && <p className="nota">Escribí como si fueras un interesado, por ejemplo: «Hola, vi el aviso de Lerma, ¿qué tienen de 2 ambientes?».</p>}
        {lineas.map((l, i) =>
          l.rol === "accion" ? (
            <p key={i} className="accion-prueba">
              {l.texto}
            </p>
          ) : (
            <div key={i} className={`burbuja ${l.rol === "bot" ? "nuestra" : ""}`}>
              <TextoWhatsApp texto={l.texto} />
              <small>{l.rol === "bot" ? "Asistente" : "Vos (como interesado)"}</small>
            </div>
          ),
        )}
        {pensando && <p className="nota">El asistente está escribiendo…</p>}
      </div>

      {error && (
        <p className="aviso error" role="alert">
          {error}
        </p>
      )}
      {estado.pasada && <p className="aviso ok">En una conversación real, acá el asistente ya la habría pasado al equipo y dejaría de responder. Podés seguir probando igual.</p>}
      {lleno ? (
        <p className="nota">La prueba llegó al largo máximo. Empezá de nuevo para seguir.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mandar();
          }}
        >
          <label htmlFor="mensaje-prueba">Tu mensaje</label>
          <textarea
            id="mensaje-prueba"
            ref={campo}
            value={texto}
            maxLength={MAX_LARGO_PRUEBA}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                mandar();
              }
            }}
            disabled={pensando}
            rows={3}
          />
          <div className="acciones">
            <button type="submit" disabled={pensando || !texto.trim()}>
              {pensando ? "Esperando respuesta…" : "Mandar"}
            </button>
            <span className="nota">Enter manda; Shift + Enter, otra línea.</span>
          </div>
        </form>
      )}
    </>
  );
}
