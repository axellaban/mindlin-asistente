# Panel

`https://mindlin-asistente.vercel.app/panel`. Para que el equipo cargue lo que el asistente sabe, sin entrar a la base.

## Entrar

- Con la **clave del panel** (`PANEL_CLAVE` en Vercel: la elige y la comparte Axel) y **tu nombre**, que queda anotado en lo que cambies.
- La sesión dura 30 días. Si se cambia la clave en Vercel, se cierran todas.
- Sin `PANEL_CLAVE` cargada, no entra nadie.

## Qué hay

| Sección | Para qué |
| --- | --- |
| **Resumen** | Qué IA está respondiendo, qué variables faltan, lo de los últimos 7 días (personas que escribieron, respuestas, pases al equipo, seguimientos, errores) y lo último que hizo el asistente. |
| **Conversaciones** | Las que pasaron por el asistente, con el historial como chat y lo que hizo en cada una. Link para abrirla en Chatwoot (para responder se entra ahí). |
| **Fichas** | La ficha de cada proyecto: lo único que el asistente puede decir. Lo vacío no lo dice: ofrece que lo contacte el equipo. Se da de alta un proyecto nuevo y se puede apagar (deja de ofrecerlo). Las notas internas no las lee. |
| **Tono y ejemplos** | Cómo habla, los criterios comerciales, cuándo pasa la conversación al equipo, y conversaciones de ejemplo (sin datos de personas). Un ejemplo se puede dejar de usar sin borrarlo. |
| **Seguimientos** | Las reglas (ver [`seguimientos.md`](seguimientos.md)), con cuántos se mandaron y cuántos respondieron por versión. Una regla que ya se mandó no se borra (se perdería la medición): se archiva. |

Todo lo que se guarda lo usa el asistente desde el mensaje siguiente.

## Código

- `lib/panel/sesion.ts` (la cookie firmada) y `lib/panel/validar.ts` (lo que se carga, revisado): puros, con pruebas en `lib/panel/panel.test.ts`.
- `lib/panel/datos.ts`: lo que lee y escribe en la base; pruebas contra Postgres en `lib/panel/datos.test.ts`.
- `app/panel/`: las pantallas (componentes del servidor, sin JavaScript del lado del navegador) y `acciones.ts` (cada acción revisa la sesión antes de tocar nada).
