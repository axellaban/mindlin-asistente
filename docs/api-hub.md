# API para el hub

Todo lo que se configura del asistente (fichas, tono y criterios comerciales, lo que sabe de la empresa, objeciones, ejemplos, reglas de seguimiento, etapas automáticas, pausa, las líneas de WhatsApp y sus flujos) se puede **leer y cambiar desde el hub de Mindlin**. El hub arma sus pantallas y habla con esta API; el asistente usa los cambios desde el mensaje siguiente.

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
| 409 | No se puede (por ejemplo, borrar una regla que ya se mandó, poner en una línea una bandeja que ya es de otra o borrar un archivo que usa un flujo). |
| 503 | Falta configurar algo en Vercel (`HUB_CLAVE`, la base o la clave de la IA). |

## Leer todo: `GET /api/hub/config`

Una sola lectura trae todo lo necesario para dibujar las pantallas:

```json
{
  "proyectos": [{ "id": "lerma-439", "nombre": "Lerma 439", "activo": true, "palabras_clave": ["lerma"], "presentacion": "…", "precios": "…", "notas_internas": "…" }],
  "tono": { "instrucciones": "…", "criterios_comerciales": "…", "cuando_pasar_a_persona": "…", "pasar_al_responder": false, "horario_equipo": { "dias": [1, 2, 3, 4, 5], "desde": 9, "hasta": 20 }, "actualizado": "2026-11-10T14:00:00.000Z", "actualizado_por": "Tadeo" },
  "ejemplos": [{ "id": 1, "titulo": "…", "conversacion": "…", "activo": true }],
  "reglas": [{ "id": 3, "etapa": "Nuevo", "paso": 1, "dias_sin_respuesta": 1, "version": 1, "estado": "activa", "proyecto": "lerma-439", "mensaje": "Hola {{nombre}}…", "enviados": 12, "respondieron": 5 }],
  "etapas": [{ "evento": "respondio", "titulo": "La persona respondió y la conversación sigue", "etapa": "Seguimiento", "actualizado": null, "actualizado_por": null, "movidos_30_dias": 4 }],
  "estado": { "pausado": false, "cambiado": null, "cambiado_por": null },
  "falta": [{ "listo": false, "texto": "A la ficha de Lerma 439 le falta: precios.", "link": "/panel/proyectos/lerma-439" }],
  "lineas": [{ "id": "linea-3", "orden": 3, "nombre": "Leads entrantes", "tipo": "entrada", "descripcion": "…", "telefono": "", "bandeja": 1, "por_defecto": true, "pausada": false, "pasar_al_responder": false, "instrucciones": "", "proyectos": [], "actualizado": null, "actualizado_por": null, "conversaciones_7_dias": 9 }],
  "flujos": [{ "id": 4, "linea": "linea-3", "nombre": "Presentación", "proyecto": null, "activo": true, "pasos": [{ "tipo": "mensaje", "texto": "¡Hola!", "archivo": null }], "corridas": 20, "respondieron": 7, "esperando": 3, "al_equipo": 6, "actualizado": "…", "actualizado_por": "Tadeo" }],
  "archivos": [{ "id": 2, "nombre": "audio de Mati.ogg", "tipo": "audio/ogg", "tamano": 48213, "creado": "…", "creado_por": "Mati", "en_uso": [4] }],
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
    "horario_seguimientos": { "desde": 9, "hasta": 20, "tope_por_corrida": 20, "corre": "una vez por día, a las 10" },
    "horario_equipo": { "dias": [1, 2, 3, 4, 5], "desde": 9, "hasta": 20 },
    "dias_semana": ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    "tipos_linea": [{ "tipo": "entrada", "titulo": "Leads entrantes", "ayuda": "…" }],
    "tipos_de_paso": [{ "tipo": "mensaje", "titulo": "Mensaje", "ayuda": "…" }],
    "limites_flujo": { "pasos": 60, "segundos_pausa": 60, "pausa_por_tramo": 120, "ia_por_tramo": 3, "horas_min": 1, "horas_max": 720, "…": "…" },
    "variables_flujo": ["{{nombre}}", "{{proyecto}}"],
    "plantillas_flujo": [{ "id": "presentacion-y-seguimiento", "nombre": "…", "descripcion": "…", "pasos": [] }],
    "tipos_archivo": ["image/jpeg", "image/png", "image/webp", "audio/ogg", "audio/mpeg", "audio/mp4", "application/pdf", "video/mp4"],
    "max_archivo_bytes": 2621440
  }
}
```

