/**
 * El CRM del hub de Mindlin: una planilla de Google con las pestañas «CRM Contactos» y
 * «CRM Actividad». El asistente busca al interesado por teléfono, lo da de alta si no está y
 * anota lo que pasó en la actividad. Nunca cambia lo que cargó una persona: si el contacto ya
 * existe, solo suma actividad.
 *
 * Las columnas son el contrato con el hub (lib/crm/modelo.ts de ese repo): si el hub agrega o
 * mueve una columna, hay que cambiarla acá también.
 */

export const COLUMNAS_CONTACTOS = [
  "ID",
  "Proyectos",
  "Nombre",
  "Teléfono",
  "Mail",
  "Tipo",
  "Origen",
  "Referido por",
  "Etapa",
  "Temperatura (a mano)",
  "Presupuesto USD",
  "Forma de pago",
  "Plazo",
  "Para",
  "Ambientes",
  "Unidades de interés",
  "Próximo paso",
  "Fecha próximo paso",
  "Motivo de pérdida",
  "Volver a contactar",
  "Notas",
  "Responsable",
  "Creado",
  "Actualizado",
  "Entró a la etapa",
  "Último contacto",
  "Unidad vendida",
  "Precio de venta USD",
  "Hora próximo paso",
  "Tags",
] as const;

export const COLUMNAS_ACTIVIDAD = ["Fecha", "Usuario", "Contacto ID", "Contacto", "Tipo", "Detalle", "Etapa"] as const;

export const PESTANIA_CONTACTOS = "CRM Contactos";
export const PESTANIA_ACTIVIDAD = "CRM Actividad";
/** Cómo aparece el asistente en la columna «Usuario» de la actividad. */
export const USUARIO_ASISTENTE = "Asistente WhatsApp";

export const USOS = ["Vivir", "Invertir", "A definir"] as const;

/** Las etapas del CRM del hub desde noviembre de 2026, en orden. */
export const ETAPAS = ["Nuevo", "Contacto inicial", "Seguimiento", "Visita / reunión", "Negociación", "Reserva", "Vendido", "Descartado", "En pausa"] as const;

/** Sin acentos, en minúscula y con un solo espacio: para comparar etapas escritas distinto. */
export const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();

/** Las etapas de antes de noviembre (que pueden seguir en filas viejas), con la de ahora, como las lee el hub. */
const ETAPAS_VIEJAS: Record<string, (typeof ETAPAS)[number]> = {
  contactado: "Contacto inicial",
  interesado: "Seguimiento",
  "propuesta enviada": "Negociación",
  evaluando: "Negociación",
  negociando: "Negociación",
  visita: "Visita / reunión",
  reunion: "Visita / reunión",
  "visita reunion": "Visita / reunión",
  reservado: "Reserva",
  perdido: "Descartado",
  dormido: "En pausa",
  pausa: "En pausa",
};

/** La etapa de ahora para lo que diga la planilla (de ahora o de antes); si no se entiende, «Nuevo», como el hub. */
export function etapaDe(t: string): string {
  const n = normalizar(t);
  return ETAPAS.find((e) => normalizar(e) === n) ?? ETAPAS_VIEJAS[n] ?? "Nuevo";
}
export const FORMAS_DE_PAGO = ["Al costo (cuotas)", "Contado", "A definir"] as const;
export const PLAZOS = ["Menos de 2 meses", "2 a 6 meses", "Más de 6 meses", "A definir"] as const;

export interface ContactoCRM {
  id: string;
  nombre: string;
  telefono: string;
  etapa: string;
  responsable: string;
  proyectos: string[];
  ultimoContacto: string;
  notas: string;
  /** Lo que el equipo (o el asistente, al darlo de alta) ya sabe de lo que busca. */
  para: string;
  ambientes: string;
  presupuestoUsd: string;
  formaDePago: string;
  plazo: string;
  proximoPaso: string;
  fechaProximoPaso: string;
}

export interface DatosInteresado {
  nombre: string;
  telefono: string;
  proyecto: string | null;
  para: string;
  ambientes: string;
  presupuestoUsd: string;
  formaDePago: string;
  plazo: string;
  notas: string;
}

export interface CRM {
  /**
   * El contacto de esta persona: primero por el ID que ya quedó anotado en la conversación y, si
   * no, por teléfono (WhatsApp a veces no pasa el número: sin el ID se crearía un repetido).
   */
  buscar(p: { id?: string | null; telefono?: string | null }): Promise<ContactoCRM | null>;
  /** Todos los contactos (una sola lectura): para saber la etapa de cada conversación en los seguimientos. */
  contactos(): Promise<ContactoCRM[]>;
  crearContacto(d: DatosInteresado, ahora: string): Promise<ContactoCRM>;
  anotarActividad(a: { contacto: ContactoCRM; detalle: string; ahora: string }): Promise<void>;
}

/** Los últimos 10 dígitos: así coinciden «+54 9 11 5555-0000», «5491155550000» y «11 5555 0000». */
export function claveTelefono(t: string): string {
  return t.replace(/\D/g, "").slice(-10);
}

