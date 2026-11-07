# Tareas de panel

Lo que se hace entrando a paneles web con usuario y contraseña. Lo hace la IA con computer use (o Axel). Claude no tiene acceso a estos paneles.

## Reglas para todas las tareas

- **Ninguna clave va al chat, al repo ni a un PR.** Las claves se copian directo de un panel a otro (por ejemplo, de Google a Vercel → Settings → Environment Variables).
- **Frenar y preguntarle a Axel** antes de pagar algo, borrar algo o cambiar algo que ya está funcionando (en DonWeb puede haber sitios o correos en uso).
- **Al terminar cada tarea:** marcarla en `PENDIENTES.md` (o pasarle a Axel el resultado para que lo anote) con los datos que pide la sección, **nunca claves**.

## 1. Revisar DonWeb (solo mirar, sin cambiar nada)

Queremos saber si el servidor de Mindlin sirve para correr WAHA y Chatwoot.

Anotar:

1. **Qué tienen contratado:** hosting compartido, Cloud Server / VPS, dominios, correo. Nombre de cada plan.
2. **Si hay un Cloud Server o VPS:**
   - vCPU, RAM y disco (total y libre);
   - sistema operativo y versión (por ejemplo, Ubuntu 22.04);
   - IP pública y ubicación;
   - si hay acceso root: por SSH, por consola web, o los dos;
   - si tiene un panel instalado (Plesk, cPanel, Easypanel, otro);
   - qué está corriendo hoy (sitios, correos, apps), si se ve sin tocar nada.
3. **Dominio y DNS:** cuál es el dominio de Mindlin y dónde se administran sus DNS (DonWeb u otro proveedor).
4. **Precios:** el del plan actual y el del Cloud Server más chico con **4 GB de RAM o más**, por si hay que ampliar.

**Qué necesitamos:** un VPS con 4 GB de RAM o más, Ubuntu (22.04 o 24.04), acceso root y un subdominio para Chatwoot. Si es solo hosting compartido, no sirve: hay que contratar un Cloud Server.

## 2. Preparar el servidor (cuando Claude deje el instalador en `infra/`)

1. Crear el subdominio de Chatwoot (por ejemplo `chat.<dominio de Mindlin>`) apuntando a la IP del servidor.
2. Correr el instalador desde la consola o por SSH, siguiendo `infra/README.md`.
3. Avisar qué dijo la verificación del final.

## 3. Vercel y Supabase

1. **Decidir con Axel en qué cuenta de Vercel va.** La de Mindlin está conectada a la cuenta de GitHub suspendida.
2. Crear el proyecto importando `axellaban/mindlin-asistente`.
3. **Storage / Marketplace → Supabase:** crear la base en la región São Paulo y conectarla al proyecto. Vercel carga sola sus variables.
4. Cargar `ANTHROPIC_API_KEY` (Axel la genera en console.anthropic.com).
5. Abrir `https://<proyecto>.vercel.app/api/salud` y anotar la lista `faltan`, que tiene solo nombres de variables.

## 4. Cuenta de Google para el CRM

1. En Google Cloud (el proyecto del hub u otro), crear una cuenta de servicio nueva: `mindlin-asistente`. Habilitar la API de Google Sheets.
2. Crear una clave JSON y cargar en Vercel: `GOOGLE_SERVICE_ACCOUNT_EMAIL` (el mail de la cuenta) y `GOOGLE_PRIVATE_KEY` (la `private_key` del JSON, tal cual). Después, borrar el JSON de la computadora.
3. Compartir la planilla del CRM del hub con ese mail, como **Editor**.
4. Cargar en Vercel `CRM_SHEET_ID`: el ID de esa planilla, que es lo que está entre `/d/` y `/edit` en su dirección.

## 5. Chatwoot (cuando esté instalado)

1. Crear la cuenta de administrador y la cuenta «Mindlin Developers».
2. Conectar la línea de prueba (WAHA → Chatwoot) siguiendo `infra/README.md` y escanear el QR con el celular del chip de prueba.
3. Crear el Agent Bot y conectarlo a la bandeja de esa línea. El webhook es `https://<proyecto>.vercel.app/api/chatwoot/webhook?clave=<CHATWOOT_WEBHOOK_SECRET>`. La URL exacta la deja Claude cuando esté hecho.
4. Cargar en Vercel `CHATWOOT_URL`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_BOT_TOKEN` y `CHATWOOT_WEBHOOK_SECRET` (una clave larga al azar).
5. Invitar al equipo comercial como agentes.