- `opciones` sirve para armar los formularios sin copiar las reglas: qué campos tiene una ficha y con qué título, qué etapas pueden llevar seguimiento, etcétera.
- `falta` es la misma lista que muestra el Resumen del panel («para que atienda bien, falta…»).
- En cada regla, `enviados` y `respondieron` dicen cuántos seguimientos salieron con esa regla y cuántos tuvieron respuesta: con eso se comparan versiones.
- `opciones.horario_seguimientos.corre` dice cada cuánto sale la tanda de seguimientos, para mostrarlo tal cual (hoy, «una vez por día, a las 10»; ver [`seguimientos.md`](seguimientos.md)).
- `lineas`: las cuatro líneas ([`lineas.md`](lineas.md)); `flujos`: todos los flujos de todas las líneas, con sus números; `archivos`: los que se subieron para los flujos (`en_uso`: qué flujos los usan).
- `tono.pasar_al_responder` ya no se usa (15/11): el modo «presenta y pasa» es de cada línea (`lineas[].pasar_al_responder`).
- `tono.horario_equipo` es el horario del equipo comercial que vale hoy; `opciones.horario_equipo`, el de fábrica. Días: 0 es domingo … 6 sábado (`opciones.dias_semana`); horas enteras de Buenos Aires, de `desde` a `hasta`.

## Cambiar

En las fichas y en el tono **solo cambia lo que se manda**: lo demás queda como estaba.

| Qué | Pedido | Cuerpo |
| --- | --- | --- |
| Crear o cambiar una ficha | `PUT /api/hub/proyectos/{id}` | Los campos de la ficha que cambian: `nombre`, `activo`, `palabras_clave` (lista), `presentacion`, `descripcion`, `ubicacion`, `etapa_obra`, `entrega`, `tipologias`, `precios`, `financiacion`, `disponibilidad`, `amenities`, `preguntas_frecuentes`, `links`, `notas_internas`. Para uno nuevo, `nombre` es obligatorio. El `id` va en minúsculas, números y guiones (`via-53`). |
| Apagar o prender un proyecto | `PUT /api/hub/proyectos/{id}` | `{ "activo": false }` |
| Cambiar el tono y los criterios | `PUT /api/hub/tono` | `instrucciones`, `criterios_comerciales`, `cuando_pasar_a_persona`, `sobre_la_empresa`, `objeciones`, `pasar_al_responder` (true o false), `horario_equipo` |
| Cambiar el horario del equipo | `PUT /api/hub/tono` | `{ "horario_equipo": { "dias": [1, 2, 3, 4, 5, 6], "desde": 9, "hasta": 19 } }`. Se puede mandar solo una parte (`{ "horario_equipo": { "hasta": 19 } }`): lo demás queda. Al menos un día, y `desde` antes que `hasta` (de 0 a 24). |
| A qué etapa mueve un evento (etapas automáticas) | `PUT /api/hub/etapas/{evento}` | `{ "etapa": "Seguimiento" }`, o `{ "etapa": null }` para que no mueva. Solo a las de `opciones.etapas_destino`: Reserva y Vendido los decide una persona. |
| Agregar un ejemplo | `POST /api/hub/ejemplos` | `{ "titulo": "…", "conversacion": "…" }` |
| Usar o dejar de usar un ejemplo | `PATCH /api/hub/ejemplos/{id}` | `{ "activo": false }` |
| Borrar un ejemplo | `DELETE /api/hub/ejemplos/{id}` | — |
| Agregar una regla de seguimiento (o una versión nueva) | `POST /api/hub/reglas` | `{ "etapa": "Nuevo", "paso": 1, "dias_sin_respuesta": 1, "proyecto": "lerma-439", "mensaje": "Hola {{nombre}}…", "estado": "activa" }`. `proyecto` vacío o ausente: vale para todos. La versión se numera sola. |
| Activar, poner a prueba o archivar una regla | `PATCH /api/hub/reglas/{id}` | `{ "estado": "archivada" }` |
| Borrar una regla | `DELETE /api/hub/reglas/{id}` | —. Solo si nunca se mandó (si no, 409: se archiva, para no perder la medición). |
| Pausar o reactivar el asistente entero | `PUT /api/hub/estado` | `{ "pausado": true }` |
| Cambiar una línea | `PUT /api/hub/lineas/{id}` | Lo que cambia: `nombre`, `descripcion`, `telefono`, `bandeja` (el número de la bandeja de Chatwoot, o `null`), `pausada`, `pasar_al_responder`, `instrucciones`, `proyectos` (lista de ids; vacía: todos). El tipo y el orden no cambian. Si la bandeja ya es de otra línea, 409. |
| Crear un flujo | `POST /api/hub/flujos` | `{ "linea": "linea-3", "nombre": "Presentación", "proyecto": null, "pasos": [ … ], "activo": false }`. Solo en líneas de leads. Los pasos, como en [`flujos.md`](flujos.md); si algo no pasa la revisión, 400 con el paso que está mal. |
| Cambiar un flujo | `PUT /api/hub/flujos/{id}` | `nombre`, `proyecto` o `pasos` (lo que no viene queda). Las conversaciones que ya lo empezaron siguen con los pasos de antes. |
| Prender o apagar un flujo | `PATCH /api/hub/flujos/{id}` | `{ "activo": true }`. Al prenderlo, se apaga el que estaba activo para lo mismo (misma línea y mismo proyecto, o el general). |
| Borrar un flujo | `DELETE /api/hub/flujos/{id}` | — |
| Subir un archivo para los flujos | `POST /api/hub/archivos` | `{ "nombre": "audio.ogg", "tipo": "audio/ogg", "datos": "<base64>" }`. Hasta 2,5 MB; tipos en `opciones.tipos_archivo`. |
| Ver (o escuchar) un archivo | `GET /api/hub/archivos/{id}` | Devuelve `{ "archivo": { …, "datos": "<base64>" } }`. |
| Borrar un archivo | `DELETE /api/hub/archivos/{id}` | Solo si ningún flujo lo usa (si no, 409). |

