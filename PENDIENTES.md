# Pendientes

El alcance es el de la **propuesta de Mindlin para la primera versión** (cinco puntos: conversación por WhatsApp con su forma de hablar, contexto por proyecto, conexión con su CRM, seguimientos y que el equipo pueda intervenir). Lo que la propuesta deja para después está al final, en «Fuera de esta versión».

Dueños:
- **Claude:** el código.
- **Panel:** la IA con computer use, o Axel. Sus tareas están en [`IA_DE_PANELES.md`](IA_DE_PANELES.md) y anota los resultados en [`docs/estado-paneles.md`](docs/estado-paneles.md).
- **Axel.**
- **Mindlin:** el cliente.

Al terminar una tarea: marcarla `[x]`, con la fecha y lo que el siguiente necesita saber (sin claves).

## Lo próximo, en orden (para atender consultas reales)

1. **Axel y Panel:** cargar `PANEL_CLAVE` y `CRON_SECRET` en Vercel y volver a publicar (`ANTHROPIC_API_KEY` ya está). Tarea 2 de `IA_DE_PANELES.md`.
2. **Axel y Panel:** escanear el QR con el celular de la línea de prueba y probar un mensaje (tarea 5).
3. **Panel:** asignar el Agent Bot a la bandeja y probar de punta a punta con datos inventados (tarea 6): respuesta, paso a una persona, devolverla al bot y la fila en el CRM.
4. **Mindlin:** cargar la ficha de Lerma 439 y revisar el tono en `/panel`.
5. **Claude con Axel:** probar las respuestas con Claude de verdad y ajustar el tono con el material de Mindlin.
6. **Panel:** actualizar el instalador en el servidor (tarea 8).

## Decisiones abiertas

- [ ] Correo para Chatwoot (invitaciones a agentes y avisos; también hace falta para el email más adelante). Opciones: Zoho (donde están los correos de Mindlin), Google Workspace o un servicio como Brevo. — Axel
- [ ] Los contactos que da de alta el asistente entran en etapa **Nuevo**, y en el hub eso dispara la alarma «nuevo sin contactar en 2 h». ¿Está bien así (que el equipo lo mire enseguida) o tienen que entrar en «Contacto inicial», porque ya les habló el asistente? — Mindlin
- [ ] Seguimientos: qué mensajes, en qué etapas y a los cuántos días. Se cargan en `/panel/seguimientos`; sin reglas no sale ninguno. — Mindlin
- [ ] Audios: cargar `OPENAI_API_KEY` para transcribirlos (Axel: «luego»). Mientras tanto, el bot pide que lo escriban. — Axel
- [ ] Cuando la cuenta de GitHub de Mindlin vuelva: transferirles este repo. — Axel

Decididas: Vercel en la cuenta de Axel (07/11); servidor Hostinger KVM 1 con 4 GB (07/11, comprado el 09/11); Chatwoot en `chat.mindlindevelopers.com` (09/11); responde **Claude** (Axel, 10/11; OpenAI queda como opción); origen «WhatsApp» en el CRM (ya existe en el hub, 10/11).

## 1. Conversación por WhatsApp con la forma de hablar de Mindlin

- [x] Webhook del Agent Bot: verifica la firma, guarda el historial, contesta y pasa a una persona si algo falla. Probado de punta a punta con un Chatwoot real (`docs/chatwoot.md`). — Claude, 07/11
- [x] El agente: tono, criterios comerciales, ejemplos, reglas fijas (no inventa precios ni condiciones, no mezcla proyectos), espera de 6 segundos por si siguen escribiendo. — Claude, 07/11
- [x] Tono y ejemplos editables en el panel (`/panel/tono`). — Claude, 10/11
- [x] Claude como proveedor, con OpenAI como alternativa por variable (`docs/asistente.md`). `ANTHROPIC_API_KEY` cargada. — Claude y Axel, 10/11
- [x] Audios: transcripción lista con OpenAI; sin esa clave, pide que lo escriban. — Claude, 10/11
- [ ] Tono: revisar el borrador y sumar 10 a 20 conversaciones reales de ejemplo, sin datos personales. — Mindlin
- [ ] Probar con Claude de verdad (en las pruebas se usó uno simulado) y ajustar. — Claude con Axel
- [ ] Con la línea real, confirmar que los mensajes del bot no vuelven a entrar como si los hubiera escrito una persona (el webhook ya descarta ese eco). — Claude y Panel

## 2. Contexto separado para cada proyecto

