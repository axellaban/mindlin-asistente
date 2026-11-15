# Instrucciones para la IA de paneles

Este archivo es para la IA que trabaja con **computer use** en la computadora de Axel: la que entra a paneles web (Hostinger, DonWeb, Vercel, Neon, Google, Chatwoot) y a la terminal. Claude escribe el código en este repo y no tiene acceso a esos paneles. Las dos trabajan en paralelo, cada una en lo suyo.

## Para pegarle a la IA (Axel)

> Sos la IA de paneles del proyecto «Asistente comercial de Mindlin». Entrá a https://github.com/axellaban/mindlin-asistente/blob/main/IA_DE_PANELES.md (con mi sesión de GitHub) y seguí ese archivo: hacé las tareas que figuran como pendientes al principio de «Las tareas», en ese orden, respetá las reglas y anotá lo que averigües en `docs/estado-paneles.md`. Si algo pide pagar, borrar, cambiar algo que ya funciona o un código de verificación, frená y preguntame.

## Qué es el proyecto, en dos líneas

Un asistente de IA que atiende por WhatsApp las consultas de los desarrollos de Mindlin Developers (piloto: Lerma 439). WhatsApp entra por **WAHA**, el equipo ve y responde todo en **Chatwoot** (los dos en un VPS de Hostinger, con Easypanel desde el 13/11, en `https://chat.mindlindevelopers.com`), y el asistente es una app en **Vercel** con su base en **Neon** (Postgres). Detalle en [`docs/arquitectura.md`](docs/arquitectura.md).

## Reglas

1. **Ninguna clave, contraseña o token va a un chat, a GitHub, a un archivo del repo ni a una captura.** Las claves se copian directo de un panel al lugar donde se usan (por ejemplo, de la consola del servidor a Vercel → Settings → Environment Variables).
2. **Frená y preguntale a Axel** antes de pagar algo, borrar algo, cambiar algo que ya está funcionando (en DonWeb puede haber sitios o correos en uso) o cuando te pidan un código de verificación.
3. **No escanees ningún QR:** eso lo hace Axel con el celular del chip.
4. **Si algo falla, no improvises arreglos en el servidor.** Copiá el mensaje de error (sin claves) en `docs/estado-paneles.md` o pasáselo a Axel: Claude lo corrige en el script.

## Cómo reportar

Todo lo que averigües va en [`docs/estado-paneles.md`](docs/estado-paneles.md), que tiene un casillero para cada dato. Es el único archivo que editás:

1. En GitHub, abrí `docs/estado-paneles.md` y tocá el lápiz (**Edit this file**).
2. Completá lo que corresponda. **Solo datos, nunca claves.**
3. **Commit changes…** → elegí **Create a new branch for this commit and start a pull request** → nombre de rama `panel/<tarea>` (por ejemplo `panel/donweb`) → **Propose changes** → **Create pull request**.

Si GitHub se complica, pasale el texto a Axel y que lo cargue él.

Si una sección de `docs/estado-paneles.md` quedó vieja, marcala como resuelta, con la fecha, la próxima vez que anotes algo. Por ejemplo, «Pendiente para cerrar la tarea 9» ya se resolvió el 13/11: se volvió a publicar en Vercel y la prueba de punta a punta anduvo.

## Las tareas

**Pendientes (al 15/11), en este orden:**

1. **Tarea 12** · QA en producción de las líneas y los flujos. Se puede hacer ya.
2. **Tarea 13** · Prender los avisos al responsable: una variable en Vercel. Se puede hacer ya.
3. **Tarea 14** · El usuario «Hub» de Chatwoot, para ver fotos y audios en el hub. Se puede hacer ya, con Axel.
4. **Tarea 15** · Probar en producción todo lo del 15/11 (las mejoras 1 a 8 y lo traído de DeskcommCRM) y revisar que el hub y el asistente usen la misma planilla del CRM. Después de la 13 y la 14.
5. **Tarea 11** · Sumar la línea 4. Necesita el chip o número de esa línea: no arranques sin él.
6. **Tarea 7** · El equipo en Chatwoot. Espera a que Axel decida el correo de Chatwoot.

**Hechas:** 1, 2, 3, 9 y 10. **Reemplazadas por la 9 (Easypanel):** 4, 5, 6 y 8. Eran de la instalación vieja sobre Ubuntu y quedan como referencia: no hay que volver a hacerlas. La guía de hoy para el servidor es [`docs/easypanel.md`](docs/easypanel.md).

**Dónde se corre `servidor.sh`:** en la terminal del VPS, como root. Se entra desde hPanel de Hostinger → VPS → **Terminal del navegador**, o por SSH. No sirve la consola de un servicio de Easypanel: esa corre adentro de un contenedor y no ve el resto. El script está en `/opt/mindlin-asistente/servidor.sh`. Si en `main` cambió, se baja de nuevo con:

```bash
curl -fsSL https://raw.githubusercontent.com/axellaban/mindlin-asistente/main/infra/servidor.sh -o /opt/mindlin-asistente/servidor.sh
```

Si el repo vuelve a ser privado, ese `curl` falla. En ese caso, en GitHub abrí [`infra/servidor.sh`](infra/servidor.sh) → **Copy raw file**, y en la terminal `cat > /opt/mindlin-asistente/servidor.sh`, pegá y `Ctrl+D`.

### Tarea 1 · Revisar DonWeb (solo mirar)

Queremos saber si el servidor de Mindlin sirve para correr WAHA y Chatwoot. Entrá al panel de DonWeb y **no cambies nada**. Anotá en la sección «DonWeb» de `docs/estado-paneles.md`:

1. Qué tienen contratado: hosting compartido, Cloud Server / VPS, dominios, correo. El nombre de cada plan.
2. Si hay un Cloud Server o VPS:
   - vCPU, RAM y disco (total y libre);
   - sistema operativo y versión;
   - IP pública;
   - si hay acceso root por SSH, por consola web o por las dos;
   - si tiene algún panel instalado (Plesk, cPanel, Easypanel) y qué está corriendo hoy.
3. El dominio de Mindlin y dónde se administran sus DNS (DonWeb u otro proveedor).
4. El precio del plan actual y el del Cloud Server más chico con **4 GB de RAM o más**.

**Qué hace falta:** un VPS con 4 GB de RAM o más, 2 vCPU, 30 GB libres, Ubuntu 22.04 o 24.04 y acceso root. Si es solo hosting compartido, no sirve: hay que contratar un Cloud Server, pero eso lo decide Axel.

### Tarea 2 · Vercel y la base (hecha)

Ya está todo: el proyecto en Vercel (`https://mindlin-asistente.vercel.app`) y la base **Neon** conectada. Supabase no se usa: el plan gratis estaba lleno. Desde el 13/11 el proyecto está en el equipo `mindlin-developers-ia` (cuenta `mindlindevelopers.ia`, plan Hobby).

- **Las tablas se crean solas en cada publicación** (`scripts/migrar.mjs`). No hay que pegar nada a mano.
- **Variables cargadas** (Settings → Environment Variables, como Secret): `ANTHROPIC_API_KEY` y `PANEL_CLAVE` (Axel, 10/11); `CRON_SECRET` (Panel, 10/11); `OPENAI_API_KEY` (10/11: hoy responde con OpenAI y transcribe los audios); `HUB_CLAVE`, la misma que tiene el hub como `ASISTENTE_CLAVE` (el hub está conectado). Las cuatro de Chatwoot se volvieron a cargar el 13/11, con el servidor nuevo.
- **Para revisar después de una publicación:**
  1. En el registro de la publicación (**Build Logs**), la línea `migrar: …`. Dice cuántas migraciones hay y cuál se aplicó (al 15/11 son 11; la última es `202611150011_lineas_y_flujos.sql`).
  2. En **Settings → Cron Jobs**, `/api/cron/seguimientos` **una vez por día** (`0 13 * * *`, las 10 de Buenos Aires). Es lo que admite el plan Hobby; si el proyecto vuelve a un plan Pro, Claude lo vuelve a cada 15 minutos.
  3. `/api/salud`: la lista `faltan` tiene que estar vacía, y `ia` dice qué IA responde (`"proveedor": "openai"` o `"anthropic"`, según lo que se elija). Ojo: solo mira que las variables existan. Para saber si de verdad andan, usá **Conexiones** (`/panel/chequeo`, o en el hub: Resumen → «Probar las conexiones»).
  4. **No cambies las fichas, el tono ni la pausa:** eso lo maneja Mindlin.

### Tarea 3 · Cuenta de Google para el CRM

El asistente escribe los interesados en el CRM del hub, que es una planilla de Google. Necesita su propia cuenta de servicio. **Preguntale a Axel con qué cuenta de Google entrar:** tiene que ser una que pueda compartir esa planilla.