Cada respuesta devuelve cómo quedó lo que se tocó (`proyecto`, `tono`, `ejemplos`, `reglas`, `estado`, `linea` y `lineas`, `flujos` o `archivos`), así la pantalla se actualiza sin volver a leer todo.

Una regla de seguimiento puede llevar `"linea": "linea-4"` para valer solo en esa línea (sin línea, vale para todas).

El texto de un mensaje de regla solo admite las variables `{{nombre}}` y `{{proyecto}}`.

## Probar el asistente: `POST /api/hub/probar`

Para chatear con el asistente desde el hub como si fueras un interesado. Usa el tono, las fichas, los ejemplos y la IA de verdad, pero **no manda nada por WhatsApp ni escribe en el CRM**.

- Primer mensaje: `{ "texto": "Hola, ¿tienen 2 ambientes?", "proyecto": "lerma-439" }` (`proyecto` es opcional: sin él, el asistente lo averigua).
- Responde `{ "estado": { "mensajes": […], "proyecto": "lerma-439", "anotado": {…}, "pasada": false }, "acciones": ["📝 Anotaría en el CRM: ambientes: 2"] }`.
- Mensajes siguientes: mandar de vuelta el `estado` que vino, con el `texto` nuevo: `{ "estado": {…}, "texto": "Para invertir" }`. La charla la guarda el hub; el asistente no guarda nada de las pruebas.
- `acciones` es lo que haría además de contestar (anotar en el CRM, elegir un proyecto, pasar al equipo). `pasada: true` quiere decir que en una conversación real ya la habría pasado al equipo.
- Cada mensaje usa la IA de verdad: tiene costo y puede tardar unos segundos.
- **Con una línea** (`"linea": "linea-3"` en el primer mensaje): prueba como esa línea (sus proyectos, sus instrucciones, su modo) y, si tiene un flujo activo, lo corre con el mismo motor que en WhatsApp. Los mensajes fijos salen en la charla y las pausas y los cambios de etapa van en `acciones`. `estado.flujo` dice por dónde va: si está esperando, el próximo mensaje sigue por «Si responde».
- **Simular que no respondió:** `{ "estado": {…}, "vencer": true }` (sin texto) sigue por «Si no responde». Si no hay un flujo esperando, 400.

## Probar las conexiones: `GET /api/hub/chequeo`

Prueba de verdad cada pieza (no solo que las variables existan): Chatwoot con el token del Agent Bot, la base, la planilla del CRM y sus columnas, y la IA con un pedido chico. Muestra también lo último que pasó (el último mensaje que llegó, la última respuesta y si hubo un error después), si el asistente está pausado y si hay seguimientos en uso. No manda nada a nadie ni cambia nada.

