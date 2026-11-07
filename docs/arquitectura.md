# Arquitectura

Acordada con Axel el 07/11/2026. Si cambia algo, se actualiza acá en el mismo PR.

```
Interesado ──WhatsApp──► WAHA ──► Chatwoot ◄──── Equipo comercial (web y app del celular)
                        (DonWeb)  (DonWeb)
                                     │ Agent Bot: un aviso por cada mensaje
                                     ▼
                         Asistente (Vercel, este repo) ──► Claude
                            │                 │
                        Supabase        CRM del hub (Google Sheets)
              (fichas, tono, reglas,    (contacto, etapa, responsable,
               seguimientos)             resumen de cada conversación)
```

## 1. WhatsApp: WAHA para el piloto

- WAHA conecta un número común de WhatsApp como un dispositivo vinculado. Desde la versión 2026.6 es gratis con todo incluido (varias líneas, audios, la integración con Chatwoot).
- **Riesgo:** no es oficial, y WhatsApp puede bloquear el número. Sube con los envíos masivos o a quien no escribió. Por eso los seguimientos van solo a quien consultó, en horario y con tope.
- **Salida:** la API oficial de Meta (sin riesgo de bloqueo, con plantillas pagas para escribir después de 24 h). Chatwoot la soporta directo: cambiar de una a otra es configuración, no rehacer el asistente.

## 2. Chatwoot: la bandeja central

El equipo necesita responder y ver todas las conversaciones en un solo lugar.

- Todas las líneas juntas, en la web y en la app del celular (iOS y Android).
- Asignar conversaciones, notas internas, etiquetas, el historial de cada contacto. El email se suma después como otra bandeja.
- WAHA le pasa los mensajes con su integración propia (sin código). Lo que alguien mande desde el celular de la línea también aparece.
- **Necesita unos 4 GB de RAM** (Chatwoot con su Postgres y Redis, más WAHA). Si el servidor de DonWeb no da: ampliarlo o usar Chatwoot Cloud (pago por usuario).

## 3. El bot es un Agent Bot de Chatwoot

- Cada conversación nueva entra como **pendiente**: la atiende el bot.
- Cuando el bot necesita a una persona, o alguien del equipo la toma o escribe (desde Chatwoot o desde el celular), pasa a **abierta** y el bot se calla.
- Chatwoot le sigue avisando al bot aunque la conversación esté abierta: el bot mira el estado antes de contestar. Lógica en `lib/chatwoot/evento.ts`.

## 4. El asistente: una app aparte, en Vercel

- Se publica sola: si el bot falla o tiene carga, no afecta al hub. Tampoco depende de la cuenta de GitHub suspendida.
- Mismo stack y convenciones que el hub, para poder sumarlo como módulo más adelante si lo quieren adentro.
- Su panel: conversaciones del bot, fichas de proyecto, tono y ejemplos, reglas de seguimiento.

## 5. CRM: el del hub

El cliente pidió conectarse con «el CRM que vamos construyendo nosotros», que está en el hub (Comercial → CRM) y guarda en Google Sheets.

| Opción | A favor | En contra |
| --- | --- | --- |
| **CRM del hub, como está (elegida)** | Ya existe, el equipo lo usa, Mati y Tadeo lo siguen construyendo | Sheets tiene límite de pedidos por minuto; no sirve para guardar cada mensaje |
| CRM del hub pasado a Postgres | Mismas pantallas, sin límites | Tocar un módulo que cambian todos los días; necesita el repo del hub |
| CRM nuevo en Supabase | A medida | Dos CRM, contra lo que pidió el cliente |
| CRM comercial (Kommo, HubSpot) | WhatsApp y bots incluidos | Pago por usuario, datos afuera, el cliente eligió el suyo |

Cómo se usa:

- Al CRM va solo lo que el equipo mira: el alta del contacto, la etapa, el responsable y un resumen por conversación (pestañas «CRM Contactos» y «CRM Actividad»).
- El asistente usa **su propia cuenta de servicio de Google**, para tener su propio límite de pedidos y no comerle cuota al hub.
- Mientras el hub esté bloqueado, el asistente escribe directo en la planilla, con las mismas columnas que el hub. Cuando vuelva, conviene pasarlo a un endpoint del hub.
- Si el volumen crece, el paso siguiente es pasar el CRM del hub a Postgres.

## 6. Base del asistente: Supabase (creado desde Vercel)

Fichas de cada proyecto, tono y ejemplos, reglas de seguimiento con sus versiones, y el estado de cada seguimiento. Los mensajes quedan en Chatwoot: no se duplican.

## 7. El agente: Claude con herramientas

- Instrucciones de tono y ejemplos, más la ficha del proyecto de la conversación. Si no sabe de qué proyecto se trata, pregunta.
- Herramientas: leer la ficha del proyecto, buscar el contacto en el CRM, registrar al interesado y lo que busca, pasar la conversación a una persona.
- Audios: se transcriben y se responden por escrito.

## 8. Seguimientos

- Reglas del tipo «si queda en tal etapa y pasan tantos días sin respuesta, mandar este mensaje», con versiones para comparar cuál convierte mejor.
- Solo a quien ya escribió, de 9 a 20, con tope de intentos. Frenan si el interesado responde o si una persona tomó la conversación.
- Salen por Chatwoot, así quedan a la vista en la bandeja.
- Corren cada 15 minutos con un cron (Vercel o el servidor de DonWeb, según el plan de Vercel).

## Lo que se reutiliza de otros proyectos de Axel

Se adapta, no se copia a ciegas:

- **Turnia** (`axellaban/turniasalud`): límites por chat contra bucles con otros bots (`src/lib/chat-guard.ts`, `chat-limits.ts`), seguimientos en horario y con tope (`src/lib/followups.ts`), transcripción de audios, el diseño del agente con herramientas, y el trato con WAHA si hace falta hablarle directo (`src/lib/waha.ts`).
- **habita.** (`axellaban/amoblaia`): mensajes de seguimiento por etapa con versiones y la medición de cuál convierte (`docs/FOLLOWUP.md`), y el historial de conversaciones del asistente.
- **Chapa Labs** (`axellaban/chapa-labs`): el panel de prospección, para cuando se sume la línea de outreach (fuera del MVP).

## Fuera del MVP

Línea de outreach, scoring, agenda automática, clasificación de proveedores y postulantes, terrenos, email.
