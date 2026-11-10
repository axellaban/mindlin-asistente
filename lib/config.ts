/**
 * Las variables de entorno que necesita el asistente, agrupadas por para qué sirven.
 * Los valores se cargan en Vercel (nunca en el repo ni en el chat). Acá solo se mira
 * si están, para que /api/salud diga qué falta sin mostrar ninguna clave.
 */

export interface Variable {
  nombre: string;
  /** Para qué la usa el asistente, en una línea. */
  para: string;
  /** Si alguna de estas está, cuenta como cargada (p. ej. POSTGRES_URL, que también carga la integración de Neon). */
  alternativas?: string[];
}

export interface Grupo {
  nombre: string;
  variables: Variable[];
}

export const GRUPOS: Grupo[] = [
  {
    nombre: "IA",
    variables: [
      {
        nombre: "OPENAI_API_KEY",
        para: "La clave de la IA que arma las respuestas y transcribe los audios. Para usar Claude, ANTHROPIC_API_KEY (ver docs/asistente.md).",
        alternativas: ["ANTHROPIC_API_KEY"],
      },
    ],
  },
  {
    nombre: "Chatwoot",
    variables: [
      { nombre: "CHATWOOT_URL", para: "La dirección de Chatwoot, por ejemplo https://chat.dominio.com." },
      { nombre: "CHATWOOT_ACCOUNT_ID", para: "El número de la cuenta de Mindlin en Chatwoot." },
      { nombre: "CHATWOOT_BOT_TOKEN", para: "El token del Agent Bot: con él contesta y pasa la conversación a una persona." },
      { nombre: "CHATWOOT_WEBHOOK_SECRET", para: "La clave del Agent Bot: con ella se verifica que cada aviso venga de Chatwoot." },
    ],
  },
  {
    nombre: "Base de datos (Neon)",
    variables: [
      { nombre: "DATABASE_URL", para: "La base del asistente: fichas, tono, historial y seguimientos. La carga sola la integración de Neon en Vercel.", alternativas: ["POSTGRES_URL"] },
    ],
  },
  {
    nombre: "CRM del hub",
    variables: [
      { nombre: "GOOGLE_SERVICE_ACCOUNT_EMAIL", para: "La cuenta de servicio propia del asistente (con su propio límite de pedidos a Google)." },
      { nombre: "GOOGLE_PRIVATE_KEY", para: "La clave de esa cuenta de servicio." },
      { nombre: "CRM_SHEET_ID", para: "La planilla donde guarda el CRM del hub (pestañas «CRM Contactos» y «CRM Actividad»)." },
    ],
  },
  {
    nombre: "Tareas programadas",
    variables: [{ nombre: "CRON_SECRET", para: "Que solo el cron de Vercel pueda disparar los seguimientos." }],
  },
  {
    nombre: "Panel",
    variables: [{ nombre: "PANEL_CLAVE", para: "La clave para entrar al panel (fichas, tono, ejemplos, seguimientos). La comparte Axel con el equipo." }],
  },
];

export interface EstadoVariable {
  nombre: string;
  para: string;
  cargada: boolean;
}

export interface EstadoGrupo {
  nombre: string;
  listo: boolean;
  variables: EstadoVariable[];
}

const tieneValor = (env: Record<string, string | undefined>, nombre: string) => Boolean(env[nombre]?.trim());

/** Qué variables están cargadas y cuáles faltan, por grupo. Puro: recibe el entorno. */
export function estadoConfig(env: Record<string, string | undefined>): { listo: boolean; grupos: EstadoGrupo[]; faltan: string[] } {
  const grupos = GRUPOS.map((g) => {
    const variables = g.variables.map((v) => ({
      nombre: v.nombre,
      para: v.para,
      cargada: [v.nombre, ...(v.alternativas ?? [])].some((n) => tieneValor(env, n)),
    }));
    return { nombre: g.nombre, listo: variables.every((v) => v.cargada), variables };
  });
  const faltan = grupos.flatMap((g) => g.variables.filter((v) => !v.cargada).map((v) => v.nombre));
  return { listo: faltan.length === 0, grupos, faltan };
}
