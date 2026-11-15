# Flujos

Un flujo es la secuencia con la que una línea de leads atiende a una persona nueva, como los bots de Kommo. Por ejemplo: saluda, presenta el proyecto en varios mensajes con pausas, manda el brochure, pide que responda y espera. Si responde, la pasa al equipo; si no responde en 24 horas, la mueve de etapa y hace un seguimiento. Lo que hacían los bots de Kommo y cómo se arma cada uno: [`kommo.md`](kommo.md).

Se arman en el hub (Comercial → Asistente de WhatsApp → la línea → Flujos), con un editor de pasos que se arrastran. Se prueban en la solapa Probar, con el mismo motor que en WhatsApp. En el panel del asistente (`/panel/lineas`) se ven en texto.

## Los pasos

| Paso | Qué hace |
| --- | --- |
| **Mensaje** | Un texto fijo con `{{nombre}}` y `{{proyecto}}`. Puede llevar una foto, un audio o un PDF subido al asistente (hasta 2,5 MB; un folleto más pesado va como link en el texto). Se revisa que el archivo sea de verdad lo que dice ser: un programa renombrado como .jpg no entra. |
| **Pausa** | De 1 a 60 segundos antes del paso siguiente, para que no salga todo de golpe. |
| **La IA escribe** | Un mensaje que arma la IA con la ficha del proyecto, siguiendo una consigna. Por ejemplo: «Presentá el proyecto y preguntale qué busca». Tiene las mismas herramientas que en la charla: anota en el CRM, marca señales y puede pasar al equipo. |
| **Esperar respuesta** | Abre dos caminos: **Si responde** y **Si no responde** en el plazo (de 1 hora a 30 días). Cada camino es otra lista de pasos. |
| **Mover de etapa** | Cambia la etapa en el CRM, con los cuidados de siempre: no toca Reserva ni Vendido y no retrocede. |
| **Pasar al equipo** | Nota interna (con la nota del paso) y la conversación pasa a una persona. Termina el flujo. |
| **Que siga la IA** | Desde acá conversa la IA, como en el modo «Conversa». Si hay algo de la persona sin contestar, lo contesta ya. Termina el flujo. |
| **Terminar** | No manda nada más. Si la persona escribe después, la atiende el equipo. |

Reglas de forma (`lib/flujos/modelo.ts`, `validarPasos`):

- «Esperar respuesta», «Pasar al equipo», «Que siga la IA» y «Terminar» van al final de su camino.
- Un camino que se termina sin ninguno de esos funciona como «Terminar».
- Entre una espera y la siguiente (un **tramo**), las pausas suman hasta 120 segundos y la IA escribe hasta 3 veces: todo eso sale en una misma función de Vercel, que corta a los 300 segundos.
- Hasta 60 pasos en total y hasta 4 esperas una adentro de otra.
- Es una lista, no un dibujo libre: no se pueden armar vueltas infinitas y se lee de arriba abajo, como la conversación.

## Cuándo arranca

- Solo con una **persona nueva**: la conversación no tiene ningún mensaje del asistente ni del equipo, y nunca corrió un flujo. Las conversaciones que ya venían siguen como estaban.
- Solo en líneas de leads, con un flujo **activo**. Puede haber uno general por línea y uno por proyecto. Al activar uno se apaga el que estaba activo para lo mismo.
- **Qué flujo:** si el primer mensaje nombra un proyecto que tiene flujo propio (por el nombre o las palabras clave de la ficha, en palabras enteras: «53» no coincide con «1532»), va ese. Si no, el general. Si nombra dos, no adivina: va el general. Así reemplaza al «Bot para las Fuentes» de Kommo.
- Al arrancar, la persona queda en el CRM, como en Kommo: entra con la etapa del «primer contacto». Si nombró un proyecto, la conversación queda con ese proyecto.
- Sin flujo, atiende la IA como siempre, con el modo de la línea («Conversa» o «presenta y pasa»).

## Cómo corre (lib/flujos/motor.ts y lib/flujos/servicio.ts)

- **Cada vez que arranca** queda una corrida (`flujo_corridas`) con una copia de los pasos. Si alguien edita el flujo, las conversaciones que ya iban siguen con el que empezaron.
- **Antes de hacer cada paso** anota que pasó al siguiente. Si la función se corta a la mitad, sigue desde el paso de después: mejor un mensaje menos que uno repetido.
- **Si la persona escribe mientras sale la presentación**, al llegar a «Esperar respuesta» ya cuenta como que respondió y sigue por «Si responde».
- **Si responde a una espera**, el webhook sigue por «Si responde» enseguida.
- **Si no responde**, la retoma el cron (una vez por día, a las 10) por «Si no responde». Como en los seguimientos, la espera vence media corrida antes: «24 horas» quiere decir «en la corrida de mañana a las 10». Pero el margen nunca pasa de la mitad de la espera: una de «2 horas» que arranca a las 9:59 no sale en la corrida de las 10, sino en la del día siguiente (`margenDeEspera`, 15/11). Con Vercel Pro se puede correr más seguido.
- **Desde el hub** (Flujos → «Quiénes van»), se ve en qué paso va cada persona y se la puede **sacar** del flujo (desde ahí conversa la IA) o **reiniciar** (vuelve al primer paso con los pasos de hoy y la retoma el cron de las 10). Queda en el registro quién lo hizo (desde el 15/11).
- **Una sola corrida a la vez por conversación.** Dos avisos a la vez, o el cron y un aviso, no la corren los dos: cada uno la «reclama» y la base deja uno solo. Mientras corre queda ocupada 6 minutos, más que lo que dura una función. Si se cortó, el cron la retoma.
- **Nadie queda sin respuesta:** si la persona respondió y el camino termina sin decirle nada, pasa al equipo. Si escribe después de un «Terminar», también.
- **Si algo falla** (Chatwoot, la IA), la conversación pasa al equipo con una nota y el error queda en el registro.
- **Si el archivo no sale**, sale el texto solo y queda el error anotado.
- **Se corta solo** si el equipo toma la conversación (escribe, la abre o la resuelve), si se pausa la línea o el asistente, o si el equipo se la devuelve al asistente. En ese último caso conversa la IA, también si el flujo había terminado con «Terminar».
- **Se corta también si la persona pide que no le escriban más** (o la IA marca «no le interesa»): no sigue por ningún camino y la IA le contesta una vez, corto. Ver [`baja.md`](baja.md).
- **Los seguimientos por reglas** no le escriben a quien lleva un flujo: el flujo tiene sus propias esperas. Si el flujo terminó en «Que siga la IA», vuelven a valer las reglas.
- **El cron:** primero los flujos con esperas vencidas y después los seguimientos, con el mismo tope (20 por corrida) y en el mismo horario (de 9 a 20). Los flujos arrancan escalonados, unos segundos uno después del otro (ver «Espaciados» en [`seguimientos.md`](seguimientos.md)).

## Qué se mide

Por flujo:

- con cuántas personas arrancó;
- cuántas respondieron alguna vez;
- cuántas están esperando ahora;
- cuántas pasaron al equipo.

En el registro, cada tramo deja una línea «Flujo «…»: mandó 3 mensajes y espera la respuesta hasta el 17/11, 10:00».

## Modelos para arrancar

`lib/flujos/plantillas.ts`, salidos del documento de Kommo:

- presentación con brochure y un seguimiento;
- la IA presenta y sigue la charla;
- presentación con audio y propuesta de llamada (como 17 y 43);
- cuestionario de lotes;
- solo la IA.

Los textos entre paréntesis son para reemplazar.
