# Seguimientos

Cuando alguien consultó por WhatsApp y dejó de responder, el asistente le vuelve a escribir según reglas que carga el equipo. Salen por Chatwoot, así quedan a la vista en la bandeja.

## Las reglas

Cada regla dice: **«si la persona está en tal etapa del CRM y pasan tantos días sin que responda, mandale este mensaje»**.

| Campo | Qué es |
| --- | --- |
| Etapa | La del CRM del hub: Nuevo, Contacto inicial, Seguimiento, Visita / reunión, Negociación, Reserva o En pausa. Sin contacto en el CRM, cuenta como Nuevo. |
| Paso | 1 para el primer seguimiento, 2 para el segundo… hasta 5. |
| Días sin respuesta | Desde lo último que le mandamos (el bot, el equipo o el seguimiento anterior). |
| Proyecto | Vacío: vale para todos. Si hay una regla para el proyecto de la conversación, va esa. |
| Mensaje | Puede usar `{{nombre}}` (el nombre de pila) y `{{proyecto}}`. Sin nombre, «Hola {{nombre}}, …» queda «Hola, …». |
| Versión y estado | `activa`, `a_prueba` o `archivada`. Ver «Comparar versiones». |

Ejemplo: Nuevo, paso 1, 2 días: «Hola {{nombre}}, ¿pudiste ver lo de {{proyecto}}? Si querés te paso los planos.» Y Nuevo, paso 2, 5 días: «¿Seguís buscando? Cualquier cosa, acá estoy.»

**Sin reglas cargadas no sale ningún seguimiento.** Se cargan en el panel (`/panel/seguimientos`).

## Cuándo sale y cuándo no

- Solo a quien ya escribió, y solo si lo último lo dijimos nosotros.
- De 9 a 20, hora de Buenos Aires.
- Como mucho 20 por corrida (cada 15 minutos): WhatsApp por WAHA no es oficial y no conviene mandar de a muchos.
- Si la persona responde, frena: la atiende el bot y, si vuelve a quedar callada, los pasos empiezan de nuevo.
- **Si una persona del equipo tomó la conversación** (escribió, o el bot se la pasó), no lleva más seguimientos automáticos.
- Si no hay regla para el paso siguiente, termina.
- Si el CRM está conectado pero no responde, esa corrida no manda nada (sin la etapa se le podría escribir a alguien que ya atiende el equipo).
- Si Chatwoot falla al mandar, ese seguimiento no se repite: mejor uno menos que uno repetido. Queda en el registro.

Cada seguimiento se anota en el CRM («Seguimiento automático (1.º): …») y en el registro del bot.

## Comparar versiones

Para probar dos mensajes para la misma etapa y paso, se carga uno como `activa` y el otro como `a_prueba` (con otro número de versión). A cada conversación le toca siempre la misma versión, repartidas por partes iguales. El panel muestra, por regla, cuántos seguimientos salieron y cuántos respondieron (en `seguimientos_enviados`, la columna `respondio`). Cuando una gana, la otra se archiva.

## Cómo corre

- `vercel.json` programa `GET /api/cron/seguimientos` cada 15 minutos. Vercel manda `Authorization: Bearer <CRON_SECRET>`: sin esa variable cargada, la ruta no hace nada. **Los crons cada 15 minutos necesitan el plan Pro de Vercel** (el de Axel lo es).
- La lógica está en `lib/seguimientos/reglas.ts` (puro: horario, qué regla toca, el texto) y `lib/seguimientos/correr.ts` (la corrida). Pruebas en `lib/seguimientos/seguimientos.test.ts` y, contra Postgres, en `lib/datos/postgres.test.ts`.
- La base (`db/migraciones/202611100003_seguimientos.sql`): cada mensaje actualiza en `conversaciones` cuándo escribió cada uno, el paso y si la tomó una persona; `seguimientos_enviados` guarda cada seguimiento con su regla, su versión y si respondió.
