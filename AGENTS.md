# Asistente comercial de IA · Mindlin Developers

Instrucciones para cualquier IA o persona que trabaje en este repo (Claude, Codex u otra). `CLAUDE.md` importa este archivo: las reglas están solo acá.

## Qué es

El agente de IA que atiende las consultas comerciales de los desarrollos de Mindlin Developers por WhatsApp, con su tono, sin mezclar los datos de un proyecto con otro y conectado al CRM del hub. El equipo ve y responde todo desde Chatwoot. Piloto: **Lerma 439**, con una línea de prueba.

Antes de trabajar, leé en este orden:

1. [`PENDIENTES.md`](PENDIENTES.md): qué falta, quién lo hace y las decisiones abiertas. **Empezá por acá.**
2. [`docs/arquitectura.md`](docs/arquitectura.md): qué pieza hace qué y por qué se eligió así.
3. [`IA_DE_PANELES.md`](IA_DE_PANELES.md): lo que se hace entrando a paneles (DonWeb, Vercel, Supabase, Google, Chatwoot). Lo hace la IA con computer use, que anota lo que averigua en [`docs/estado-paneles.md`](docs/estado-paneles.md).

## Cómo trabajamos entre varias IAs

- **Cada tarea tiene dueño en `PENDIENTES.md`.** Tomá solo las tuyas. Al terminar, marcala hecha y anotá lo que el siguiente necesita saber (sin claves).
- **La IA de paneles solo edita `docs/estado-paneles.md`.** Claude lo lee y actualiza `PENDIENTES.md`. Así no se pisan.
- **Nadie sube directo a `main`.** Cada uno trabaja en su rama (`claude/…`, `codex/…`, `panel/…`) y abre un PR. Se mergea con el control **Verificar** en verde.
- **Antes de abrir un PR:** `npm run verificar` (tipos, pruebas y armado de la app).
- **Si cambia una decisión**, se actualiza `docs/arquitectura.md` en el mismo PR.
- Cada módulo nuevo lleva su explicación en `docs/`.

## Reglas que no cambian

- **Claves y contraseñas, solo en Vercel o en el servidor.** Nunca en el repo, en el chat ni en un PR. En `.env.example` van solo los nombres.
- **Nada de datos reales de interesados ni de conversaciones en el repo ni en las pruebas.** Las pruebas usan datos inventados.
- **El agente no inventa** precios, disponibilidad, plazos ni condiciones: si no está en la ficha del proyecto, lo dice y ofrece que lo contacte una persona.
- **No copiar código del hub de Mindlin a este repo.** Su cuenta de GitHub está suspendida y no hay que volver a subir su contenido desde otra cuenta. Lo que haga falta del hub (por ejemplo, las columnas del CRM) se reescribe acá.
- **WhatsApp por WAHA es no oficial.** Nada de envíos masivos ni a quien no escribió: los seguimientos van solo a quien ya consultó, de 9 a 20 y con tope de intentos.
- Textos de la app y de los documentos en castellano rioplatense, claros y sin jerga: lo usan Mati, Tadeo y el equipo comercial, que no son técnicos.

## Stack

Next.js (App Router) en Vercel, TypeScript, Vitest. Supabase (creado desde Vercel) para la base del asistente. Claude (Anthropic) para las respuestas.

Esta versión de Next.js puede diferir de lo que conocés: ante la duda, leé la guía en `node_modules/next/dist/docs/` antes de escribir código.
