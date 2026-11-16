/**
 * Teléfonos de las bases viejas de Mindlin, al formato de WhatsApp (549 + área + número, sin el 0
 * ni el 15). Las bases vienen escritas de mil maneras: «011 15 1234-5678», «(0221) 15-456-7890»,
 * «+54 9 11 1234 5678», «1512345678»… Lo que no se puede leer con seguridad no se adivina: queda
 * «por revisar» y no entra a la cola (docs/outreach.md, «Prospectos»).
 *
 * Puro.
 */

export type Telefono = { telefono: string; motivo?: undefined } | { telefono: null; motivo: string };

const revisar = (motivo: string): Telefono => ({ telefono: null, motivo });

/**
 * El número argentino de 10 cifras (área + número), quitando el 15 que va después del área.
 * Null si no se puede saber con seguridad dónde termina el área.
 */
function sinQuince(d: string): string | null {
  if (d.length === 10) return d;
  if (d.length !== 12) return null;
  // Las áreas tienen 2 (Buenos Aires: 11), 3 o 4 cifras; el número, sin el 15, completa 10.
  if (d.startsWith("11")) return d.slice(2, 4) === "15" ? d.slice(0, 2) + d.slice(4) : null;
  const posibles = [3, 4].filter((l) => d.slice(l, l + 2) === "15").map((l) => d.slice(0, l) + d.slice(l + 2));
  return posibles.length === 1 ? posibles[0] : null;
}

export function normalizarTelefono(original: string): Telefono {
  const texto = original.trim();
  if (!texto) return revisar("sin teléfono");
  const internacional = /^\s*(\+|00)/.test(texto);
  let d = texto.replace(/\D/g, "");
  if (texto.startsWith("00")) d = d.slice(2);
  if (d.length < 8) return revisar("el número es muy corto");

  let nacional: string | null;
  if (d.startsWith("549")) nacional = sinQuince(d.slice(3));
  else if (d.startsWith("54") && (internacional || d.length >= 12)) nacional = sinQuince(d.slice(2).replace(/^0/, ""));
  else if (internacional) return revisar("no es un número de Argentina");
  else if (d.startsWith("0")) nacional = sinQuince(d.slice(1));
  else if (d.length === 8) return revisar("falta el código de área");
  else if (d.length === 10 && d.startsWith("15")) return revisar("falta el código de área");
  else nacional = sinQuince(d);

  if (!nacional) return revisar("no se puede saber cuál es el código de área");
  if (!/^[1-9]\d{9}$/.test(nacional)) return revisar("no parece un número de Argentina");
  return { telefono: `549${nacional}` };
}

/** El teléfono como lo guarda cualquier otra parte (Chatwoot «+549…», el CRM a mano): solo para comparar. */
export function telefonoParaComparar(t: string | null | undefined): string | null {
  if (!t) return null;
  const n = normalizarTelefono(t);
  return n.telefono;
}

/** «+54 9 11 1234-5678», para mostrar (el área de 3 cifras es una aproximación: solo es para leerlo). */
export function mostrarTelefono(t: string): string {
  if (!/^549\d{10}$/.test(t)) return `+${t}`;
  const area = t.startsWith("54911") ? "11" : t.slice(3, 6);
  const resto = t.slice(3 + area.length);
  return `+54 9 ${area} ${resto.slice(0, -4)}-${resto.slice(-4)}`;
}