```json
{ "chequeo": { "ok": false, "fecha": "2026-11-13T18:30:00.000Z", "pruebas": [
  { "que": "Chatwoot", "estado": "falla", "detalle": "Chatwoot 4.19.1 en https://chat… no acepta el token del Agent Bot (CHATWOOT_BOT_TOKEN): puede ser el de un Chatwoot anterior." },
  { "que": "IA", "estado": "ok", "detalle": "Responde Claude (claude-opus-5-5), en 1,2 segundos." }
] } }
```

- `estado`: `ok` (anda), `aviso` (revisar: por ejemplo, el asistente está pausado o todavía no llegó ningún mensaje) o `falla` (no anda). `ok` es `true` si ninguna falla.
- Tarda unos segundos (espera a la IA) y cada vez cuesta una fracción de centavo: llamarlo solo cuando alguien toca el botón.

## Números: `GET /api/hub/resumen` (o `/resumen/{línea}`)

Con una línea (`/resumen/linea-3`), solo lo de las conversaciones de esa línea. `{ "ultimos_7_dias": { "conversaciones": 12, "respuesta": 40, "paso_a_persona": 5, "la_tomo_una_persona": 2, "seguimiento": 8, "error": 0, … }, "registro": [{ "fecha": "…", "conversacion": 7, "tipo": "respuesta", "detalle": "…" }], "por_campania_30_dias": [{ "campania": "Meta Lerma nov", "conversaciones": 9 }, { "campania": null, "conversaciones": 3 }] }`. Lo mismo que muestra el Resumen del panel; `por_campania_30_dias` cuenta las conversaciones que empezaron en los últimos 30 días, por campaña (`null`: sin campaña).

## Campañas (desde el 15/11)

De qué campaña viene cada lead ([`campanias.md`](campanias.md)). Vienen en `config` (`campanias`, también las apagadas, con `conversaciones_30_dias`) y los límites en `opciones.limites_campania`.

| Qué | Pedido | Cuerpo |
| --- | --- | --- |
| Una campaña nueva | `POST /api/hub/campanias` | `{ "nombre": "Meta Lerma nov", "frases": ["Quiero más información sobre Lerma"] o "una\notra", "linea": "linea-3" o null (todas), "activa": true }` |
| Cambiarla (solo lo que viene) | `PUT /api/hub/campanias/{id}` | Lo mismo, solo lo que cambia. |
| Borrarla | `DELETE /api/hub/campanias/{id}` | Las conversaciones que ya la tienen la conservan. |
| La campaña de la línea | `PUT /api/hub/lineas/{id}` | `{ "campania": "Meta MdP" }` (vacío: ninguna). |

Cada respuesta trae la lista actualizada (`campanias`). Cada conversación de `GET /conversaciones` trae su `campania`.

## Conversaciones (desde el 15/11)

Para ver las conversaciones en el hub (en el CRM y en Asistente de WhatsApp → Conversaciones). Se leen de la base del asistente, que guarda cada mensaje que pasa por el Agent Bot: lo que escribe la persona, el asistente y el equipo. No se consulta a Chatwoot. Lo que no está en la base (las fotos, los audios y los archivos en sí, las notas internas) se ve con el link `enlace`, que abre la conversación en Chatwoot (`null` si falta `CHATWOOT_URL` o `CHATWOOT_ACCOUNT_ID`).

- **`GET /api/hub/conversaciones`** (o `/conversaciones/{línea}`): las 200 más recientes, de todas las líneas o de una. Cada una:

  ```json
  { "chatwoot_id": 501, "linea": "linea-3", "linea_nombre": "Leads entrantes", "nombre": "Ana", "telefono": "549…", "proyecto": "lerma-439", "crm_contacto_id": "c…",
    "ultimo": "2026-11-16T13:00:10.000Z", "ultimo_texto": "¡Hola Ana! …", "ultimo_rol": "bot", "mensajes": 2,
    "atiende": "asistente", "flujo": { "nombre": "Presentación", "estado": "esperando", "resultado": null, "paso": "Paso 2: Esperar respuesta", "vence": "…", "inicio": "…" },
    "enlace": "https://chat…/app/accounts/1/conversations/501" }
  ```

  `ultimo_rol`: `interesado`, `bot` (el asistente) o `persona` (el equipo, desde Chatwoot o el celular de la línea). `atiende`: `equipo` si lo último fue que pasó al equipo o que alguien del equipo escribió; si no, `asistente`. `flujo`: la corrida más nueva (`null` si nunca tuvo); `paso` dice por dónde va (`«Paso 12 › Si no responde › paso 2: Mensaje»`) o «Terminó». Para buscar por nombre o teléfono, el hub filtra esta lista.
