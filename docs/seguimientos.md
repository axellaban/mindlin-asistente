# Seguimientos

Cuando alguien consultó por WhatsApp y dejó de responder, el asistente le vuelve a escribir según reglas que carga el equipo. Salen por Chatwoot, así quedan a la vista en la bandeja.

## Las reglas

Cada regla dice: **«si la persona está en tal etapa del CRM y pasan tantos días sin que responda, mandale este mensaje»**.

| Campo | Qué es |
| --- | --- |
| Etapa | La del CRM del hub: Nuevo, Contacto inicial, Seguimiento, Visita / reunión, Negociación, Reserva o En pausa. Sin contacto en el CRM, cuenta como Nuevo. |
| Paso | 1 para el primer seguimiento, 2 para el segundo… hasta 5. |
| Días sin respuesta | Desde lo último que le mandamos (el bot, el equipo o el seguimiento anterior). Con una corrida por día, sale en la corrida más cercana a cuando se cumplen (ver «Cómo corre»). |
| Proyecto | Vacío: vale para todos. Si hay una regla para el proyecto de la conversación, va esa. |
| Mensaje | Puede usar `{{nombre}}` (el nombre de pila) y `{{proyecto}}`. Sin nombre, «Hola {{nombre}}, …» queda «Hola, …». |
| Versión y estado | `activa`, `a_prueba` o `archivada`. Ver «Comparar versiones». |

Ejemplo: Nuevo, paso 1, 2 días: «Hola {{nombre}}, ¿pudiste ver lo de {{proyecto}}? Si querés te paso los planos.» Y Nuevo, paso 2, 5 días: «¿Seguís buscando? Cualquier cosa, acá estoy.»

**Sin reglas cargadas no sale ningún seguimiento.** Se cargan en el panel (`/panel/seguimientos`).

## Cuándo sale y cuándo no

- Solo a quien ya escribió, y solo si lo último lo dijimos nosotros.
- De 9 a 20, hora de Buenos Aires.
- Como mucho 20 por corrida (una por día): WhatsApp por WAHA no es oficial y no conviene mandar de a muchos. Si un día quedan más de 20 en condiciones, el resto sale en la corrida siguiente.
- Si la persona responde, frena: la atiende el bot y, si vuelve a quedar callada, los pasos empiezan de nuevo.
- **Si una persona del equipo tomó la conversación** (escribió, o el bot se la pasó), no lleva más seguimientos automáticos.
- Si no hay regla para el paso siguiente, termina.
- Si el CRM está conectado pero no responde, esa corrida no manda nada (sin la etapa se le podría escribir a alguien que ya atiende el equipo).
- Si Chatwoot falla al mandar, ese seguimiento no se repite: mejor uno menos que uno repetido. Queda en el registro.

Cada seguimiento se anota en el CRM («Seguimiento automático (1.º): …») y en el registro del bot.

## Comparar versiones

Para probar dos mensajes para la misma etapa y paso, se carga uno como `activa` y el otro como `a_prueba` (con otro número de versión). A cada conversación le toca siempre la misma versión, repartidas por partes iguales. El panel muestra, por regla, cuántos seguimientos salieron y cuántos respondieron (en `seguimientos_enviados`, la columna `respondio`). Cuando una gana, la otra se archiva.

## Cómo corre

- `vercel.json` programa `GET /api/cron/seguimientos` una vez por día, a las 13:00 UTC (las 10 de la mañana en Buenos Aires, dentro de la franja de 9 a 20). Vercel manda `Authorization: Bearer <CRON_SECRET>`: sin esa variable cargada, la ruta no hace nada.
- **Por qué una vez por día y no cada 15 minutos:** el 13/11 Axel movió el proyecto a la cuenta `mindlindevelopers.ia`, que es plan Hobby, y Hobby solo admite crons diarios. Las reglas se miden en días, así que una corrida diaria las respeta igual; lo que se pierde es puntualidad dentro del día. Si el proyecto vuelve a un equipo con plan Pro, se puede volver a `*/15 * * * *`.
- **Margen de media corrida** (13/11). Una regla vence medio día antes (`MARGEN_MS` en `lib/seguimientos/reglas.ts`). Sin eso, con una sola corrida por día, una regla de «1 día» para alguien a quien le escribimos ayer a las 11 no salía hoy a las 10 (iban 23 horas) sino mañana. Además, en Hobby, Vercel corre el cron en cualquier minuto de esa hora, así que entre dos corridas puede haber un poco menos de 24 horas. Con el margen, «1 día» quiere decir «en la corrida de mañana a las 10» para todo lo que se mandó hasta las 22.
- **Cada cuánto corre está en un solo lugar:** `CORRIDA` en `lib/seguimientos/reglas.ts` (el margen sale de ahí, y el panel y el hub muestran su texto). Una prueba controla que coincida con `vercel.json`: si se vuelve a cada 15 minutos, se cambian los dos (`cadaMs: 15 * 60_000`, `texto: "cada 15 minutos"`).
- La lógica está en `lib/seguimientos/reglas.ts` (puro: horario, qué regla toca, el texto) y `lib/seguimientos/correr.ts` (la corrida). Pruebas en `lib/seguimientos/seguimientos.test.ts` y, contra Postgres, en `lib/datos/postgres.test.ts`.
- La base (`db/migraciones/202611100003_seguimientos.sql`): cada mensaje actualiza en `conversaciones` cuándo escribió cada uno, el paso y si la tomó una persona; `seguimientos_enviados` guarda cada seguimiento con su regla, su versión y si respondió.
