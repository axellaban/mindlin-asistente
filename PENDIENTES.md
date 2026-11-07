# Pendientes

Dueños: **Claude** (código), **Panel** (IA con computer use, o Axel: ver `docs/tareas-panel.md`), **Axel**, **Mindlin** (el cliente).
Al terminar una tarea: `[x]`, fecha y lo que el siguiente necesita saber (sin claves).

## Decisiones abiertas

- [ ] ¿En qué cuenta de Vercel va el asistente? La de Mindlin está atada a la cuenta de GitHub suspendida. — Axel
- [ ] El subdominio de Chatwoot (por ejemplo `chat.<dominio de Mindlin>`). — Axel / Mindlin
- [ ] El CRM del hub no tiene «WhatsApp» como origen del contacto. ¿Lo sumamos? Es un cambio en el hub, para cuando vuelva. — Mindlin
- [ ] Cuando la cuenta de GitHub de Mindlin vuelva: transferirles este repo. — Axel

## Fase 0 · Base

- [x] Definir la arquitectura (`docs/arquitectura.md`). — Claude y Axel, 07/11
- [x] Esqueleto de la app: estado de la configuración (`/` y `/api/salud`), control Verificar en GitHub. — Claude, 07/11
- [ ] Revisar DonWeb (`docs/tareas-panel.md` §1). — Panel
- [ ] Proyecto en Vercel y Supabase (§3). — Panel

## Fase 1 · Infraestructura

- [ ] Instalador de WAHA y Chatwoot con HTTPS, más un script que verifique la instalación (`infra/`). Se arma con los datos de DonWeb. — Claude
- [ ] Instalar en el servidor (§2). — Panel
- [ ] Chip de prueba para la línea piloto y escanear el QR. — Axel / Mindlin
- [ ] Configurar Chatwoot: cuenta, bandeja de la línea piloto, Agent Bot y equipo (§5). — Panel (o Claude por la API, con un token cargado en Vercel)

## Fase 2 · El agente (Lerma 439)

- [x] Decidir cuándo responde el bot y cuándo la tomó una persona (`lib/chatwoot/evento.ts`). — Claude, 07/11
- [ ] Confirmar la forma del evento de Chatwoot con un evento real (sobre todo `sender.type` del bot y los mensajes enviados desde el celular). — Claude
- [ ] Webhook del Agent Bot (`/api/chatwoot/webhook`) y respuesta por la API de Chatwoot. — Claude
- [ ] Material de Lerma 439: descripción, tipologías, superficies, precios, disponibilidad, financiación, etapa y preguntas frecuentes. — Mindlin
- [ ] Tono: instrucciones, criterios comerciales y 10 a 20 conversaciones reales de ejemplo (sin datos personales). — Mindlin
- [ ] Fichas y tono en Supabase, y el agente con Claude y sus herramientas. — Claude
- [ ] Audios: transcribir y responder por escrito. — Claude

## Fase 3 · CRM y traspaso a una persona

- [ ] Cuenta de servicio de Google del asistente y planilla del CRM compartida (§4). — Panel
- [ ] Buscar el contacto por teléfono, darlo de alta si no existe y anotar un resumen por conversación en «CRM Actividad». — Claude
- [ ] Pasar a una persona (pendiente → abierta) y avisarle al responsable. — Claude

## Fase 4 · Seguimientos y panel

- [ ] Reglas por etapa y días, con versiones. — Claude
- [ ] Cron cada 15 minutos. — Claude y Panel
- [ ] Panel con login: conversaciones del bot, fichas, tono y reglas. — Claude

## Fase 5 · Piloto

- [ ] Pruebas internas con el equipo. — Todos
- [ ] Consultas reales en la línea de Lerma 439. — Mindlin
