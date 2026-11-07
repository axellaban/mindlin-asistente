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
- [ ] Ignorar la conversación «Integración de WhatsApp» que crea WAHA (contacto `whatsapp.integration`): la vimos en la prueba local. — Claude
- [ ] Webhook del Agent Bot (`/api/chatwoot/webhook`) y respuestas por la API de Chatwoot. — Claude
- [ ] Conectar el asistente (tarea 6). — Panel
- [ ] Material de Lerma 439: descripción, ubicación, tipologías y superficies, precios, disponibilidad, financiación, etapa de obra y entrega, amenities y preguntas frecuentes. — Mindlin
- [ ] Tono: revisar el borrador que dejó la migración y sumar 10 a 20 conversaciones reales de ejemplo, sin datos personales. — Mindlin
- [ ] El agente con Claude: contexto (tono, ficha, CRM) y herramientas (registrar al interesado, pasar a una persona). — Claude
- [ ] Audios: transcribirlos y responder por escrito. — Claude
- [ ] Con la línea real, confirmar que los mensajes que manda el bot no vuelven a entrar como si los hubiera mandado una persona desde el celular. — Claude y Panel

## Fase 3 · CRM y traspaso a una persona

- [ ] Buscar el contacto por teléfono, darlo de alta si no existe y anotar un resumen por conversación en «CRM Actividad». — Claude
- [ ] Pasar a una persona (pendiente → abierta) con una nota interna del motivo, y avisarle al responsable. — Claude

## Fase 4 · Seguimientos y panel

- [ ] Reglas por etapa y días, con versiones. — Claude
- [ ] Cron cada 15 minutos. — Claude y Panel
- [ ] Panel con login: conversaciones del bot, fichas, tono y reglas. — Claude

## Fase 5 · Piloto

- [ ] Pruebas internas con el equipo. — Todos
- [ ] Consultas reales en la línea de Lerma 439. — Mindlin
