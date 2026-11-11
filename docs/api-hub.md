# API para el hub

Todo lo que se configura del asistente (fichas, tono y criterios comerciales, lo que sabe de la empresa, objeciones, ejemplos, reglas de seguimiento, etapas automáticas, pausa) se puede **leer y cambiar desde el hub de Mindlin**. El hub arma sus pantallas y habla con esta API; el asistente usa los cambios desde el mensaje siguiente.

Es la misma configuración que muestra el panel del asistente (`/panel`): no hay dos copias. Lo que se cambia en un lado se ve en el otro.

## Cómo se conecta

- **Dirección:** `https://mindlin-asistente.vercel.app/api/hub/…`
- **Clave:** una sola, compartida. Se carga como `HUB_CLAVE` en Vercel, en el proyecto `mindlin-asistente` y en el del hub (un texto largo al azar; lo elige Axel). Sin `HUB_CLAVE`, la API está apagada (responde 503).
- **En cada pedido:** el encabezado `Authorization: Bearer <HUB_CLAVE>`.
- **Quién hizo el cambio (opcional):** el encabezado `X-Hub-Usuario: Tadeo` (con acentos, codificado: `Jos%C3%A9`). Queda anotado en la ficha, el tono o la pausa. Sin él, queda «Hub».
- **Siempre desde el servidor del hub**, nunca desde el navegador: la clave no tiene que llegar a la computadora de nadie.
- Los cuerpos y las respuestas son JSON. Los errores vienen como `{ "error": "…" }`, con un texto listo para mostrarle a la persona.

| Código | Qué significa |
| --- | --- |
| 200 / 201 | Hecho (201: se creó algo). |
| 400 | Lo que se mandó no pasa la revisión; `error` dice qué corregir. |
| 401 | Falta la clave o es incorrecta. |
| 404 / 405 | Esa dirección no existe, o no admite esa operación. |
| 409 | No se puede (por ejemplo, borrar una regla que ya se mandó). |
| 503 | Falta configurar algo en Vercel (`HUB_CLAVE`, la base o la clave de la IA). |

## Leer todo: `GET /api/hub/config`

Una sola lectura trae todo lo necesario para dibujar las pantallas:

```json
{
  "proyectos": [{ "id": "lerma-439", "nombre": "Lerma 439", "activo": true, "palabras_clave": ["lerma"], "presentacion": "…", "precios": "…", "notas_internas": "…" }],
  "tono": { "instrucciones": "…", "criterios_comerciales": "…", "cuando_pasar_a_persona": "…", "pasar_al_responder": false, "actualizado": "2026-11-10T14:00:00.000Z", "actualizado_por": "Tadeo" },
  "ejemplos": [{ "id": 1, "titulo": "…", "conversacion": "…", "activo": true }],
  "reglas": [{ "id": 3, "etapa": "Nuevo", "paso": 1, "dias_sin_respuesta": 1, "version": 1, "estado": "activa", "proyecto": "lerma-439", "mensaje": "Hola {{nombre}}…", "enviados": 12, "respondieron": 5 }],
  "etapas": [{ "evento": "respondio", "titulo": "La persona respondió y la conversación sigue", "etapa": "Seguimiento", "actualizado": null, "actualizado_por": null, "movidos_30_dias": 4 }],
  "estado": { "pausado": false, "cambiado": null, "cambiado_por": null },
  "falta": [{ "listo": false, "texto": "A la ficha de Lerma 439 le falta: precios.", "link": "/panel/proyectos/lerma-439" }],
  "ia": { "proveedor": "anthropic", "modelo": "claude-opus-5-5", "audios": false },
  "opciones": {
    "campos_ficha": [{ "campo": "presentacion", "titulo": "Presentación (lo primero que cuenta del proyecto)" }],
    "largo_maximo_campo": 8000,
    "etapas_seguimiento": ["Nuevo", "Contacto inicial", "Seguimiento", "Visita / reunión", "Negociación", "Reserva", "En pausa"],
    "eventos_de_etapa": [{ "evento": "primer_contacto", "titulo": "El asistente le respondió por primera vez" }],
    "etapas_destino": ["Contacto inicial", "Seguimiento", "Visita / reunión", "Negociación", "En pausa", "Descartado"],
    "estados_regla": ["activa", "a_prueba", "archivada"],
    "pasos_maximos": 5,
    "variables_del_mensaje": ["{{nombre}}", "{{proyecto}}"],
    "horario_seguimientos": { "desde": 9, "hasta": 20, "tope_por_corrida": 20 },
    "horario_equipo": { "dias": [1, 2, 3, 4, 5], "desde": 9, "hasta": 20 }
  }
}
```

- `opciones` sirve para armar los formularios sin copiar las reglas: qué campos tiene una ficha y con qué título, qué etapas pueden llevar seguimiento, etcétera.
- `falta` es la misma lista que muestra el Resumen del panel («para que atienda bien, falta…»).
- En cada regla, `enviados` y `respondieron` dicen cuántos seguimientos salieron con esa regla y cuántos tuvieron respuesta: con eso se comparan versiones.

## Cambiar

En las fichas y en el tono **solo cambia lo que se manda**: lo demás queda como estaba.

