# Pendientes

Dueños:
- **Claude:** el código.
- **Panel:** la IA con computer use, o Axel. Sus tareas están en [`IA_DE_PANELES.md`](IA_DE_PANELES.md) y anota los resultados en [`docs/estado-paneles.md`](docs/estado-paneles.md).
- **Axel.**
- **Mindlin:** el cliente.

Al terminar una tarea: marcarla `[x]`, con la fecha y lo que el siguiente necesita saber (sin claves).

## Decisiones abiertas

- [ ] ¿En qué cuenta de Vercel va el asistente? La de Mindlin está atada a la cuenta de GitHub suspendida. — Axel
- [ ] El subdominio de Chatwoot (por ejemplo `chat.<dominio de Mindlin>`). — Axel / Mindlin
- [ ] Correo para Chatwoot (invitaciones a agentes y avisos). Opciones: SMTP de Google Workspace, de DonWeb o un servicio como Brevo. — Axel
- [ ] El CRM del hub no tiene «WhatsApp» como origen del contacto. ¿Lo sumamos? Es un cambio en el hub, para cuando vuelva. — Mindlin
- [ ] Cuando la cuenta de GitHub de Mindlin vuelva: transferirles este repo. — Axel

## Fase 0 · Base

- [x] Definir la arquitectura (`docs/arquitectura.md`). — Claude y Axel, 07/11
- [x] Esqueleto de la app: estado de la configuración (`/` y `/api/salud`) y control Verificar en GitHub. — Claude, 07/11
- [x] Instrucciones para la IA de paneles (`IA_DE_PANELES.md`). — Claude, 07/11
- [ ] Revisar DonWeb (tarea 1). — Panel
- [ ] Proyecto en Vercel, Supabase y tablas (tarea 2). — Panel
- [ ] Cuenta de servicio de Google y planilla del CRM compartida (tarea 3). — Panel

## Fase 1 · Infraestructura

- [x] Instalador de WAHA y Chatwoot con HTTPS, verificación y respaldo nocturno (`infra/servidor.sh`). Probado entero en Docker local con Chatwoot 4.19.1 y WAHA 2026.10.1. — Claude, 07/11
- [x] Tablas de Supabase (`supabase/migrations/202611070001_base.sql`). Probadas dos veces en un Postgres 16. — Claude, 07/11
- [ ] Instalar en el servidor (tarea 4). — Panel
- [ ] Chatwoot y la línea de prueba con el QR (tarea 5). — Panel con Axel
- [ ] Equipo en Chatwoot y app del celular (tarea 7). — Panel

## Fase 2 · El agente (Lerma 439)

- [x] Decidir cuándo responde el bot y cuándo la tomó una persona (`lib/chatwoot/evento.ts`). — Claude, 07/11
- [x] Ignorar la conversación «Integración de WhatsApp» que crea WAHA (contacto `whatsapp.integration`). — Claude, 07/11
- [x] Webhook del Agent Bot (`/api/chatwoot/webhook`): verifica la firma, guarda el historial, contesta después de responder y pasa a una persona si algo falla. Probado de punta a punta con un Chatwoot real (`docs/chatwoot.md`). — Claude, 07/11
- [x] El agente con Claude: contexto (tono, ficha, CRM), herramientas (registrar al interesado, elegir el proyecto, pasar a una persona), espera de 6 segundos por si siguen escribiendo. — Claude, 07/11
- [ ] Aplicar `supabase/migrations/202611070002_mensajes.sql` (historial de mensajes) junto con la primera (tarea 2). — Panel
- [ ] Conectar el asistente (tarea 6). — Panel
- [ ] Material de Lerma 439: descripción, ubicación, tipologías y superficies, precios, disponibilidad, financiación, etapa de obra y entrega, amenities y preguntas frecuentes. — Mindlin
- [ ] Tono: revisar el borrador que dejó la migración y sumar 10 a 20 conversaciones reales de ejemplo, sin datos personales. — Mindlin
- [ ] Probar las respuestas con Claude de verdad (en las pruebas se usó uno simulado) y ajustar el tono con el material de Mindlin. Hace falta `ANTHROPIC_API_KEY`. — Claude con Axel
- [ ] Audios: transcribirlos y responder por escrito. Hoy el bot pide que lo escriban. Antes, confirmar con la línea real cómo llegan los adjuntos. — Claude
- [ ] Con la línea real, confirmar que los mensajes que manda el bot no vuelven a entrar como si los hubiera escrito una persona desde el celular. Por las dudas, el webhook ya descarta ese eco (`docs/chatwoot.md`). — Claude y Panel
- [ ] Pantalla para cargar fichas, tono y ejemplos. Mientras no esté, se cargan en Supabase → Table Editor (tablas `proyectos`, `tono` y `ejemplos`). — Claude

## Fase 3 · CRM y traspaso a una persona

- [x] Buscar el contacto por teléfono, darlo de alta si no existe y anotar actividad en «CRM Actividad». Si ya existe, solo suma actividad. — Claude, 07/11
- [x] Pasar a una persona (pendiente → abierta) con una nota interna del motivo y el resumen, y anotarlo en el CRM. — Claude, 07/11
- [ ] Avisarle al responsable del CRM por el hub o por Telegram cuando el bot le pasa una conversación. Necesita el hub. — Claude
- [ ] Probar el CRM con la planilla real (tarea 3). — Claude

## Fase 4 · Seguimientos y panel

- [ ] Reglas por etapa y días, con versiones. — Claude
- [ ] Cron cada 15 minutos. — Claude y Panel
- [ ] Panel con login: conversaciones del bot, fichas, tono y reglas. — Claude

## Fase 5 · Piloto

- [ ] Pruebas internas con el equipo. — Todos
- [ ] Consultas reales en la línea de Lerma 439. — Mindlin
