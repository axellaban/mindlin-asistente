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
- Cotización anterior: 2 vCPU, 4 GB de RAM y 30 GB de almacenamiento por ARS 157.233/año con 55 % de descuento. **Corrección:** el tipo de respaldo de esa cotización no se había comprobado. En la revisión posterior se detectó que el configurador preselecciona Backup Premium Diario; no debe tomarse aquel precio como una cotización con Backup Standard confirmado. Ver la comparación actualizada más abajo.

**Resultado:** el VPS actual no alcanza para el instalador de WAHA + Chatwoot (requiere 2 vCPU, al menos 4 GB RAM y 30 GB libres). Antes de instalar, Axel debe decidir si amplía este VPS o contrata uno aparte, confirmar qué corre hoy y elegir el subdominio. No se instaló software ni se modificó el servidor.

### Comparación DonWeb / Hostinger y promoción (07/11/2026)

Axel pidió comparar precios anuales y aceptó considerar una contratación de 24 meses. Solo se consultaron planes y se ajustó un configurador; no se compró ningún servicio.

- **DonWeb, cotización comprobada en el configurador:** 4 vCPU, 16 GB RAM, 60 GB disponibles, 1 TB de transferencia, Backup Standard semanal y SSL gratuito, sin licencias de panel. Pago anual mostrado: **ARS 259.591** con el descuento habitual del 55 %; precio de lista anual mostrado: ARS 576.868. Se abrió el resumen «Tu configuración» y se comprobó que decía «Copia de Seguridad Standard».
- **Promoción Cyber DonWeb:** código `DWSALE-26`, **60 % de descuento** en contrataciones anuales de Cloud, todas las configuraciones. Válida para pagos acreditados entre el 02/11/2026 00:00 y el 15/11/2026 23:59, hora argentina. Clientes nuevos y actuales; **no aplica a renovaciones**. Aplicando 60 % al precio de lista de la configuración anterior, el total estimado es **ARS 230.747 por el primer año**. Es un cálculo a partir del precio de lista y la promoción publicada: **no se aplicó el cupón en un carrito** y falta confirmar allí el total. No sumar el 60 % al 55 %.
- **Hostinger KVM 2:** 2 vCPU, 8 GB RAM, 100 GB NVMe. Catálogo oficial de la cuenta: primer año **ARS 241.188**, o primeros dos años **ARS 415.176** (equivale a ARS 17.299/mes). Renovación de 24 meses: ARS 753.576 (ARS 31.399/mes al precio actual). La página argentina publica 61 % de descuento para el período de 24 meses.
- **Hostinger KVM 4:** 4 vCPU, 16 GB RAM, 200 GB NVMe. Catálogo oficial: primer año **ARS 338.388**, o primeros dos años **ARS 580.776** (ARS 24.199/mes). Renovación de 24 meses: ARS 1.447.176 (ARS 60.299/mes al precio actual). La página argentina publica 69 % de descuento para 24 meses.
- Hostinger publica pago por adelantado y hasta 12 cuotas para Argentina. No se verificaron cuotas, impuestos ni un cupón adicional en una orden. Los totales de 12 y 24 meses se leyeron en el catálogo oficial de Hostinger (API `billing_catalog_list`, categoría VPS; importes en centavos convertidos a ARS); los de 24 meses también coinciden con su página pública. No hay fecha de vencimiento comprobada para esa oferta.

**Capacidad para los dos servicios:** las fuentes de Chatwoot difieren: la guía técnica dice mínimo 4 GB RAM y recomienda 4 núcleos, mientras la página de despliegue publica 8 GB mínimo y 16 GB recomendado. Para compartir servidor con WAHA, conviene presupuestar 8 a 16 GB RAM; 4 vCPU da más margen. El instalador del repo admite 2 vCPU / 4 GB como mínimo para el piloto, pero no debe confundirse con la recomendación para producción.