1. En [Google Cloud Console](https://console.cloud.google.com/), en el proyecto que diga Axel: **APIs y servicios → Biblioteca → Google Sheets API → Habilitar**.
2. **IAM y administración → Cuentas de servicio → Crear cuenta de servicio:** nombre `mindlin-asistente`, sin roles.
3. En la cuenta creada: **Claves → Agregar clave → JSON.** Se descarga un archivo.
4. En Vercel, cargá:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: el `client_email` del JSON;
   - `GOOGLE_PRIVATE_KEY`: el `private_key` del JSON, tal cual, con los `\n`.

   Después **borrá el JSON** de la computadora y de la papelera.
5. Abrí la planilla del CRM del hub y compartila con ese mail como **Editor**.
6. En Vercel, cargá `CRM_SHEET_ID`: lo que está entre `/d/` y `/edit` en la dirección de la planilla.
7. Anotá en «Google» solo que está hecho y el mail de la cuenta de servicio, que no es secreto.

### Tarea 4 · Instalar el servidor (reemplazada por la 9)

> **No hace falta:** era la instalación vieja sobre Ubuntu. Desde el 13/11 el servidor se instala con Easypanel (tarea 9, [`docs/easypanel.md`](docs/easypanel.md)). En modo Easypanel, `servidor.sh instalar` no corre.

Antes de empezar, Axel tiene que confirmar que el servidor sirve (tarea 1) y elegir el subdominio, por ejemplo `chat.<dominio de Mindlin>`.

1. **DNS:** donde se administra el dominio, creá un registro **A** con nombre `chat` (o el que elija Axel) que apunte a la IP del servidor. Puede tardar unos minutos en propagarse.
2. **Pasar el instalador al servidor.** Usá la opción A; si no hay SSH, la B.
   - **Opción A, desde la terminal de la compu de Axel:**
     ```bash
     git clone https://github.com/axellaban/mindlin-asistente.git
     scp mindlin-asistente/infra/servidor.sh root@<IP>:/root/servidor.sh
     ssh root@<IP>
     ```
   - **Opción B, desde la consola web de DonWeb:** en GitHub abrí [`infra/servidor.sh`](infra/servidor.sh) → **Raw** → copiá todo. En la consola: `nano /root/servidor.sh` → pegá → `Ctrl+O`, `Enter`, `Ctrl+X`.
3. En el servidor: `bash /root/servidor.sh instalar`. Pide el dominio (`chat.…`) y un mail para el certificado HTTPS. Tarda unos 10 minutos.
4. Al final muestra una verificación. Copiá **toda la salida de `bash /opt/mindlin-asistente/servidor.sh verificar`** (no tiene claves) en la sección «Servidor». Si dice que HTTPS no responde, casi siempre es que el DNS todavía no se propagó: esperá 15 minutos y verificá de nuevo.

### Tarea 5 · Chatwoot y la línea de WhatsApp (reemplazada por la 9)

> **Ya se hizo de nuevo en la tarea 9.** Los pasos 1 y 2 (alta de Chatwoot y token del perfil) siguen sirviendo: [`docs/easypanel.md`](docs/easypanel.md) los usa. Para sumar otra línea, la tarea 11.

1. Abrí `https://chat.<dominio>`: aparece la configuración inicial. Completá nombre, empresa (Mindlin Developers), el mail de Axel y una contraseña. La contraseña tiene que tener **mayúscula, minúscula, número y símbolo**; guardala en el gestor de contraseñas de Axel. Destildá la suscripción a novedades y tocá **Finalizar configuración**.
2. En Chatwoot: tu perfil (abajo a la izquierda) → **Configuración del perfil** → copiá el **Token de acceso**.
3. En el servidor: `bash /opt/mindlin-asistente/servidor.sh conectar lerma "WhatsApp Lerma 439"`. Cuando lo pida, pegá el token: no se ve mientras lo pegás.
4. **Con Axel y el celular del chip:** en Chatwoot, abrí la conversación «Integración de WhatsApp» de esa bandeja. Ahí aparece el QR; si no aparece, escribí `start` y mandalo. Axel lo escanea desde WhatsApp → **Dispositivos vinculados → Vincular un dispositivo**.
5. Probá mandar un mensaje desde otro teléfono al número del chip: tiene que aparecer en Chatwoot. Anotá el resultado en la sección «Chatwoot».

### Tarea 6 · Conectar el asistente (reemplazada por la 9)

> **Ya se hizo de nuevo en la tarea 9.** No vuelvas a correr `servidor.sh bot`: crea otro Agent Bot con otro token, y el asistente deja de contestar hasta cargar las cuatro variables nuevas en Vercel y volver a publicar.

Hace falta la tarea 2 terminada (la dirección de Vercel) y que Claude haya dejado el webhook. Fijate en `PENDIENTES.md` que «Webhook del Agent Bot» esté marcado como hecho.

1. En el servidor: `bash /opt/mindlin-asistente/servidor.sh bot`. Pide el token de Chatwoot, el número de la bandeja y la dirección del asistente en Vercel.
2. Muestra cuatro variables: `CHATWOOT_URL`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_BOT_TOKEN` y `CHATWOOT_WEBHOOK_SECRET`. Copialas **directo a Vercel**, no a un chat, y volvé a publicar.
3. Abrí `/api/salud` del asistente y anotá la lista `faltan`.

### Tarea 7 · El equipo en Chatwoot

1. **Configuración → Agentes → Agregar agente**, con el nombre y el mail de cada persona del equipo comercial que diga Axel.
2. Chatwoot manda la invitación por mail. Si no llega (el servidor todavía no tiene un correo configurado), anotalo: Claude o Axel lo resuelven.
3. App del celular: «Chatwoot» en App Store o Google Play → al iniciar sesión, elegir servidor propio y poner `https://chat.<dominio>`.

## Si algo falla en el servidor

- `bash /opt/mindlin-asistente/servidor.sh verificar` dice qué anda y qué no.
- Con Easypanel (desde la tarea 9): Easypanel → `mindlin` → `asistente` muestra cada contenedor y sus mensajes. Los servicios son `chatwoot-rails`, `chatwoot-sidekiq`, `postgres`, `redis` y `waha`.
- Antes de Easypanel (ya no aplica): `cd /opt/mindlin-asistente && docker compose logs --tail 100 chatwoot-rails`, y además estaba `caddy`.
- Copiá el error en `docs/estado-paneles.md`. Antes de copiarlo, revisá que no tenga claves.

### Tarea 8 · Actualizar el instalador en el servidor (reemplazada por la 9)

> **Ya no hace falta:** la reemplaza la tarea 9 (Easypanel), que instala todo de nuevo con estos mismos ajustes.

El instalador ahora se ajusta solo a un servidor con 4 GB: crea el swap si falta (el del VPS ya está) y baja los hilos de Chatwoot para que entre todo. Hay que pasarlo al servidor y correr `actualizar`:

1. Copiá el `infra/servidor.sh` de `main` al servidor como `/opt/mindlin-asistente/servidor.sh` (igual que en la tarea 4).
2. `bash /opt/mindlin-asistente/servidor.sh actualizar`. Hace un respaldo antes, conserva las claves y los datos, y reinicia Chatwoot (un minuto sin bandeja: avisale a Axel antes si el equipo ya la usa).
3. Copiá la salida de `verificar` en «Servidor» (ahora también muestra el swap).
4. Para confirmar los hilos: `grep -E 'RAILS_MAX_THREADS|SIDEKIQ_CONCURRENCY' /opt/mindlin-asistente/chatwoot.env` tiene que decir 3 y 5.

Si en la instalación se cambiaron las imágenes a mano (por ejemplo, con el digest), `actualizar` vuelve a las versiones fijadas en el script (las mismas: Chatwoot 4.19.1 y WAHA 2026.10.1). Si hay otra diferencia, frená y anotala.

### Tarea 9 · Reinstalar el servidor con Easypanel (hecha el 13/11)

Axel decidió pasar WAHA y Chatwoot a Easypanel para manejarlos sin consola. Todavía no hay datos reales, así que se reinstala de cero. El paso a paso completo está en [`docs/easypanel.md`](docs/easypanel.md). En resumen:

- un registro DNS nuevo, `waha`;
- reinstalar el VPS con la plantilla de Easypanel (**borra todo: confirmalo con Axel antes**);
- en Easypanel, el servicio Compose `asistente` con [`infra/easypanel/docker-compose.yml`](infra/easypanel/docker-compose.yml), sus claves y sus dos dominios;
- después, `servidor.sh easypanel`, `conectar` y `bot` como antes, el QR con Axel y las cuatro variables nuevas en Vercel.

Anotá en `docs/estado-paneles.md`, sección «Servidor», la salida de `verificar` y lo que haya salido distinto de la guía.

### Tarea 10 · Prueba de punta a punta por WhatsApp (hecha el 13/11)

> **Hecha el 13/11 con Axel:** el asistente contesta de punta a punta (detalle en `docs/estado-paneles.md`). Se puede repetir igual después de un cambio grande (otro servidor, otra línea, otra cuenta de Vercel).

Para confirmar que el asistente contesta de verdad. Hace falta que esté publicado en Vercel el PR que trajo **Conexiones** (el del 13/11, con la migración `202611130010_horario_equipo.sql`). Todo con datos inventados: ningún nombre ni dato real en las notas.

**No cambies las fichas, el tono, las etapas ni la pausa.** Si algo no anda, frená y anotá qué pasó (sin claves).

1. **Conexiones.** En el panel del asistente (`/panel`, con tu nombre «IA de paneles» y la clave), entrá a **Conexiones** y tocá **«Probar las conexiones»**. Copiá la tabla en `docs/estado-paneles.md` (no tiene claves). Si Chatwoot dice que no acepta el token o que la cuenta no es la correcta, frená: hay que volver a copiar las cuatro variables de Chatwoot a Vercel y volver a publicar (con Axel). Si dice que el asistente está pausado, preguntale a Axel antes de reactivarlo.
2. **Que la conversación la atienda el asistente.** El asistente solo contesta las conversaciones **pendientes**. La conversación 2 de la bandeja «WhatsApp Lerma 439» quedó **abierta** (la atiende el equipo), así que a ese número no le contesta. Dos opciones:
   - en Chatwoot, abrí la conversación 2 y cambiale el estado a **Pendiente** (o **resolvela**: el mensaje siguiente la reabre como pendiente); o
   - escribí desde un número que nunca le escribió a la línea.

   Mientras dure la prueba, **nadie del equipo responde a mano**: si alguien escribe en la conversación, el asistente se corre a propósito.
3. **Primera respuesta.** Desde el teléfono de prueba (no el de la línea), mandá: «Hola, quería info de Lerma 439». En unos 10 a 20 segundos tiene que llegar la respuesta al WhatsApp. Anotá si llegó y cuánto tardó, y si en Chatwoot se ve una sola vez (el webhook descarta el eco del propio bot: no tiene que aparecer repetida ni pasar la conversación a abierta).
4. **El CRM.** Respondé con datos inventados: «Soy Juan Prueba, busco 2 ambientes para invertir». En la planilla del CRM tiene que aparecer una fila nueva en «CRM Contactos» (origen WhatsApp, etapa «Contacto inicial» o «Seguimiento») y «Alta por WhatsApp» en «CRM Actividad». Anotá el ID del contacto (no el teléfono).
5. **Cambio de etapa.** Mandá: «¿Puedo ir a ver el showroom esta semana?». La etapa del contacto tiene que pasar a «Visita / reunión», con un «Cambio de etapa» en la actividad.
6. **Pasar a una persona.** Mandá: «Prefiero hablar con alguien del equipo». El asistente avisa que le van a escribir, deja una nota interna y la conversación pasa a **Abierta**. Mandá otro mensaje: el asistente **no** tiene que contestar.
7. **Devolvérsela al asistente.** En Chatwoot, poné la conversación en **Pendiente**. Mandá otro mensaje: el asistente vuelve a contestar.
8. **Conexiones otra vez.** Repetí el paso 1 y copiá la tabla: «Respuestas del asistente» tiene que mostrar la de recién, sin errores después.

Anotá todo en `docs/estado-paneles.md`, sección «Chatwoot», como «Prueba de punta a punta (Easypanel)». La fila de prueba del CRM no la borres: avisale a Axel cuál es, así decide si se borra o se pasa a «Descartado».


### Tarea 11 · Sumar la línea 4 (leads entrantes 2)

Desde el 15/11 el asistente maneja varias líneas ([`docs/lineas.md`](docs/lineas.md)). La 3 es la que ya anda (bandeja 1). La 4 es otra línea de leads entrantes. Hace falta el **chip o número nuevo**: pedíselo a Axel. No arranques sin él.

1. **WAHA y Chatwoot.** En la terminal del VPS (hPanel → VPS → **Terminal del navegador**, como root; no en la consola de un servicio de Easypanel), corré:

   ```bash
   bash /opt/mindlin-asistente/servidor.sh conectar linea4 "WhatsApp Leads 2"
   ```

   Pide el token de acceso de tu perfil de Chatwoot (no se ve mientras lo pegás). Crea la sesión, la bandeja y la conexión WAHA → Chatwoot. El QR aparece en la conversación «Integración de WhatsApp» de la bandeja nueva; si no aparece, escribí `start` y mandalo. Axel lo escanea con el teléfono de la línea 4. Anotá el **número de la bandeja nueva** (en Chatwoot: Configuración → Bandejas; la dirección termina en `/inboxes/<número>`).
2. **El Agent Bot.** **No corras `servidor.sh bot`**: crea un bot nuevo con otro token y la línea 3 dejaría de andar. En Chatwoot, en la bandeja nueva → Configuración → **Bot**, elegí el que ya existe, «Asistente Mindlin», y guardá.
3. **El hub.** HQ → Comercial → Asistente de WhatsApp → elegí «Leads entrantes 2» → **Conexión**. Cargá el número de bandeja y el teléfono de la línea, y guardá.
4. **Probar.** En el Resumen, «Probar las conexiones»: «Líneas» tiene que decir que atiende en las dos bandejas. Mandale un WhatsApp de prueba a la línea 4 desde un número que nunca le escribió: tiene que contestar el asistente. En Chatwoot, la conversación queda en la bandeja nueva.

Las líneas 1 (outreach frío) y 2 (equipo y facturas) **todavía no se conectan**: su trabajo se suma más adelante. Si se conectan antes, el asistente no contesta ahí (pasa al equipo con una nota).

Anotá en `docs/estado-paneles.md`, sección «Chatwoot», cómo quedó: sesión, bandeja, si el bot quedó asignado y el resultado de la prueba (sin números de teléfono).

### Tarea 12 · QA en producción de las líneas y los flujos (15/11)

Con todo publicado (asistente #21 y hub #86), revisar en producción lo que una sesión de código no puede ver. Todo con datos inventados y el teléfono de prueba. **No cambies fichas, tono ni etapas.** Los flujos que armes para probar dejalos apagados al terminar.

1. **Vercel:** la publicación del asistente quedó Ready y su log dice «aplicada 202611150011_lineas_y_flujos.sql».
2. **Hub, Comercial → Asistente de WhatsApp:**
   - se ven las 4 líneas y la 3 dice «Responde»;
   - en el Resumen, «Probar las conexiones»: «Líneas» atiende en la bandeja 1.
   - Copiá la tabla en `docs/estado-paneles.md`.
3. **Sin flujo:** desde un número que nunca le escribió a la línea 3, mandá «Hola, quería info de Lerma 439». Contesta la IA, como antes.
4. **Con flujo:**
   - En la línea 3 → Flujos, armá uno con el modelo «Presentación, brochure y un seguimiento». Subí una foto chica de prueba en un mensaje.
   - Probalo en Probar, con «Simular que no respondió».
   - Prendelo y escribí desde otro número nuevo. Tienen que llegar los mensajes en orden, con sus pausas y con la foto, una sola vez cada uno. En Chatwoot, la conversación no se tiene que abrir sola.
   - Respondé: pasa al equipo (nota interna, conversación abierta) y la etapa en el CRM pasa a «Seguimiento».
   - Con un tercer número, no respondas: al día siguiente a las 10 tiene que salir el seguimiento.
   - Apagá el flujo al terminar.
5. **Devolvérsela al asistente:** en una de las conversaciones que pasaron al equipo, en Chatwoot, poné **Pendiente** (sin escribir nada). Mandá otro mensaje desde ese número: tiene que contestar la IA y no volver a pasarla al equipo. Hasta el 15/11 eso fallaba después de un flujo que terminó; se arregló, pero falta verlo en producción.
6. **Pausar la línea 3** desde el hub: un mensaje nuevo pasa al equipo con la nota «La línea … está pausada». Reactivala.
7. **Pantallas:** anotá lo que se vea mal o confunda en la computadora y en el celular. En el editor de flujos del celular, arrastrar puede no andar: se usan las flechas.

Anotá todo en `docs/estado-paneles.md`, sección «Chatwoot», como «QA de líneas y flujos», sin teléfonos ni claves.

### Tarea 13 · Prender los avisos al responsable (15/11)

Desde el 15/11 el asistente avisa en el hub (la campanita y el celular) cuando le pasa una conversación al equipo ([`docs/avisos.md`](docs/avisos.md)). Hace falta una sola variable.

1. **Vercel → `mindlin-asistente` → Settings → Environment Variables:** `HUB_URL` = `https://mindlin-developers.vercel.app` (la dirección del hub; no es una clave). Production. Volver a publicar.
2. Abrí `https://mindlin-asistente.vercel.app/api/salud`: tiene que decir `"avisosAlHub": true`.
3. **Preguntale a Axel** a quién le llegan los avisos de los leads sin responsable en el CRM. Si quiere, en **Vercel → el proyecto del hub**, `ASISTENTE_AVISAR_SIN_RESPONSABLE` = los apodos separados por comas (por ejemplo `Mati,Tade`), y volver a publicar el hub.
4. **Probar** (con Axel, en la línea 3): escribí desde el teléfono de prueba «Quiero ir a ver el showroom». Cuando el asistente pase la conversación al equipo, al responsable del lead (o a los de la lista) le tiene que llegar «WhatsApp: … necesita al equipo» en la campanita del hub. Anotá el resultado en `docs/estado-paneles.md`, sin teléfonos.

### Tarea 14 · El usuario «Hub» de Chatwoot, para ver fotos y audios en el hub (15/11)

Desde el 15/11 el hub puede mostrar las fotos y los audios de cada conversación, pidiéndoselos a Chatwoot en el momento. Hace falta un usuario de Chatwoot para eso: el token del Agent Bot no puede leer el historial.

1. **Preguntale a Axel** con qué mail crear el usuario (puede ser uno de Mindlin que no use nadie para escribir, por ejemplo un alias).
2. En Chatwoot: **Configuración → Agentes → Agregar agente**, nombre **«Hub»**, rol **Administrador** (así ve todas las bandejas). Si Axel prefiere Agente, sumalo a **todas** las bandejas de las líneas.
3. Entrá con ese usuario (o pedile a Axel que entre) → perfil → **Configuración del perfil** → copiá el **Token de acceso**. **No lo pegues en ningún chat.**
4. En **Vercel → `mindlin-asistente` → Settings → Environment Variables**, cargá `CHATWOOT_HUB_TOKEN` con ese token (Production, como Secret) y volvé a publicar.
5. Abrí `https://mindlin-asistente.vercel.app/api/salud`: tiene que decir `"adjuntosEnElHub": true`.
6. **Probar:** mandá una foto desde el teléfono de prueba a la línea 3. En el hub, Asistente de WhatsApp → Conversaciones → esa conversación: la foto tiene que verse adentro. Anotá el resultado en `docs/estado-paneles.md`.

Ese usuario no escribe: solo lee. Si alguna vez se borra o cambia su contraseña, hay que volver a cargar el token.

### Tarea 15 · Probar en producción todo lo del 15/11 (15/11)

El 15/11 se publicaron las mejoras 1 a 8 de Axel y cuatro ideas traídas de DeskcommCRM, en los dos repos. Las pruebas automáticas dan bien, pero falta verlas andar de verdad: con WhatsApp, Chatwoot, la planilla y el hub de producción. Hacela después de las tareas 13 y 14 (los puntos 6 y 13 las necesitan).

Antes de empezar:

- **Todo con el teléfono de prueba y datos inventados.** Nada de leads reales.
- **No cambies fichas, tono, etapas ni reglas de seguimiento.** Lo que crees para probar (una campaña, un flujo, una respuesta rápida), apagalo o borralo al terminar.
- **Las filas de prueba del CRM no las borres:** anotá cuáles son y avisale a Axel.
- **Si un paso no se puede hacer** (por ejemplo, porque no hay otro número nuevo), saltealo y anotá por qué.

#### 1. El CRM es la planilla (decidido el 15/11)

El CRM del hub en producción es la planilla de Google, no una base de datos. El asistente escribe en esa misma planilla. Comprobalo **sin anotar ningún ID**:

- **Vercel → proyecto del hub → Settings → Environment Variables:** no tiene que existir `DATABASE_URL`. Si existe, **frená y avisale a Axel**: el hub estaría leyendo el CRM de otro lado y no vería lo que escribe el asistente.
- **La planilla del hub:** es la de `CRM_CONTACTOS_SHEET_ID` o, si esa no está, la de `CRM_SHEET_ID`.
- **La del asistente:** Vercel → `mindlin-asistente` → `CRM_SHEET_ID`. Tiene que ser la misma que la del hub. Si no, frená y avisale a Axel.

#### 2. Las publicaciones

- **Vercel → `mindlin-asistente` → Deployments:** la última está Ready y su log dice «aplicada» para las migraciones `202611150012_campanias.sql`, `202611150013_revisiones.sql` y `202611150014_baja.sql`, o que ya estaban.
- **El hub:** la última publicación está Ready.
- **`https://mindlin-asistente.vercel.app/api/salud`:** tiene que decir `"avisosAlHub": true` y `"adjuntosEnElHub": true`.

#### 3. Conversaciones en el hub (mejora 1)

1. Escribí a la línea 3 desde el teléfono de prueba y esperá la respuesta.
2. En el hub, **Comercial → Asistente de WhatsApp → línea 3 → Conversaciones:** tiene que aparecer, con quién la atiende y la línea. «Abrir en Chatwoot» lleva a esa conversación.
3. En el **CRM** del proyecto (Comercial → CRM), abrí la ficha de ese lead → **Chat:** se ven los mensajes de WhatsApp, marcados con su línea.

#### 4. El lead en la planilla

- El lead que dio de alta el asistente aparece en el **CRM del hub** (Base de datos), en «Contacto inicial».
- En la planilla tiene que estar en la pestaña «CRM Contactos». Su actividad, en «CRM Actividad».

#### 5. Campañas (mejora 2)

1. En la línea 3 → Inteligencia comercial → **Campañas**, creá «Prueba QA» con la frase «QA campaña prueba».
2. Desde un número que **nunca** le escribió a la línea, mandá «Hola, QA campaña prueba».
3. Tiene que pasar todo esto:
   - en **Conversaciones**, la conversación muestra la campaña;
   - en el CRM, el lead nuevo tiene la etiqueta «Campaña: Prueba QA»;
   - en el Resumen de la línea, la cuenta por campaña la suma.
4. Apagá o borrá la campaña.

#### 6. Avisos al responsable (mejora 4)

Es la prueba de la tarea 13. Si ya la hiciste, anotá el resultado acá también.

#### 7. Qué flujo vende (mejora 3) y Quiénes van (mejora 5)

1. En la línea 3 → **Flujos**, con un flujo de prueba prendido (el de la tarea 12 sirve), escribí desde un número nuevo.
2. En **«Quiénes van»** tiene que aparecer esa persona, con el paso en que está.
3. Probá **Sacar** en una y **Reiniciar** en otra. Se reinicia en la corrida de las 10 del día siguiente.
4. En **Flujos y Seguimientos**, debajo de cada flujo y de cada regla se ve «De … leads en 90 días: … llegaron a visita · … a negociación · … a reserva», aunque sean cero. **No** tiene que aparecer «No se puede medir qué vende cada uno».
5. Apagá el flujo.

#### 8. Responder desde el hub (mejora 6)

1. En el CRM, ficha del lead de prueba → **Chat**, con WhatsApp elegido, escribí «Prueba desde el hub» y mandalo. Abajo tiene que decir «Sale por WhatsApp (…): el asistente se corre».
2. Tiene que pasar todo esto:
   - llega al teléfono de prueba;
   - en Chatwoot se ve el mensaje y una nota interna «✍️ Lo escribió … desde el hub»;
   - la conversación queda **abierta** (la tiene el equipo).
3. Después ponela **Pendiente** en Chatwoot, para devolvérsela al asistente.

#### 9. Revisar respuestas (mejora 7)

1. En **Asistente de WhatsApp → Revisar** tienen que aparecer las respuestas del asistente de estas pruebas.
2. Marcá una como «mala» con la nota «prueba QA».
3. Tiene que salir de la lista y aparecer, con la nota, en «Malas de los últimos 30 días».
4. **No guardes ninguna como ejemplo:** eso cambia el tono.

#### 10. Fotos y audios en el hub (mejora 8)

1. Mandá una foto y un audio corto desde el teléfono de prueba.
2. Tienen que verse y escucharse adentro del hub, en dos lugares:
   - en Conversaciones;
   - en el Chat del lead del CRM.

#### 11. «No me escriban más» (`docs/baja.md`)

1. Desde un número de prueba que esté hablando con el asistente, mandá «No me escriban más».
2. Tiene que pasar todo esto:
   - el asistente contesta **una sola vez, corto**, sin ofrecer nada;
   - en el hub (Conversaciones y Chat del lead) aparece «Pidió que no le escriban»;
   - en el CRM, la actividad del lead dice «Pidió que no le escriban más por WhatsApp…»;
   - en el panel del asistente (`/panel`), el registro muestra «Pidió que no le escriban».
3. Si ese número tenía un flujo esperando, se corta: en «Quiénes van» ya no figura en curso.
4. Al rato, mandá «Hola de nuevo» desde el mismo número: contesta normal, pero al día siguiente a las 10 **no** le sale ningún seguimiento.

#### 12. Mensajes automáticos espaciados (`docs/seguimientos.md`, «Espaciados»)

1. En **Vercel → `mindlin-asistente` → Logs**, mirá la corrida de las 10 (13:00 UTC). Si mandó algo, la línea «seguimientos:» tiene que incluir `postergados`.
2. Si en esa corrida salieron dos o más mensajes (por ejemplo, los de los flujos de la tarea 12), en Chatwoot tiene que haber **unos segundos** entre uno y otro, no el mismo segundo.
3. **No actives reglas de seguimiento para probar esto:** eso lo decide Axel con Mindlin.

#### 13. «Te escribieron y nadie les contestó» (hub, Comercial → CRM)

1. Desde el teléfono de prueba, pedí hablar con una persona («Quiero hablar con alguien del equipo») hasta que el asistente pase la conversación al equipo.
2. Después mandá «¿Tienen cochera?» y **no respondas**.
3. Tiene que pasar todo esto:
   - en el **Dashboard** del CRM de Lerma 439, arriba, aparece la tarjeta «Te escribieron y nadie les contestó» con ese lead y hace cuánto;
   - tocarlo abre su chat en **Chats**;
   - en Chats, el lead dice «Espera respuesta · hace …»;
   - arriba aparece «⏳ 1 espera respuesta», que lo deja solo.
4. Respondele desde el hub: al volver a entrar, ya no aparece.
5. Repetí con un «Gracias» como último mensaje: no tiene que aparecer.

#### 14. Respuestas rápidas (hub, chat del lead)

1. En el Chat del lead de prueba, tocá **⚡** → **+ Nueva**.
2. Cargá:
   - título «Prueba QA»;
   - texto «¡Hola {nombre}! Esto es una prueba de {proyecto}.»;
   - destildá «Para todos los proyectos».
3. Guardá.
4. **En la planilla del CRM:** tiene que aparecer la pestaña «CRM Respuestas rápidas» con esa fila.
5. Usala dos veces:
   - con ⚡;
   - escribiendo «/prueba» y Enter.
6. En el mensaje tiene que quedar el nombre del lead y «Lerma 439». Mandala por WhatsApp: tiene que llegar así al teléfono.
7. Borrala (🗑 → «Sí, borrarla»). La fila desaparece de la planilla.

#### 15. En el celular

Abrí el hub desde el celular y mirá:

- **Comercial → CRM:** la tarjeta del Dashboard.
- **Chats:** la lista con «Espera respuesta».
- **Un chat:** abajo se ven todos los botones (adjuntar, ⚡, la IA y mandar), sin que ninguno quede afuera de la pantalla, y el panel de respuestas rápidas entra entero.
- **Asistente de WhatsApp:** Conversaciones y Revisar.

Anotá todo lo que se vea mal o confunda, con una captura sin datos de personas.

#### Cómo reportarlo

En `docs/estado-paneles.md`, una sección nueva: «QA del 15/11 (mejoras y DeskcommCRM)».

- Un renglón por punto, con ✅, ❌ o «no se pudo», y qué pasó.
- Los errores copiados tal cual, sin teléfonos ni claves.
- Al final, la lista de filas de prueba que quedaron en el CRM, para que Axel decida.

Si algo falla, no lo arregles en los paneles: lo corrige Claude en el código.

