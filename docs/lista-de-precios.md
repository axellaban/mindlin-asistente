# Lista de precios del hub (17/11/2026, pedido de Mati)

El asistente contesta precios y disponibilidad con la **lista de precios oficial** de cada proyecto: la misma que el hub muestra en Comercial → Lista de precios y en el PDF para compartir. Sale del **Excel madre** del proyecto (pestaña «Lista de precios»), que se configura en los Ajustes del proyecto en el hub. Cuando cambia la planilla o se vende una unidad, el asistente lo sabe solo (en 10 minutos como mucho).

## Qué recibe la IA

En la ficha del proyecto, una sección «Lista de precios (unidades disponibles hoy)» con:

- cada unidad disponible: código, piso, tipología, orientación, m², precio de lista en dólares, USD/m² y el link de la unidad (si está en los ajustes de la lista);
- las **reventas** (las vende su dueño, a su precio) y las **cocheras**, solo si la lista para compartir las muestra (sus ajustes en el hub);
- las **condiciones** de la lista (las del pie del PDF).

Arriba de las unidades va un resumen: el **«desde»** de la lista (la de mejor valor disponible; las reventas no cuentan si hay unidades del proyecto) y, por tipología, cuántas quedan y desde cuánto («4 ambientes: queda 1 sola (la 6E), u$d 726.227»).

Y estas reglas (cómo habla de precios Mindlin, Mati, 17/11):

- vale esta lista por sobre lo que diga la ficha para precios y disponibilidad;
- **siempre «desde»**, con el mejor valor disponible: el de la lista o, si ya dijo qué tipología busca, el de esa tipología;
- el precio de una unidad puntual, cuando pregunten por esa unidad o cuando quedan pocas de lo que busca («Nos queda solo la 6E en u$d 726.227»); la escasez, solo si la lista la muestra;
- son precios de lista: descuentos, financiación especial y reservas los confirma el equipo; una unidad que no está en la lista no está disponible y no la ofrece;
- no manda la lista entera: como mucho dos o tres opciones que se ajusten a lo que busca la persona.

**Montos** (vale para todo lo que escribe el asistente): dólares **u$d 128.000** y pesos argentinos **ar$ 1.500.000**, nunca «USD», «US$» ni «$» solo.

Nunca recibe nada del comprador ni del inversor de una unidad.

## Cómo se configura

Cada proyecto del asistente tiene **«Lista de precios del hub»**: el proyecto del hub del que toma la lista (hub → Asistente de WhatsApp → Proyectos, o `/panel/proyectos`). Vacío: no la usa y vale solo la ficha. La migración `202611170019_lista_hub.sql` la dejó cargada así (los ids del hub no siempre son los del asistente):

| Asistente | Hub |
| --- | --- |
| `lerma-439` | `lerma-439` |
| `guemes` | `guemes-4676` |
| `17-y-43` | `fideicomiso-17-y-43` |
| `ramblas-del-plata` | `ramblas-del-plata` |
| `via-53` | `via-53` |
| `torre-cuatro-vientos` | `t4v` |

Si un proyecto del hub no tiene Excel madre, el hub contesta «no disponible» y el asistente sigue con la ficha. «Probar las conexiones» (hub → Resumen) dice, por proyecto, cuántas unidades leyó o por qué no.

## Cómo funciona

- **Hub:** `GET /api/asistente/unidades?proyecto=<id del hub>`, con `Authorization: Bearer <ASISTENTE_CLAVE>` (la misma clave del aviso; no pasa por el login). Devuelve `{ disponible, leido, unidades, cocheras, condiciones, web }` o `{ disponible: false, motivo }`. Ver `lib/asistente/unidades.ts` en el hub.
- **Asistente:** `lib/hub/lista.ts` la pide con `HUB_URL` y `HUB_CLAVE` (las del aviso al hub), la guarda 10 minutos por proyecto (si el hub falla, no vuelve a preguntar por 2 minutos) y la suma a la ficha (`lista_precios`, no se guarda). La usan WhatsApp, «Probar» y los pasos «La IA escribe» de los flujos. Si el hub no contesta en 6 segundos, responde con la ficha.
