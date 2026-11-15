# De qué campaña viene cada lead

Pedido de Axel (15/11, mejora 2): saber de qué campaña viene cada persona que escribe, para medir qué anuncio trae consultas. Mindlin dice qué campañas tiene; se cargan en el hub, adentro de cada línea.

## Cómo lo decide

Una sola vez, con el **primer mensaje** de una conversación nueva (antes de que le escriba nadie). Después no cambia, aunque escriba otra cosa.

1. **Por la frase del anuncio.** Los anuncios de Meta que abren WhatsApp arman el primer mensaje («¡Hola! Quiero más información sobre Lerma 439»). Cada campaña tiene una o más frases. Si el primer mensaje contiene una, viene de esa campaña.
   - Se compara sin mayúsculas, acentos ni signos, y por palabras enteras: «info lerma» no coincide con «info lermática».
   - Si coinciden varias, gana la frase más larga, que es la más específica.
   - Una campaña puede ser de una sola línea o de todas.
2. **Por la línea.** Si ninguna frase coincide y la línea tiene una **campaña de la línea** (por ejemplo, «la 4 es la de Meta Mar del Plata»), queda esa.
3. Si no, **ninguna**.

## Dónde queda

- **En la conversación** (`conversaciones.campania` y por qué: `frase` o `linea`). Se ve en el hub: Asistente de WhatsApp → Conversaciones.
- **En el CRM:**
  - **Lead nuevo:** la etiqueta **«Campaña: …»** en la columna Tags, y la nota de alta lo dice: «Alta por WhatsApp (línea «Leads entrantes», campaña «Meta Lerma nov»)».
  - **Lead que ya estaba:** solo una nota en la actividad, «Escribió por WhatsApp (línea …, campaña …)». Sus etiquetas no se tocan: las cargó una persona.
- **En los números:** el Resumen de cada línea dice cuántas conversaciones nuevas trajo cada campaña en los últimos 30 días, y cuántas no tienen campaña.

## Cómo se carga

En el hub: Comercial → Asistente de WhatsApp → la línea → Inteligencia comercial → **Campañas**.

- **El nombre**, hasta 30 letras, porque queda como etiqueta del CRM («Campaña: …», 40 letras).
- **Las frases**, una por renglón, de 4 letras o más. Conviene copiar el texto del mensaje que arma el anuncio, o una parte bien distintiva.
- **De qué línea** es, o de todas.
- **Activa o apagada.** Si se apaga o se borra, las conversaciones que ya la tienen la conservan.

La campaña de la línea va en el mismo lugar (y en el panel, `/panel/lineas`).

## Límites

- Si la persona borra o cambia mucho el texto del anuncio, no se reconoce. Queda la campaña de la línea, si tiene.
- Las conversaciones anteriores al 15/11 no tienen campaña.
- Meta también manda de qué anuncio viene un mensaje («referral»), pero por WAHA y Chatwoot eso no llega. Si en algún momento se pasa a la API oficial de WhatsApp, se puede usar.

## Código

- `lib/campanias.ts`: cómo se decide y cómo se revisa una campaña (puro, con pruebas en `campanias.test.ts`).
- `lib/agente/charla.ts`: la decide con el primer mensaje y la pasa al alta del CRM.
- Migración `202611150012_campanias.sql`: la tabla `campanias`, `lineas.campania` y `conversaciones.campania`.
- API del hub: `GET/POST /api/hub/campanias`, `PUT/DELETE /api/hub/campanias/{id}` ([`api-hub.md`](api-hub.md)).