- **`GET /api/hub/conversacion/{id}`**: una conversación entera: `{ "conversacion": { …lo de arriba, "interesado": { lo anotado }, "paso_seguimiento", "sin_seguimientos", "ultimo_seguimiento" }, "mensajes": [{ "id", "rol", "texto", "fecha" }], "registro": [lo último que hizo el asistente] }`. Hasta los 300 mensajes más nuevos, del más viejo al más nuevo. Los adjuntos vienen como texto: «[foto]», «[archivo]», y los audios transcriptos como «[audio: «…»]».
- **`POST /api/hub/contacto`** con `{ "id": "<id del CRM>", "telefono": "<como esté en el CRM>" }` (uno de los dos alcanza): las conversaciones de ese contacto (hasta 5: puede haber escrito por más de una línea), cada una con `historial` (sus mensajes, como arriba). Cruza por el ID que anotó el asistente en la conversación o por los últimos 8 números del teléfono, como el CRM del hub (así coincide «+54 9 11 5555-1234» con «011 15 5555-1234»). Es una lectura, pero va por POST para que el teléfono no viaje en la dirección.

## Qué vende: `GET /api/hub/resultados` (desde el 15/11)

Para cada flujo y cada versión de seguimiento de los últimos 90 días, a cuántos leads les tocó y cuántos llegaron a Visita / reunión, Negociación y Reserva en el CRM ([`resultados.md`](resultados.md)):

```json
{ "dias": 90, "crm": true,
  "flujos": [{ "flujo": 3, "leads": 20, "visita": 6, "negociacion": 2, "reserva": 1 }],
  "seguimientos": [{ "regla": 5, "version": 2, "leads": 14, "visita": 3, "negociacion": 1, "reserva": 0 }] }
```

Lee la planilla del CRM entera: pedirlo cuando se abre la pantalla, no a cada rato. Sin CRM, o si no responde, `crm: false` y `error` con el motivo.

## Quiénes van en un flujo: `GET /api/hub/corridas` (desde el 15/11)

Las personas que están adentro de un flujo ahora (en curso o esperando la respuesta), la más nueva primero: `{ "corridas": [{ "id": 12, "flujo": 3, "nombre_flujo": "Presentación", "conversacion": 501, "linea": "linea-3", "nombre": "Ana", "telefono": "549…", "estado": "esperando", "paso": "Paso 4: Esperar respuesta", "vence": "…", "inicio": "…" }] }`.

| Qué | Pedido | Cuerpo |
| --- | --- | --- |
| Sacarla del flujo (desde ahí conversa la IA) | `PATCH /api/hub/corridas/{id}` | `{ "accion": "sacar" }` |
| Reiniciarle el flujo, con los pasos de hoy | `PATCH /api/hub/corridas/{id}` | `{ "accion": "reiniciar" }` |

Reiniciar no manda nada en el momento: la corrida vuelve al primer paso y la retoma el cron, en su horario y con su tope. Si esa conversación ya tiene otro flujo en marcha, contesta 409. Cada acción queda en el registro con quién la hizo.

## Lo que la API no hace (todavía)

- No manda mensajes: para responder, Chatwoot (es la fase 3 de las conversaciones en el hub).
- No cambia datos de los contactos del CRM: eso lo hace el equipo desde el hub. Las etapas las mueve el asistente solo, con las reglas de `etapas` (ver [`integracion-crm.md`](integracion-crm.md)).

## Las pantallas del hub

Ya están armadas en el hub de Mindlin: **HQ → Comercial → Asistente de WhatsApp** (`/comercial/asistente`, repo `mindlinhub`, `docs/asistente-whatsapp.md`). El hub se conecta con `ASISTENTE_URL` y `ASISTENTE_CLAVE` (la misma que `HUB_CLAVE` acá).

## Código

- `lib/hub/api.ts`: toda la lógica, con las mismas validaciones que el panel (`lib/panel/validar.ts`). Pruebas contra Postgres en `lib/hub/api.test.ts`.
- `app/api/hub/[...ruta]/route.ts`: la ruta de Next, que solo conecta.
- `/api/salud` dice si la API está prendida (`apiDelHub`).
