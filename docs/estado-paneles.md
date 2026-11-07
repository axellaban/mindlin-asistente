# Estado de los paneles

Lo completa la IA de paneles (ver [`IA_DE_PANELES.md`](../IA_DE_PANELES.md)). **Solo datos: nunca claves, contraseñas ni tokens.**

## DonWeb (tarea 1)

- Fecha: 07/11/2026.
- Qué hay contratado (planes): Cloud Server «N8N» (#4016076), activo hasta el 02/03/2027; Registro dominio .COM para `mindlindevelopers.com` (#4046656), activo hasta el 16/04/2028. No se mostró un hosting compartido contratado en «Web Hosting».
- Cloud Server / VPS: 1 vCPU Standard · 1 GB RAM · 10 GB Standard SSD contratados. Uso y espacio libre dentro del sistema no verificados. Incluye 1 TB/mes de transferencia y copia de seguridad Standard.
- Sistema operativo: Ubuntu 22.04, 64 bits, imagen `Ubuntu2204-64-min` («Instalación Mínima»).
- IP pública: `149.50.139.33` (IPv4).
- Acceso root (SSH / consola web): el panel informa usuario `root`, SSH por el puerto `5258` y consola VNC. No se probaron las credenciales ni se ingresó al sistema.
- Panel instalado y qué corre hoy: DonWeb informa instalación mínima y ninguna licencia. El nombre del servidor es «N8N», pero no se verificaron procesos, contenedores ni un panel dentro del VPS.
- Dominio de Mindlin y dónde están sus DNS: `mindlindevelopers.com`, registrado y administrado en DonWeb. La consulta DNS pública devuelve `ns1.donweb.com` y `ns2.donweb.com`. El dominio y `www` apuntan a `54.209.192.162`; los MX apuntan a Zoho (`mx.zoho.com`, `mx2.zoho.com`, `mx3.zoho.com`). No se cambiaron registros. El panel muestra otros cinco nameservers de DonWeb en su cabecera; se registran aquí los que devuelve la consulta pública.
- Precio del plan actual: ARS 68.864,40 por semestre, según «Pago y renovación» (consulta del 07/11/2026).
- Precio del Cloud Server más chico con 4 GB de RAM o más: el configurador público permite configurar recursos por separado. Para el mínimo requerido por este proyecto (2 vCPU, 4 GB de RAM, 30 GB de almacenamiento disponible, 1 TB/mes, Backup Standard, sin licencias), mostró ARS 20.382 con pago mensual y ARS 157.233 con pago anual promocional (55 % de descuento; precio anual sin descuento: ARS 349.406). Solo cotizado: no se contrató ni amplió ningún servicio. Fuente: [configurador de DonWeb](https://donweb.com/es-ar/cloud-server-vps), 07/11/2026.

**Resultado:** el VPS actual no alcanza para el instalador de WAHA + Chatwoot (requiere 2 vCPU, al menos 4 GB RAM y 30 GB libres). Antes de instalar, Axel debe decidir si amplía este VPS o contrata uno aparte, confirmar qué corre hoy y elegir el subdominio. No se instaló software ni se modificó el servidor.

## Vercel y Supabase (tarea 2)

- Cuenta de Vercel: `axellaban@gmail.com` (usuario `axellaban-1812`, equipo `laban's projects`, slug `labans-projects-c5c64fdc`). Elegida por Axel el 07/11/2026 para las primeras pruebas.
- Dirección del proyecto (`https://….vercel.app`): https://mindlin-asistente.vercel.app/ (desplegado por Axel; Vercel muestra «Ready», rama `main`, commit `c887dfbc86481ab8e71e04c60769db89bdd0ef9e`).
- Supabase creada (región): pendiente. Se preparó una base nueva `mindlin-asistente` en São Paulo (`gru1`), pero no se confirmó su creación. El plan Free está bloqueado: el usuario `axellaban` alcanzó el límite de dos proyectos gratuitos. La confirmación de Pro muestra USD 35/mes totales, antes de excedentes e impuestos, e incluye la organización con `supabase-lorito`. Se pidió decisión a Axel antes de generar el gasto o cambiar ese servicio existente.
- Migraciones aplicadas (cuáles, y el mensaje de cada una): ninguna; falta crear la base. Pendientes `202611070001_base.sql` y `202611070002_mensajes.sql`.
- `/api/salud` → `faltan`: consulta del 07/11/2026; `ok: true`, `configuracionCompleta: false`.

```json
["ANTHROPIC_API_KEY", "CHATWOOT_URL", "CHATWOOT_ACCOUNT_ID", "CHATWOOT_BOT_TOKEN", "CHATWOOT_WEBHOOK_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "CRM_SHEET_ID", "CRON_SECRET"]
```

## Google (tarea 3)

- Cuenta de servicio creada (mail): `mindlin-asistente@mindlin-developers.iam.gserviceaccount.com`, creada el 07/11/2026 en el proyecto `mindlin-developers` de `axellaban@gmail.com`, sin roles ni claves. Google Sheets API ya estaba habilitada. La clave JSON quedó preparada en el diálogo, sin emitir, pendiente de confirmación de Axel.
- Planilla del CRM compartida como Editor (sí / no): no. No se identificó la planilla del hub mediante las búsquedas en el Drive conectado; se pidió a Axel el enlace de la que contiene «CRM Contactos» y «CRM Actividad».
- Variables cargadas en Vercel (sí / no): no; pendiente de emitir la credencial y confirmar la planilla.

## Servidor (tarea 4)

- Subdominio de Chatwoot:
- Salida de `servidor.sh verificar`:

```
(pegar acá)
```

## Chatwoot (tareas 5 a 7)

- Cuenta de administrador creada (sí / no):
- Línea conectada y QR escaneado (sí / no):
- Prueba de mensaje desde otro teléfono (llegó / no llegó):
- Asistente conectado (`servidor.sh bot`) y variables en Vercel (sí / no):
- Agentes invitados y si llegaron los mails:

## Problemas

- 07/11/2026 · DonWeb: capacidad insuficiente del VPS actual. No se ejecutó el instalador.
- 07/11/2026 · Vercel / Supabase: «Unavailable - The following members have reached their 2 project Free Plan limit: axellaban. All active projects in Free Plan organizations count towards this limit.» Se dejó la alternativa Pro sin confirmar.
- 07/11/2026 · Quedan pendientes las decisiones sobre capacidad del servidor, subdominio de Chatwoot y correo de invitaciones. La cuenta de Vercel y el proyecto de Google Cloud ya fueron elegidos por Axel en el chat.
