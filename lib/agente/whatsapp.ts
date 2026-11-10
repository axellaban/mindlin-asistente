/**
 * El texto de la IA, listo para WhatsApp. Puro.
 *
 * Los modelos escriben en Markdown por costumbre (**negrita**, # títulos, [texto](link)), y en
 * WhatsApp eso se ve con los asteriscos y los numerales a la vista. Acá se pasa al formato de
 * WhatsApp (*negrita*, _cursiva_) y se sacan las marcas que no existen ahí.
 */

export function paraWhatsApp(texto: string): string {
  return (
    texto
      // A veces copia la marca con la que ve los mensajes del equipo en el historial.
      .replace(/^\s*\[(Equipo|Mindlin|Asistente)\]\s*/i, "")
      // **negrita** y __negrita__ → *negrita*
      .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, "*$1*")
      .replace(/__(?=\S)([^_\n]+?)__/g, "*$1*")
      // # Título → *Título*
      .replace(/^[ \t]*#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, "*$1*")
      // [texto](https://…) → texto: https://…  (o solo el link si son iguales)
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t: string, url: string) => (t.trim() === url ? url : `${t.trim()}: ${url}`))
      // «* item» al principio de una línea es una viñeta, no negrita.
      .replace(/^([ \t]*)\*[ \t]+/gm, "$1- ")
      // Líneas separadoras (---) y líneas en blanco de más.
      .replace(/^[ \t]*(-{3,}|_{3,}|\*{3,})[ \t]*$/gm, "")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
