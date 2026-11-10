# Instrucciones para la IA de paneles

Este archivo es para la IA que trabaja con **computer use** en la computadora de Axel: la que entra a paneles web (Hostinger, DonWeb, Vercel, Neon, Google, Chatwoot) y a la terminal. Claude escribe el código en este repo y no tiene acceso a esos paneles. Las dos trabajan en paralelo, cada una en lo suyo.

## Para pegarle a la IA (Axel)

> Sos la IA de paneles del proyecto «Asistente comercial de Mindlin». Entrá a https://github.com/axellaban/mindlin-asistente/blob/main/IA_DE_PANELES.md (con mi sesión de GitHub) y seguí ese archivo: hacé las tareas en orden, respetá las reglas y anotá lo que averigües en `docs/estado-paneles.md`. Si algo pide pagar, borrar, cambiar algo que ya funciona o un código de verificación, frená y preguntame.

## Qué es el proyecto, en dos líneas

Un asistente de IA que atiende por WhatsApp las consultas de los desarrollos de Mindlin Developers (piloto: Lerma 439). WhatsApp entra por **WAHA**, el equipo ve y responde todo en **Chatwoot** (los dos en un VPS de Hostinger, `https://chat.mindlindevelopers.com`), y el asistente es una app en **Vercel** con su base en **Neon** (Postgres). Detalle en [`docs/arquitectura.md`](docs/arquitectura.md).

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

## Las tareas

Las tareas 1, 2 y 3 se pueden hacer ya y en cualquier orden. La 4 depende de la 1. Las 5 y 6 dependen de la 4.

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

### Tarea 2 · Vercel y la base (hecha el 07/11)

Ya está todo: el proyecto en la cuenta de Vercel de Axel (`https://mindlin-asistente.vercel.app`) y la base **Neon** conectada. Supabase no se usa: el plan gratis estaba lleno.

- **Las tablas se crean solas en cada publicación** (`scripts/migrar.mjs`). No hay que pegar nada a mano.
- **Lo que queda de esta tarea** (actualizado el 10/11). Cada variable, en **Settings → Environment Variables**, para Production y Preview, como **Secret**:
  1. `OPENAI_API_KEY`: Axel eligió OpenAI. La crea en platform.openai.com (**API keys → Create new secret key**) y la carga directo en Vercel. Con esa clave el asistente responde y transcribe los audios. (Si algún día prefieren Claude, se carga `ANTHROPIC_API_KEY` y `ASISTENTE_PROVEEDOR=anthropic`: ver `docs/asistente.md`.)
  2. `PANEL_CLAVE`: la clave del panel del equipo (`/panel`). Que la elija Axel (larga, por ejemplo cuatro palabras al azar) y la guarde en su gestor de contraseñas. La comparte él con el equipo, no por este chat.
  3. `CRON_SECRET`: una clave al azar para los seguimientos. Se puede generar en la terminal con `openssl rand -hex 24` y pegarla directo en Vercel. Nadie más la necesita.
  4. Volver a publicar: **Deployments** → los tres puntos del último → **Redeploy**.
  5. En el registro de esa publicación (**Build Logs**), buscar la línea `migrar: base al día (3 migraciones).` y anotarla.
  6. En **Settings → Cron Jobs**, confirmar que aparece `/api/cron/seguimientos` cada 15 minutos. Si Vercel no deja publicar por el cron («Hobby accounts are limited to daily cron jobs»), anotalo y frená: el proyecto tiene que estar en el equipo con plan Pro.
  7. Abrir `/api/salud` y anotar la lista `faltan` y lo que dice `ia` (tiene que decir `"proveedor": "openai"` y `"audios": true`).
  8. Abrir `/panel`, entrar con tu nombre («IA de paneles») y la clave, y anotar si se ve el resumen. **No cambies las fichas ni el tono:** eso lo carga Mindlin.

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

### Tarea 4 · Instalar el servidor

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

### Tarea 5 · Chatwoot y la línea de WhatsApp

1. Abrí `https://chat.<dominio>`: aparece la configuración inicial. Completá nombre, empresa (Mindlin Developers), el mail de Axel y una contraseña. La contraseña tiene que tener **mayúscula, minúscula, número y símbolo**; guardala en el gestor de contraseñas de Axel. Destildá la suscripción a novedades y tocá **Finalizar configuración**.
2. En Chatwoot: tu perfil (abajo a la izquierda) → **Configuración del perfil** → copiá el **Token de acceso**.
3. En el servidor: `bash /opt/mindlin-asistente/servidor.sh conectar lerma "WhatsApp Lerma 439"`. Cuando lo pida, pegá el token: no se ve mientras lo pegás.
4. **Con Axel y el celular del chip:** en Chatwoot, abrí la conversación «Integración de WhatsApp» de esa bandeja. Ahí aparece el QR; si no aparece, escribí `start` y mandalo. Axel lo escanea desde WhatsApp → **Dispositivos vinculados → Vincular un dispositivo**.
5. Probá mandar un mensaje desde otro teléfono al número del chip: tiene que aparecer en Chatwoot. Anotá el resultado en la sección «Chatwoot».

### Tarea 6 · Conectar el asistente

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
- `cd /opt/mindlin-asistente && docker compose logs --tail 100 chatwoot-rails` muestra los últimos mensajes de un servicio. Los servicios son `caddy`, `chatwoot-rails`, `chatwoot-sidekiq`, `postgres`, `redis` y `waha`.
- Copiá el error en `docs/estado-paneles.md`. Antes de copiarlo, revisá que no tenga claves.

### Tarea 8 · Actualizar el instalador en el servidor (10/11)

El instalador ahora se ajusta solo a un servidor con 4 GB: crea el swap si falta (el del VPS ya está) y baja los hilos de Chatwoot para que entre todo. Hay que pasarlo al servidor y correr `actualizar`:

1. Copiá el `infra/servidor.sh` de `main` al servidor como `/opt/mindlin-asistente/servidor.sh` (igual que en la tarea 4).
2. `bash /opt/mindlin-asistente/servidor.sh actualizar`. Hace un respaldo antes, conserva las claves y los datos, y reinicia Chatwoot (un minuto sin bandeja: avisale a Axel antes si el equipo ya la usa).
3. Copiá la salida de `verificar` en «Servidor» (ahora también muestra el swap).
4. Para confirmar los hilos: `grep -E 'RAILS_MAX_THREADS|SIDEKIQ_CONCURRENCY' /opt/mindlin-asistente/chatwoot.env` tiene que decir 3 y 5.

Si en la instalación se cambiaron las imágenes a mano (por ejemplo, con el digest), `actualizar` vuelve a las versiones fijadas en el script (las mismas: Chatwoot 4.19.1 y WAHA 2026.10.1). Si hay otra diferencia, frená y anotala.
