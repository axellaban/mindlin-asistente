# Instrucciones para la IA de paneles

Este archivo es para la IA que trabaja con **computer use** en la computadora de Axel: la que entra a paneles web (DonWeb, Vercel, Supabase, Google, Chatwoot) y a la terminal. Claude escribe el código en este repo y no tiene acceso a esos paneles. Las dos trabajan en paralelo, cada una en lo suyo.

## Para pegarle a la IA (Axel)

> Sos la IA de paneles del proyecto «Asistente comercial de Mindlin». Entrá a https://github.com/axellaban/mindlin-asistente/blob/main/IA_DE_PANELES.md (con mi sesión de GitHub) y seguí ese archivo: hacé las tareas en orden, respetá las reglas y anotá lo que averigües en `docs/estado-paneles.md`. Si algo pide pagar, borrar, cambiar algo que ya funciona o un código de verificación, frená y preguntame.

## Qué es el proyecto, en dos líneas

Un asistente de IA que atiende por WhatsApp las consultas de los desarrollos de Mindlin Developers (piloto: Lerma 439). WhatsApp entra por **WAHA**, el equipo ve y responde todo en **Chatwoot** (los dos en un servidor de DonWeb), y el asistente es una app en **Vercel** con su base en **Supabase**. Detalle en [`docs/arquitectura.md`](docs/arquitectura.md).

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

### Tarea 2 · Vercel y Supabase

1. **Preguntale a Axel en qué cuenta de Vercel va.** La de Mindlin está conectada a una cuenta de GitHub suspendida.
2. En Vercel: **Add New → Project** → importá `axellaban/mindlin-asistente` → **Deploy**, sin cambiar nada.
3. En el proyecto: **Storage** (o **Marketplace**) → **Supabase** → crear la base en la región **São Paulo** y conectarla al proyecto. Vercel carga solas sus variables.
4. **Crear las tablas.** Abrí la base en Supabase → **SQL Editor** → **New query**. Después, **uno por uno y en orden**, con cada archivo de [`supabase/migrations/`](supabase/migrations/) (hoy son `202611070001_base.sql` y `202611070002_mensajes.sql`):
   - abrilo en GitHub y tocá **Raw**;
   - copiá todo, pegalo en una consulta nueva y tocá **Run**.

   Cada uno tiene que decir *Success*. Se pueden correr dos veces sin problema. Anotá cuáles aplicaste.
5. `ANTHROPIC_API_KEY`: Axel la crea en console.anthropic.com y la carga en Vercel (**Settings → Environment Variables**, para Production y Preview).
6. Volvé a publicar (**Deployments** → los tres puntos del último → **Redeploy**) y abrí `https://<proyecto>.vercel.app/api/salud`. Anotá la dirección del proyecto y la lista `faltan` (son solo nombres) en la sección «Vercel y Supabase».

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
