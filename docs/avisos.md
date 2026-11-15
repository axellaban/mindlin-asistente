# Aviso al responsable cuando la conversación pasa al equipo

Pedido de Axel (15/11, mejora 4): cuando el asistente le pasa una conversación al equipo, que le llegue un **aviso en el hub** al responsable del lead. Es el mismo aviso de siempre del hub: la campanita y el celular. Lleva el resumen y el link.

## Cuándo avisa

Cada vez que el asistente pasa una conversación al equipo con una nota:
- la IA decide que hace falta una persona (pidió visita, preguntó algo que no está en la ficha…);
- un flujo llega a «Pasar al equipo», o la persona escribe después de que el flujo terminó;
- el modo «presenta y pasa»;
- el asistente dejó de responder (un contestador automático, alguien que escribe sin parar) o tuvo un error.

No avisa cuando la línea o el asistente están pausados: ahí pasan todas las conversaciones, y el equipo ya sabe que está en pausa.

## A quién

Al **responsable del lead en el CRM**, si es usuario del hub. Si no tiene responsable, o no se lo reconoce, a quienes estén en `ASISTENTE_AVISAR_SIN_RESPONSABLE` del hub (los apodos, separados por comas). Si eso está vacío, no avisa a nadie: el equipo ve la conversación abierta en Chatwoot, como antes.

## Qué dice

- **Título:** «WhatsApp: Ana Prueba necesita al equipo».
- **Texto:** el motivo y el resumen, más la línea.
- **Link:** la ficha del lead en el CRM del hub. Ahí está el chat con lo que pasó por WhatsApp y «Abrir en Chatwoot». Si el lead no está en el CRM, va a Asistente de WhatsApp.

## Cómo se configura

- **En el asistente (Vercel):** `HUB_URL`, la dirección del hub. La clave es `HUB_CLAVE`, la misma que ya usa el hub para hablarle al asistente (en el hub se llama `ASISTENTE_CLAVE`). Sin `HUB_URL`, no avisa. `/api/salud` dice `avisosAlHub: true` cuando está prendido.
- **En el hub (Vercel):** opcional, `ASISTENTE_AVISAR_SIN_RESPONSABLE`.

Si el hub no responde, la conversación igual pasa al equipo y el error queda en el registro del asistente («Aviso al hub: …»). El asistente espera al hub hasta 8 segundos.

## Código

- `lib/hub/aviso.ts`: el pedido al hub (`POST {HUB_URL}/api/asistente/aviso`, con `Authorization: Bearer <HUB_CLAVE>`).
- `lib/agente/charla.ts`, `pasarAPersona`: avisa después de pasar la conversación.
- En el hub: `app/api/asistente/aviso/route.ts` y su doc.