export function nuevoIdContacto(ahoraMs = Date.now(), azar = Math.random()): string {
  return `c${ahoraMs.toString(36)}${azar.toString(36).slice(2, 6)}`;
}

const col = (nombre: (typeof COLUMNAS_CONTACTOS)[number]) => COLUMNAS_CONTACTOS.indexOf(nombre);

export function contactoDeFila(f: string[]): ContactoCRM {
  const v = (n: (typeof COLUMNAS_CONTACTOS)[number]) => (f[col(n)] ?? "").trim();
  return {
    id: v("ID"),
    nombre: v("Nombre"),
    telefono: v("Teléfono"),
    etapa: etapaDe(v("Etapa")),
    responsable: v("Responsable"),
    proyectos: v("Proyectos").split(",").map((p) => p.trim()).filter(Boolean),
    ultimoContacto: v("Último contacto"),
    notas: v("Notas"),
    para: v("Para"),
    ambientes: v("Ambientes"),
    presupuestoUsd: v("Presupuesto USD"),
    formaDePago: v("Forma de pago"),
    plazo: v("Plazo"),
    proximoPaso: v("Próximo paso"),
    fechaProximoPaso: v("Fecha próximo paso"),
  };
}

const enLista = (valor: string, lista: readonly string[]) => (lista.includes(valor) ? valor : "");

export function filaContactoNuevo(d: DatosInteresado, id: string, ahora: string, responsable: string): string[] {
  const fila = COLUMNAS_CONTACTOS.map(() => "");
  const poner = (n: (typeof COLUMNAS_CONTACTOS)[number], valor: string) => (fila[col(n)] = valor);
  poner("ID", id);
  poner("Proyectos", d.proyecto ?? "");
  poner("Nombre", d.nombre || `WhatsApp +${d.telefono}`);
  poner("Teléfono", d.telefono ? `+${d.telefono}` : "");
  poner("Tipo", "Beneficiario al costo");
  poner("Origen", "WhatsApp");
  poner("Etapa", "Nuevo");
  poner("Presupuesto USD", /^\d+$/.test(d.presupuestoUsd) ? d.presupuestoUsd : "");
  poner("Forma de pago", enLista(d.formaDePago, FORMAS_DE_PAGO));
  poner("Plazo", enLista(d.plazo, PLAZOS));
  poner("Para", enLista(d.para, USOS));
  poner("Ambientes", d.ambientes);
  poner("Notas", ["Entró por WhatsApp (asistente).", d.notas].filter(Boolean).join(" "));
  poner("Responsable", responsable);
  poner("Creado", ahora);
  poner("Actualizado", ahora);
  poner("Entró a la etapa", ahora);
  poner("Último contacto", ahora);
  return fila;
}

/** Lo mínimo de Google Sheets que usa el CRM: leer un rango y agregar filas al final. */
export interface Hoja {
  leer(rango: string): Promise<string[][]>;
  agregar(pestania: string, filas: string[][]): Promise<void>;
}

/** La letra de la columna n (1 → A, 27 → AA). */
export function letraColumna(n: number): string {
  let letras = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) letras = String.fromCharCode(65 + ((x - 1) % 26)) + letras;
  return letras;
}

/** Todas las columnas de «CRM Contactos», sin los títulos. */
export const RANGO_CONTACTOS = `'${PESTANIA_CONTACTOS}'!A2:${letraColumna(COLUMNAS_CONTACTOS.length)}`;

export function crearCRM(hoja: Hoja, { responsable = "" }: { responsable?: string } = {}): CRM {
  return {
    async buscar({ id, telefono }) {
      const clave = claveTelefono(telefono ?? "");
      const porId = id?.trim();
      if (!porId && clave.length < 8) return null;
      const filas = (await hoja.leer(RANGO_CONTACTOS)).filter((f) => f[col("ID")]);
      const fila =
        (porId && filas.find((f) => f[col("ID")].trim() === porId)) ||
        (clave.length >= 8 && filas.find((f) => claveTelefono(f[col("Teléfono")] ?? "") === clave)) ||
        null;
      return fila ? contactoDeFila(fila) : null;
    },
    async contactos() {
      const filas = await hoja.leer(RANGO_CONTACTOS);
      return filas.filter((f) => f[col("ID")]).map(contactoDeFila);
    },
    async crearContacto(d, ahora) {
      const fila = filaContactoNuevo(d, nuevoIdContacto(), ahora, responsable);
      await hoja.agregar(PESTANIA_CONTACTOS, [fila]);
      return contactoDeFila(fila);
    },
    async anotarActividad({ contacto, detalle, ahora }) {
      await hoja.agregar(PESTANIA_ACTIVIDAD, [[ahora, USUARIO_ASISTENTE, contacto.id, contacto.nombre, "WhatsApp", detalle.slice(0, 2000), contacto.etapa]]);
    },
  };
}
