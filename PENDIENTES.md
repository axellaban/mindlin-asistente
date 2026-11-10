# Pendientes

Dueños:
- **Claude:** el código.
- **Panel:** la IA con computer use, o Axel. Sus tareas están en [`IA_DE_PANELES.md`](IA_DE_PANELES.md) y anota los resultados en [`docs/estado-paneles.md`](docs/estado-paneles.md).
- **Axel.**
- **Mindlin:** el cliente.

Al terminar una tarea: marcarla `[x]`, con la fecha y lo que el siguiente necesita saber (sin claves).

## Lo próximo, en orden

1. **Axel y Panel:** cargar `OPENAI_API_KEY`, `PANEL_CLAVE` y `CRON_SECRET` en Vercel y volver a publicar (tarea 2 de `IA_DE_PANELES.md`).
2. **Axel y Panel:** escanear el QR con el celular de la línea de prueba y probar un mensaje (tarea 5).
3. **Panel:** asignar el Agent Bot a la bandeja y probar de punta a punta con datos inventados (tarea 6): respuesta, un audio, paso a una persona y la fila en el CRM.
4. **Mindlin:** cargar la ficha de Lerma 439 y revisar el tono en `/panel` (ya no hace falta entrar a Neon).
5. **Panel:** actualizar el instalador en el servidor (tarea 8).

## Decisiones abiertas

- [x] Cuenta de Vercel: la de Axel, para el piloto. — Axel, 07/11
- [x] Servidor: Hostinger KVM 1 (1 vCPU, 4 GB, 50 GB) por 24 meses, comprado el 09/11. El instalador se ajusta a 4 GB (swap y menos hilos en Chatwoot). Si queda corto, el KVM 2. — Axel, 07/11
- [x] Subdominio de Chatwoot: `chat.mindlindevelopers.com`, con HTTPS. — Panel, 09/11
- [x] IA: **OpenAI** (Axel, 09/11). El asistente usa la que tenga clave; Claude queda como alternativa (`docs/asistente.md`). — Claude, 10/11
- [x] «WhatsApp» como origen del contacto en el CRM: el hub ya lo tiene. El asistente lo usa desde el 10/11. — Claude, 10/11
- [ ] Correo para Chatwoot (invitaciones a agentes y avisos). Opciones: SMTP de Google Workspace, de DonWeb, de Zoho (los MX de Mindlin están en Zoho) o un servicio como Brevo. — Axel
- [ ] Cuando la cuenta de GitHub de Mindlin vuelva: transferirles este repo. — Axel
- [ ] Los contactos que da de alta el asistente entran en etapa **Nuevo**, y en el hub eso dispara la alarma «nuevo sin contactar en 2 h». ¿Está bien así (que el equipo lo mire enseguida) o tienen que entrar en «Contacto inicial», porque ya les habló el asistente? — Mindlin
- [ ] Seguimientos: ¿qué mensajes, en qué etapas y a los cuántos días? Se cargan en `/panel/seguimientos`; sin reglas no sale ninguno. — Mindlin

## Fase 0 · Base

- [x] Definir la arquitectura (`docs/arquitectura.md`). — Claude y Axel, 07/11
- [x] Esqueleto de la app: estado de la configuración (`/` y `/api/salud`) y control Verificar en GitHub. — Claude, 07/11
- [x] Instrucciones para la IA de paneles (`IA_DE_PANELES.md`). — Claude, 07/11
- [x] Revisar DonWeb (tarea 1): el VPS actual no alcanza. — Panel, 07/11
- [x] Proyecto en Vercel (cuenta de Axel) y base Neon conectada (tarea 2). Supabase no se pudo: plan gratis lleno. — Panel, 07/11
- [x] Pasar el código de Supabase a Neon: almacén en Postgres, migraciones solas en cada publicación y prueba contra un Postgres real en el control Verificar. Migraciones aplicadas en producción el 09/11. — Claude y Panel
- [x] Cuenta de servicio de Google (`mindlin-asistente@mindlin-developers.iam.gserviceaccount.com`) y sus claves en Vercel (tarea 3). — Panel, 07/11
- [x] Planilla del CRM compartida como Editor con la cuenta de servicio y `CRM_SHEET_ID` en Vercel (Production). — Panel, 09/11
- [ ] `OPENAI_API_KEY`, `PANEL_CLAVE` y `CRON_SECRET` en Vercel, volver a publicar y confirmar «migrar: base al día (3 migraciones)» (tarea 2). — Axel y Panel

## Fase 1 · Infraestructura