- [x] Una ficha por proyecto; si hay más de uno, la IA pregunta por cuál consulta y nunca mezcla sus datos. Lo vacío no lo dice. — Claude, 07/11
- [x] Cargar y modificar fichas, y dar de alta proyectos, desde el panel (`/panel/proyectos`). — Claude, 10/11
- [ ] Material de Lerma 439: descripción, ubicación, tipologías y superficies, precios, disponibilidad, financiación, etapa de obra y entrega, amenities y preguntas frecuentes. — Mindlin

## 3. Conexión con el CRM de Mindlin

- [x] Busca a la persona por teléfono y consulta etapa, responsable y notas; da de alta al interesado con lo que busca y anota el resumen en la actividad. Nunca cambia lo que cargó una persona. — Claude, 07/11
- [x] Columnas, etapas y orígenes al día con el hub de noviembre. — Claude, 10/11
- [x] Planilla compartida con la cuenta de servicio y `CRM_SHEET_ID` en Vercel. — Panel, 09/11
- [x] El acuerdo de integración: qué lee y escribe hoy, y qué necesitaría del hub cuando su CRM deje la planilla ([`docs/integracion-crm.md`](docs/integracion-crm.md)). — Claude, 10/11
- [ ] Pasarle `docs/integracion-crm.md` a Mindlin y acordarlo. — Axel
- [ ] Probar el CRM con la planilla real (con la línea de prueba). — Claude y Panel

## 4. Seguimientos

- [x] Reglas «si queda en tal etapa y pasan tantos días sin respuesta, mandar este mensaje», con la etapa del CRM. Frenan si la persona responde o si el equipo toma la conversación. De 9 a 20 y con tope (`docs/seguimientos.md`). — Claude, 10/11
- [x] Cargarlas desde el panel (`/panel/seguimientos`), con versiones para comparar mensajes. — Claude, 10/11
- [x] Email previsto: qué haría falta, sin código todavía (`docs/arquitectura.md`, sección 9). — Claude, 10/11
- [ ] `CRON_SECRET` en Vercel (lo próximo, punto 1). — Axel y Panel
- [ ] Cargar las primeras reglas (ver decisiones abiertas). — Mindlin

## 5. Que el equipo pueda intervenir

- [x] Si alguien del equipo escribe (en Chatwoot o desde el celular), la conversación pasa a abierta y el asistente se calla. — Claude, 07/11
- [x] El asistente pasa la conversación sola cuando hace falta una persona, con nota interna y resumen. — Claude, 07/11
- [x] Devolverle una conversación al asistente («Marcar como pendiente» en Chatwoot) y pausar el asistente entero desde el panel. — Claude, 10/11
- [ ] Equipo en Chatwoot y app del celular (tarea 7). Depende del correo. — Panel

## Infraestructura

- [x] Instalador de WAHA y Chatwoot con HTTPS, verificación y respaldo nocturno (`infra/servidor.sh`). — Claude, 07/11
- [x] Instalado en el servidor (tarea 4): Chatwoot por HTTPS, WAHA interno, respaldo nocturno y swap. — Panel, 09/11
- [x] Proyecto en Vercel, base Neon con migraciones solas, cuenta de servicio de Google. — Panel y Claude, 07/11 a 09/11
- [x] Instalador para 4 GB: swap si falta y menos hilos en Chatwoot. — Claude, 10/11
- [x] Panel con clave (`/panel`, `docs/panel.md`). — Claude, 10/11
- [ ] `PANEL_CLAVE` en Vercel (lo próximo, punto 1). — Axel y Panel
- [ ] Pasar el instalador nuevo al servidor y correr `actualizar` (tarea 8). — Panel
- [ ] La línea de prueba con el QR (tarea 5): la sesión de WAHA pasó a `FAILED` sin vincular; hace falta un QR fresco con el celular. — Panel con Axel
- [ ] Hostinger: delegar el acceso Admin a la cuenta de Axel y rotar las claves iniciales del servidor. — Axel

## Piloto

- [ ] Pruebas internas con el equipo. — Todos
- [ ] Consultas reales en la línea de Lerma 439. — Mindlin

## Fuera de esta versión

Lo deja la propuesta para después (lo construye Mindlin o se presupuesta aparte): scoring, afinar etapas, mensajes y reglas comerciales, agenda automática, clasificación de proveedores y postulantes, terrenos, email (previsto), avisos al responsable por el hub y la conexión del hub con Chatwoot.