**Vercel / Neon:** Neon es la base del asistente, no un VPS. Vercel ya soporta contenedores y Daemons (beta), pero no ejecuta el instalador Docker Compose de este repo tal cual. Sus contenedores y Daemons no tienen almacenamiento local persistente, y los Daemons cobran memoria por hora de ejecución. Adaptar y separar todos los servicios es otra implementación; para la instalación actual se propone un VPS Linux en DonWeb o Hostinger. WAHA y Chatwoot pueden compartir ese VPS, conservando allí sesiones, adjuntos, Postgres y Redis.

Fuentes oficiales consultadas:

- [DonWeb: configurador](https://donweb.com/es-ar/cloud-server-vps) y [Cyber](https://donweb.com/es-ar/cybermonday).
- [Hostinger: VPS Argentina](https://www.hostinger.com/ar/vps-argentina), además del catálogo de la cuenta.
- [Chatwoot: requisitos técnicos](https://developers.chatwoot.com/self-hosted/deployment/requirements) y [despliegue](https://www.chatwoot.com/deploy).
- [Vercel: contenedores](https://vercel.com/kb/guide/does-vercel-support-docker-deployments) y [Daemons](https://vercel.com/docs/daemons).
- [WAHA: instalación](https://waha.devlike.pro/docs/how-to/install/).

## Vercel y base de datos (tarea 2)

- Cuenta de Vercel: `axellaban@gmail.com` (usuario `axellaban-1812`, equipo `laban's projects`, slug `labans-projects-c5c64fdc`). Elegida por Axel el 07/11/2026 para las primeras pruebas.
- Dirección del proyecto (`https://….vercel.app`): https://mindlin-asistente.vercel.app/ (desplegado por Axel, rama `main`, commit `c887dfbc86481ab8e71e04c60769db89bdd0ef9e`). Se volvió a publicar con las variables de Google el 07/11/2026: despliegue `BmkjxAeKDMXwPFyGqt8XdBNoki9V`, estado «Ready», Production.
- Supabase creada (región): no. El plan Free está bloqueado: el usuario `axellaban` alcanzó el límite de dos proyectos gratuitos. La confirmación de Pro mostró USD 35/mes totales, antes de excedentes e impuestos, e incluía la organización con `supabase-lorito`. No se aceptó el cobro ni se cambió el plan de esa base. Axel aclaró que su plan Pro es el de Vercel y pidió aprovechar las bases disponibles desde allí.
- Base elegida y creada: **Neon Free**, nombre `mindlin-asistente`, São Paulo (`gru1`), Auth desactivado y Realtime desactivado. Axel autorizó crearla desde su equipo de Vercel y dejar la adaptación del código para Claude. El panel confirmó la creación y la conexión del proyecto `mindlin-asistente` en Production y Preview. Plan mostrado: 1 GB por proyecto, hasta 2 CU / 8 GB RAM, 100 CU-horas por proyecto y máximo de 100 proyectos; sin tarjeta requerida. No se contrató Supabase Pro.
- Recurso en Vercel: [mindlin-asistente · Neon · proyectos conectados](https://vercel.com/labans-projects-c5c64fdc/~/integrations/neon/icfg_NtoOR4Y5MhCfzGCD8VdpNkOn/resources/storage/store_hybVeaAjqwqwib5Y/projects). Identificador del recurso: `store_hybVeaAjqwqwib5Y`. Neon ID: `shy-cloud-83860819`.
- Variables de Neon: la integración las cargó automáticamente como Secret en Production y Preview, entre ellas `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL` y `NEON_PROJECT_ID`. Las credenciales no se copiaron al repo ni al chat. No se activó la creación automática de ramas de base por despliegue.
- Migraciones aplicadas (cuáles, y el mensaje de cada una): ninguna. Claude debe revisar y aplicar las tablas a Neon al adaptar el proveedor. Los archivos existentes son `202611070001_base.sql` y `202611070002_mensajes.sql`; no se ejecutaron a ciegas sobre otro recurso.
- `/api/salud` → `faltan`: consulta del 07/11/2026; `ok: true`, `configuracionCompleta: false`.

```json
["ANTHROPIC_API_KEY", "CHATWOOT_URL", "CHATWOOT_ACCOUNT_ID", "CHATWOOT_BOT_TOKEN", "CHATWOOT_WEBHOOK_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRM_SHEET_ID", "CRON_SECRET"]
```

### Para Claude: cambio a Neon autorizado por Axel

La base está creada y conectada, pero **la app todavía usa el adaptador de Supabase** en `lib/datos/supabase.ts`. La conexión desde el panel no reemplaza ese código. El despliegue actual ignora `DATABASE_URL` y sigue pidiendo `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

Pendiente del dueño del código:

1. Implementar el almacén PostgreSQL/Neon detrás de la interfaz `Almacen` de `lib/datos/tipos.ts`, conservando el historial, las operaciones del agente y la deduplicación de mensajes.
2. Revisar y aplicar las migraciones en la base nueva, manteniendo el acceso exclusivo del servidor. La base debe tener sus propias tablas y datos de Mindlin.
3. Cambiar la selección del almacén y el chequeo de configuración para usar `DATABASE_URL`; actualizar `.env.example`, `docs/arquitectura.md`, `IA_DE_PANELES.md` y `PENDIENTES.md` conforme a la decisión de Axel.
4. Publicar y verificar una lectura/escritura de prueba con datos inventados. Hasta entonces, Neon está aprovisionado y vinculado, pero el asistente todavía no lo utiliza.
5. Resolver el supuesto de la planilla del CRM: Axel no tiene una identificada. Hay que validar si existe con Mindlin o acordar crearla; hoy `CRM_SHEET_ID` sigue faltando.

La revisión de Storage mostró recursos ya usados por otras apps: `turniasalud` (Neon Free → turniasalud), `supabase-lorito` (Supabase Free → enviaunlorito), `convex-canary-island` (Convex Free → slack-clone), `loreado-login` (Upstash Redis Free → copiloto-mvp) y `playcanvas-engine-blob` (Blob → playcanvas-engine). Para Mindlin se creó un recurso nuevo dentro de la integración Neon existente.

## Google (tarea 3)

- Cuenta de servicio creada (mail): `mindlin-asistente@mindlin-developers.iam.gserviceaccount.com`, creada el 07/11/2026 en el proyecto `mindlin-developers` de `axellaban@gmail.com`, sin roles de proyecto. Google Sheets API ya estaba habilitada. Axel autorizó la emisión de la clave JSON y su carga en Vercel; se emitió una sola clave.
- Planilla del CRM compartida como Editor (sí / no): no. Axel respondió «no se no tengo nada» al pedido de la planilla. Hay que validar con Mindlin si existe la planilla del hub o acordar crear una; no se creó ni compartió una planilla nueva.
- Variables cargadas en Vercel (sí / no): sí, `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY`, ambas como Secret en Production y Preview. Redeploy de Production listo y `/api/salud` ya no las incluye en `faltan`. Se eliminó la copia JSON descargada después de confirmar el guardado en Vercel; no quedó en la papelera ni en el repo.

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
- 07/11/2026 · Vercel / Supabase: «Unavailable - The following members have reached their 2 project Free Plan limit: axellaban. All active projects in Free Plan organizations count towards this limit.» No se confirmó Pro; Axel eligió Neon Free desde Vercel. Base creada y vinculada; falta la adaptación del código.
- 07/11/2026 · CRM: Axel no tiene identificada la planilla que el repo daba por existente. No se puede completar la conexión de Google Sheets sin resolverla.
- 07/11/2026 · Quedan pendientes las decisiones sobre capacidad del servidor, subdominio de Chatwoot y correo de invitaciones. La cuenta de Vercel y el proyecto de Google Cloud ya fueron elegidos por Axel en el chat.