- [x] Instalador de WAHA y Chatwoot con HTTPS, verificación y respaldo nocturno (`infra/servidor.sh`). Probado entero en Docker local con Chatwoot 4.19.1 y WAHA 2026.10.1. — Claude, 07/11
- [x] Tablas de la base (`db/migraciones/`). Probadas en Postgres 16. — Claude, 07/11
- [x] Instalar en el servidor (tarea 4): Chatwoot por HTTPS, WAHA interno, respaldo nocturno y swap. — Panel, 09/11
- [x] Instalador para 4 GB: swap si falta y menos hilos en Chatwoot con menos de 6 GB (`infra/README.md`). — Claude, 10/11
- [ ] Pasar el instalador nuevo al servidor y correr `actualizar` (tarea 8). — Panel
- [ ] La línea de prueba con el QR (tarea 5). Chatwoot y la integración con WAHA ya están; la sesión pasó a `FAILED` sin vincular: hace falta un QR fresco con el celular. — Panel con Axel
- [ ] Equipo en Chatwoot y app del celular (tarea 7). Depende del correo. — Panel
- [ ] Hostinger: delegar el acceso Admin a la cuenta de Axel y rotar las claves iniciales del servidor. — Axel

## Fase 2 · El agente (Lerma 439)

- [x] Decidir cuándo responde el bot y cuándo la tomó una persona (`lib/chatwoot/evento.ts`). — Claude, 07/11
- [x] Ignorar la conversación «Integración de WhatsApp» que crea WAHA (contacto `whatsapp.integration`). — Claude, 07/11
- [x] Webhook del Agent Bot (`/api/chatwoot/webhook`): verifica la firma, guarda el historial, contesta después de responder y pasa a una persona si algo falla. Probado de punta a punta con un Chatwoot real (`docs/chatwoot.md`). — Claude, 07/11
- [x] El agente con herramientas: contexto (tono, ficha, CRM), registrar al interesado, elegir el proyecto, pasar a una persona, espera de 6 segundos por si siguen escribiendo. — Claude, 07/11
- [x] OpenAI como proveedor (pedido de Axel), con el mismo agente: adaptador a la API Responses, herramientas estrictas, sin guardar nada en OpenAI. Probado con una API simulada; falta con la clave real. — Claude, 10/11
- [x] Audios: se bajan de Chatwoot, se transcriben con OpenAI y responde por escrito. Si no se puede, pide que lo escriban. — Claude, 10/11
- [x] Pantalla para cargar fichas, tono y ejemplos (`/panel`, ver `docs/panel.md`). — Claude, 10/11
- [ ] Conectar el asistente (tarea 6): asignar el Agent Bot a la bandeja cuando la línea y la clave de OpenAI estén. — Panel
- [ ] Material de Lerma 439: descripción, ubicación, tipologías y superficies, precios, disponibilidad, financiación, etapa de obra y entrega, amenities y preguntas frecuentes. Se carga en `/panel/proyectos/lerma-439`. — Mindlin
- [ ] Tono: revisar el borrador en `/panel/tono` y sumar 10 a 20 conversaciones reales de ejemplo, sin datos personales. — Mindlin
- [ ] Probar las respuestas con la IA de verdad (en las pruebas se usó una simulada) y ajustar el tono con el material de Mindlin. Hace falta `OPENAI_API_KEY`. — Claude con Axel
- [ ] Con la línea real, confirmar: que los audios llegan con su dirección en el aviso (para transcribirlos) y que los mensajes del bot no vuelven a entrar como si los hubiera escrito una persona (el webhook ya descarta ese eco, `docs/chatwoot.md`). — Claude y Panel

## Fase 3 · CRM y traspaso a una persona

- [x] Buscar el contacto por teléfono, darlo de alta si no existe y anotar actividad en «CRM Actividad». Si ya existe, solo suma actividad. — Claude, 07/11
- [x] Pasar a una persona (pendiente → abierta) con una nota interna del motivo y el resumen, y anotarlo en el CRM. — Claude, 07/11
- [x] Columnas, etapas y orígenes al día con el hub de noviembre (columna Tags, etapas nuevas, origen WhatsApp). — Claude, 10/11
- [ ] **Antes de que el hub pase su CRM a su base de datos** (cuando le carguen `DATABASE_URL`): pasar el asistente a esa base o a un endpoint del hub. Si no, lo que anota el asistente en la planilla deja de verse en el hub (`docs/arquitectura.md`, sección 5). Avisar a Mati y Tadeo. — Claude con Mindlin
- [ ] Avisarle al responsable del CRM por el hub o por Telegram cuando el bot le pasa una conversación. Necesita el hub (sus avisos al celular). — Claude
- [ ] Probar el CRM con la planilla real (con la línea de prueba). — Claude y Panel

## Fase 4 · Seguimientos y panel

- [x] Reglas por etapa del CRM, paso y días, con versiones y su medición (`docs/seguimientos.md`). — Claude, 10/11
- [x] Cron cada 15 minutos en Vercel (`vercel.json`), de 9 a 20, con tope y protegido con `CRON_SECRET`. — Claude, 10/11
- [x] Panel con clave: conversaciones del bot, fichas, tono, ejemplos y reglas (`docs/panel.md`). — Claude, 10/11
- [ ] Cargar las primeras reglas de seguimiento (ver decisiones abiertas). — Mindlin

## Fase 5 · Piloto

- [ ] Pruebas internas con el equipo. — Todos
- [ ] Consultas reales en la línea de Lerma 439. — Mindlin
