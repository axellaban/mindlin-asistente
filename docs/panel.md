# Panel

`https://mindlin-asistente.vercel.app/panel`. Para que el equipo cargue lo que el asistente sabe, sin entrar a la base.

## Entrar

- Con la **clave del panel** (`PANEL_CLAVE` en Vercel: la elige y la comparte Axel) y **tu nombre**, que queda anotado en lo que cambies.
- La sesión dura 30 días. Si se cambia la clave en Vercel, se cierran todas.
- Sin `PANEL_CLAVE` cargada, no entra nadie.

## Qué hay

| Sección | Para qué |
| --- | --- |
| **Resumen** | **Lo que falta para que atienda bien** (variables, tono, los datos clave de cada ficha —precios, disponibilidad, financiación, tipologías, ubicación— y reglas de seguimiento), con el link para resolver cada cosa. Qué IA está respondiendo, pausar o reactivar, lo de los últimos 7 días (personas que escribieron, respuestas, pases al equipo, seguimientos, errores) y lo último que hizo el asistente. |
| **Conversaciones** | Las que pasaron por el asistente y quién atiende cada una. En cada conversación: el historial como chat (con el formato de WhatsApp), quién la atiende, el proyecto, lo que anotó el asistente y su último resumen, el contacto del CRM, los seguimientos y lo que hizo. Link para abrirla en Chatwoot (para responder se entra ahí). |
| **Fichas** | La ficha de cada proyecto: lo único que el asistente puede decir. Arriba va la **Presentación**: lo primero que cuenta cuando alguien pregunta por ese proyecto. Lo vacío no lo dice: ofrece que lo contacte el equipo. Se da de alta un proyecto nuevo y se puede apagar (deja de ofrecerlo). Las notas internas no las lee. |
| **Tono y ejemplos** | Cómo habla, los criterios comerciales, cuándo pasa la conversación al equipo, lo que sabe de la empresa, cómo responder objeciones y a cada perfil, el modo **«presenta y pasa»** (como los bots de Kommo: cuando la persona responde, sigue el equipo), el **horario del equipo comercial** (días y horas; fuera de ese horario, si pasa la conversación, avisa que le escriben apenas vuelvan) y conversaciones de ejemplo (sin datos de personas). Un ejemplo se puede dejar de usar sin borrarlo. |
| **Seguimientos** | Las reglas (ver [`seguimientos.md`](seguimientos.md)), con cómo le llega el mensaje a una persona, cuántos se mandaron y cuántos respondieron por versión. Una regla que ya se mandó no se borra (se perdería la medición): se archiva. |
| **Etapas** | Etapas automáticas: a qué etapa del CRM mueve el asistente al lead cuando pasa cada cosa (respondió, no respondió a los seguimientos, quiere visita, no le interesa…), con cuántos movió en los últimos 30 días. Ver [`integracion-crm.md`](integracion-crm.md). |
| **Probar** | Chatear con el asistente como si fueras un interesado: mismo tono, fichas, ejemplos e IA que en WhatsApp, pero **no sale nada por WhatsApp ni se escribe en el CRM**. Debajo de cada respuesta muestra lo que haría (anotar en el CRM, elegir un proyecto, pasar al equipo). Desde cada ficha hay un link para probar con ese proyecto ya elegido. La charla vive en el navegador: se pierde al recargar. Cada mensaje usa la IA de verdad (tiene costo). |

| **Conexiones** | **Probar las conexiones de verdad**, no solo que las variables existan: que Chatwoot acepte el token del Agent Bot (y que la cuenta sea la correcta), la base, la planilla del CRM con sus columnas, y la IA (con un pedido chico). Muestra también lo último que pasó: el último WhatsApp que llegó, la última respuesta y si hubo un error después, si el asistente está pausado y si hay seguimientos en uso. No manda nada a nadie; solo corre al tocar el botón. Es lo primero que conviene mirar si no contesta por WhatsApp. |

Todo lo que se guarda lo usa el asistente desde el mensaje siguiente.

Lo mismo se configura desde el hub de Mindlin: HQ → Comercial → Asistente de WhatsApp, que usa la API ([`api-hub.md`](api-hub.md)).

## Código

- `lib/panel/sesion.ts` (la cookie firmada) y `lib/panel/validar.ts` (lo que se carga, revisado): puros, con pruebas en `lib/panel/panel.test.ts`.
- `lib/panel/datos.ts`: lo que lee y escribe en la base; pruebas contra Postgres en `lib/panel/datos.test.ts`.
- `lib/panel/listo.ts`: lo que falta para salir (puro, con pruebas).
- `lib/agente/prueba.ts`: «Probar», con herramientas que no escriben nada (pruebas en `prueba.test.ts`). Lo que manda el navegador se revisa antes de usarlo.
- `lib/chequeo.ts`: «Conexiones» (puro, con pruebas en `lib/chequeo.test.ts`). Para probar el token de Chatwoot pide cambiar el estado de la conversación 0, que no existe: Chatwoot revisa el token y la cuenta antes de buscar la conversación, así que «esa conversación no existe» quiere decir que el token y la cuenta andan. No cambia nada.
- `app/panel/`: las pantallas (componentes del servidor; el único con JavaScript en el navegador es el chat de «Probar») y `acciones.ts` (cada acción revisa la sesión antes de tocar nada).
