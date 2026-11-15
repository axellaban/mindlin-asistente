# Revisar respuestas reales

Pedido de Axel (15/11, mejora 7): que Mindlin revise todas las semanas lo que contestó el asistente de verdad, para que mejore con el uso.

## Cómo se usa (en el hub)

En **Comercial → Asistente de WhatsApp → Revisar** aparecen las respuestas del asistente de los **últimos 7 días** que nadie revisó todavía, la más nueva primero. Cada una con:
- lo que venía antes en la charla (hasta 4 mensajes);
- la línea y el proyecto.

De cada una:
- **Buena:** se abre el texto que quedaría como **ejemplo**, ya sin el nombre de la persona («[nombre]») ni sus números largos («[número]»). Se corrige si hace falta y se guarda: el asistente lo usa desde el próximo mensaje, como los demás ejemplos (Inteligencia comercial → Conversaciones de ejemplo). También se puede marcar buena sin guardarla como ejemplo.
- **Mala:** hay que decir **qué corregir**: en el tono, en la ficha, en qué paso del flujo. Queda en la lista «Malas de los últimos 30 días», que miran Mindlin y Claude para ajustar el tono, las fichas o las reglas.

Arriba dice cuántas se revisaron en la semana.

## Cuidados

- **Los ejemplos van a la IA: no llevan datos personales.** El borrador los saca, pero conviene leerlo antes de guardar. Puede quedar algo, como el nombre de un familiar o una dirección.
- Una respuesta se revisa una vez. Si se vuelve a marcar, vale la última.

## Código

- `lib/revisiones.ts`: el borrador del ejemplo, sin datos personales (puro, con pruebas).
- `lib/panel/datos.ts`: `paraRevisar`, `malas`, `revisadas` y `revisar`.
- Migración `202611150013_revisiones.sql`.
- API del hub: `GET /api/hub/revisar` y `POST /api/hub/revisar/{mensaje}` ([`api-hub.md`](api-hub.md)).