| Qué | Pedido | Cuerpo |
| --- | --- | --- |
| Crear o cambiar una ficha | `PUT /api/hub/proyectos/{id}` | Los campos de la ficha que cambian: `nombre`, `activo`, `palabras_clave` (lista), `presentacion`, `descripcion`, `ubicacion`, `etapa_obra`, `entrega`, `tipologias`, `precios`, `financiacion`, `disponibilidad`, `amenities`, `preguntas_frecuentes`, `links`, `notas_internas`. Para uno nuevo, `nombre` es obligatorio. El `id` va en minúsculas, números y guiones (`via-53`). |
| Apagar o prender un proyecto | `PUT /api/hub/proyectos/{id}` | `{ "activo": false }` |
| Cambiar el tono y los criterios | `PUT /api/hub/tono` | `instrucciones`, `criterios_comerciales`, `cuando_pasar_a_persona`, `sobre_la_empresa`, `objeciones`, `pasar_al_responder` (true o false) |
| A qué etapa mueve un evento (etapas automáticas) | `PUT /api/hub/etapas/{evento}` | `{ "etapa": "Seguimiento" }`, o `{ "etapa": null }` para que no mueva. Solo a las de `opciones.etapas_destino`: Reserva y Vendido los decide una persona. |
| Agregar un ejemplo | `POST /api/hub/ejemplos` | `{ "titulo": "…", "conversacion": "…" }` |
| Usar o dejar de usar un ejemplo | `PATCH /api/hub/ejemplos/{id}` | `{ "activo": false }` |
| Borrar un ejemplo | `DELETE /api/hub/ejemplos/{id}` | — |
| Agregar una regla de seguimiento (o una versión nueva) | `POST /api/hub/reglas` | `{ "etapa": "Nuevo", "paso": 1, "dias_sin_respuesta": 1, "proyecto": "lerma-439", "mensaje": "Hola {{nombre}}…", "estado": "activa" }`. `proyecto` vacío o ausente: vale para todos. La versión se numera sola. |
| Activar, poner a prueba o archivar una regla | `PATCH /api/hub/reglas/{id}` | `{ "estado": "archivada" }` |
| Borrar una regla | `DELETE /api/hub/reglas/{id}` | —. Solo si nunca se mandó (si no, 409: se archiva, para no perder la medición). |
| Pausar o reactivar el asistente entero | `PUT /api/hub/estado` | `{ "pausado": true }` |

Cada respuesta devuelve cómo quedó lo que se tocó (`proyecto`, `tono`, `ejemplos`, `reglas` o `estado`), así la pantalla se actualiza sin volver a leer todo.

El texto de un mensaje de regla solo admite las variables `{{nombre}}` y `{{proyecto}}`.

## Probar el asistente: `POST /api/hub/probar`

Para chatear con el asistente desde el hub como si fueras un interesado. Usa el tono, las fichas, los ejemplos y la IA de verdad, pero **no manda nada por WhatsApp ni escribe en el CRM**.

- Primer mensaje: `{ "texto": "Hola, ¿tienen 2 ambientes?", "proyecto": "lerma-439" }` (`proyecto` es opcional: sin él, el asistente lo averigua).
- Responde `{ "estado": { "mensajes": […], "proyecto": "lerma-439", "anotado": {…}, "pasada": false }, "acciones": ["📝 Anotaría en el CRM: ambientes: 2"] }`.
- Mensajes siguientes: mandar de vuelta el `estado` que vino, con el `texto` nuevo: `{ "estado": {…}, "texto": "Para invertir" }`. La charla la guarda el hub; el asistente no guarda nada de las pruebas.
- `acciones` es lo que haría además de contestar (anotar en el CRM, elegir un proyecto, pasar al equipo). `pasada: true` quiere decir que en una conversación real ya la habría pasado al equipo.
- Cada mensaje usa la IA de verdad: tiene costo y puede tardar unos segundos.

## Números: `GET /api/hub/resumen`

`{ "ultimos_7_dias": { "conversaciones": 12, "respuesta": 40, "paso_a_persona": 5, "la_tomo_una_persona": 2, "seguimiento": 8, "error": 0, … }, "registro": [{ "fecha": "…", "conversacion": 7, "tipo": "respuesta", "detalle": "…" }] }`. Lo mismo que muestra el Resumen del panel.

## Lo que la API no hace (todavía)

- No lista conversaciones ni mensajes: eso se ve en Chatwoot (y, en chico, en `/panel/conversaciones`).
- No cambia datos de los contactos del CRM: eso lo hace el equipo desde el hub. Las etapas las mueve el asistente solo, con las reglas de `etapas` (ver [`integracion-crm.md`](integracion-crm.md)).

## Las pantallas del hub

Ya están armadas en el hub de Mindlin: **HQ → Comercial → Asistente de WhatsApp** (`/comercial/asistente`, repo `mindlinhub`, `docs/asistente-whatsapp.md`). El hub se conecta con `ASISTENTE_URL` y `ASISTENTE_CLAVE` (la misma que `HUB_CLAVE` acá).

## Código

- `lib/hub/api.ts`: toda la lógica, con las mismas validaciones que el panel (`lib/panel/validar.ts`). Pruebas contra Postgres en `lib/hub/api.test.ts`.
- `app/api/hub/[...ruta]/route.ts`: la ruta de Next, que solo conecta.
- `/api/salud` dice si la API está prendida (`apiDelHub`).
