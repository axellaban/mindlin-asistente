# Estado de los paneles

Lo completa la IA de paneles (ver [`IA_DE_PANELES.md`](../IA_DE_PANELES.md)). **Solo datos: nunca claves, contraseñas ni tokens.**

## DonWeb (tarea 1)

- Fecha: 07/11/2026.
- Qué hay contratado (planes): Cloud Server «N8N» (#4016076), activo hasta el 02/03/2027; Registro dominio .COM para `mindlindevelopers.com` (#4046656), activo hasta el 16/04/2028. No se mostró un hosting compartido contratado en «Web Hosting».
- Cloud Server / VPS: 1 vCPU Standard · 1 GB RAM · 10 GB Standard SSD contratados. El panel «Información» mostró 11,27 GB utilizados de 15 GB SSD (10 GB contratados + 5 GB para sistema operativo y otros); uso dentro del sistema no verificado. Incluye 1 TB/mes de transferencia y copia de seguridad Standard.
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

### Opción de menor costo para el piloto (07/11/2026)

Axel priorizó el precio y consultó si alcanza el VPS más bajo. Se cotizaron dos opciones inferiores a la de 16 GB:

| DonWeb, Backup Standard semanal, SSL gratuito y 1 TB de transferencia | Total anual mostrado (55 %) | Estimación anual con Cyber 60 % |
| --- | ---: | ---: |
| 2 vCPU · 4 GB RAM · 30 GB disponibles | ARS 137.631 | ARS 122.338 |
| 2 vCPU · 8 GB RAM · 60 GB disponibles | ARS 174.789 | ARS 155.368 |

Ambas configuraciones y el Backup Standard se comprobaron abriendo «Tu configuración». Los precios de lista anuales mostrados fueron ARS 305.846 y ARS 388.420, respectivamente. Los totales con el cupón siguen siendo estimaciones: no se aplicó en un carrito.

Para una sola línea con poca carga, 2 vCPU / 4 GB es el mínimo previsto por el instalador y puede servir para probar, con swap y monitoreo de memoria; no es la configuración holgada para producción. El VPS actual de 1 GB no alcanza. El KVM 1 de Hostinger tiene 1 vCPU / 4 GB / 50 GB: podría iniciar con uso mínimo, pero queda por debajo de las 2 vCPU previstas en el repo. Su catálogo oficial marca ARS 159.588 por un año o ARS 290.376 por dos años (ARS 12.099/mes). La opción DonWeb 2 vCPU / 4 GB anual resulta más económica por mes incluso con el 55 % ya mostrado, sin depender de que el cupón se acepte.

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

### Neon en producción

El PR #4 (`7ac1fad`) adaptó el código a Postgres. El 09/11 se verificó en Vercel que el despliegue de Production de ese commit está Ready, que el registro muestra `migrar: base al día (2 migraciones).` y que `/api/salud` no pide variables de base. Falta verificar la lectura y escritura de punta a punta junto con el CRM y la línea de prueba. Ver el avance de `CRM_SHEET_ID` en «Google».

La revisión de Storage mostró recursos ya usados por otras apps: `turniasalud` (Neon Free → turniasalud), `supabase-lorito` (Supabase Free → enviaunlorito), `convex-canary-island` (Convex Free → slack-clone), `loreado-login` (Upstash Redis Free → copiloto-mvp) y `playcanvas-engine-blob` (Blob → playcanvas-engine). Para Mindlin se creó un recurso nuevo dentro de la integración Neon existente.

### Seguimientos en Vercel (10/11/2026)

- `CRON_SECRET` guardado como Secret solo en Production de `mindlin-asistente`. Vercel ejecuta el cron en Production y agrega la autorización al llamar a la ruta.
- En [Cron Jobs](https://vercel.com/labans-projects-c5c64fdc/mindlin-asistente/schedules/cron-jobs), `/api/cron/seguimientos` figura activo cada 15 minutos (`*/15 * * * *`).
- La [republicación de `main` (`3efb2c9`)](https://vercel.com/labans-projects-c5c64fdc/mindlin-asistente/EymacWQQ29sYoikJGzDH4ZKij8oy) quedó Ready y Current. `/api/salud` devuelve `configuracionCompleta: true`, `faltan: []` y reporta Claude (`claude-opus-5-5`) con `audios: false`. La ruta del cron rechaza las solicitudes sin autorización con `401`. Queda pendiente validar un seguimiento con un contacto de prueba.

## Google (tarea 3)

- Cuenta de servicio creada (mail): `mindlin-asistente@mindlin-developers.iam.gserviceaccount.com`, creada el 07/11/2026 en el proyecto `mindlin-developers` de `axellaban@gmail.com`, sin roles de proyecto. Google Sheets API ya estaba habilitada. Axel autorizó la emisión de la clave JSON y su carga en Vercel; se emitió una sola clave.
- Variables cargadas en Vercel (sí / no): sí, `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY`, ambas como Secret en Production y Preview. Redeploy de Production listo y `/api/salud` ya no las incluye en `faltan`. Se eliminó la copia JSON descargada después de confirmar el guardado en Vercel; no quedó en la papelera ni en el repo.
- **09/11/2026:** la consola de `mindlin-developers` confirma que la cuenta de facturación «Mindlin Developers» está vinculada y que Google Sheets API y Google Drive API están habilitadas.
- Axel indicó que el repo del hub para el trabajo futuro es [`matimindlin111/mindlinhub`](https://github.com/matimindlin111/mindlinhub). Se verificó acceso de lectura a `main` y se consultó la referencia de la cola en `docs/configuracion.md`. La pantalla «Scoring de leads» del hub en producción confirma que el CRM todavía guarda en la planilla.
- Planilla del CRM: «Facturas Mindlin - cola de la app», propiedad de `mindlindevelopers.ia@gmail.com`, con pestañas «CRM Contactos» y «CRM Actividad». Axel autorizó compartirla con la cuenta de servicio del asistente como **Editor**. Google confirmó el permiso y el acceso general quedó Restringido. Se reutilizó el archivo del hub.
- `CRM_SHEET_ID` se guardó como Secret en **Production** en el proyecto `mindlin-asistente`. El endpoint `/api/salud` de producción confirmó que la publicación ya reconoce la variable. Queda la prueba de escritura de punta a punta con la línea de prueba.
- Decisión de Axel: contactos y actividad comercial del CRM en Sheets. Chats, reglas y demás datos internos del asistente en la base de datos. Todo archivo del hub en Google Drive debe quedar bajo `mindlindevelopers.ia@gmail.com`.
- Drive organizado bajo «Hub Mindlin»: `App de facturas` conserva su estructura interna y la planilla original en `Sistema (no tocar)`; `Automatizaciones` contiene el script `Facturas por mail`; `CRM` contiene el acceso directo `CRM - Contactos y actividad` a la misma planilla. Se comprobó el resultado en el Drive de Mindlin.

## Servidor (tarea 4)

- **Ampliación del DonWeb actual, cotización real del panel (07/11/2026):** se abrió «Información → Escalar recursos» del VPS #4016076 y se llegó al resumen previo a «Ir a pagar». Subir de 1 GB a 4 GB de RAM también elevó las vCPU de 1 a 2 automáticamente. Conservando 1 TB de transferencia y Backup Standard semanal, el panel mostró:

  | Configuración nueva | Diferencia a pagar ahora, hasta el 02/03/2027 | Nuevo costo semestral | Equivalente mensual del nuevo costo |
  | --- | ---: | ---: | ---: |
  | 2 vCPU · 4 GB RAM · 30 GB SSD | ARS 53.407,52 | ARS 152.923,20 | ARS 25.487,20 |
  | 2 vCPU · 4 GB RAM · 50 GB SSD | ARS 61.316,98 | ARS 165.372,00 | ARS 27.562,00 |

  Son importes mostrados para ampliar el contrato existente, distintos de una contratación nueva con promoción. El costo actual usado por el resumen fue ARS 68.864,40 por semestre. No se verificó una tarifa anual o de 24 meses para esa ampliación ni impuestos adicionales fuera del resumen. **No se pulsó «Ir a pagar», no se generó una orden ni se amplió el VPS**; se canceló el configurador y se verificaron los recursos originales. Capturas locales: `evidencia/paneles-2026-11-07/donweb-ampliacion-2cpu-4gb-30gb.jpg` y `donweb-ampliacion-2cpu-4gb-50gb.jpg` (fuera del repo).
- Aclaración posterior a la elección (07/11/2026): Axel pidió justificar si DonWeb a 24 meses con los mismos recursos sería más caro. **No se confirmó una cotización equivalente de DonWeb a 24 meses. No afirmar que DonWeb fue descartado por menor calidad.** La recomendación inicial mezclaba capacidades y plazos distintos. La ampliación consultada arriba requiere menos desembolso inmediato que contratar Hostinger por 24 meses, pero su nuevo costo mensual equivalente es mayor que el de la oferta de Hostinger aportada por Axel; DonWeb ofrece 2 vCPU frente a 1 vCPU del KVM 1.
- Comparación más cercana comprobada en DonWeb: 2 vCPU / 4 GB RAM / 50 GB disponibles / 1 TB de transferencia / Backup Standard. Total de 12 meses mostrado: ARS 148.835 (55 %); lista anual ARS 330.744. Con Cyber 60 %, el cálculo es ARS 132.298, sin cupón aplicado en un carrito. No es idéntico al KVM 1, que tiene 1 vCPU. En el configurador, los intentos de subir RAM desde 1 GB con 1 vCPU no cambiaron el valor; su ayuda indica que la RAM depende de las vCPU. La configuración de 4 GB se pudo cotizar con 2 vCPU.
- El monto de Hostinger con recomendación sí está mostrado para 24 meses en la captura de Axel: ARS 232.300,80. Esto sustenta una oferta concreta para el piloto, pero no una conclusión general de superioridad de proveedor. Comparar también la ampliación del DonWeb existente antes de presentar al cliente un ahorro definitivo por cambiarse. No se proyectó una renovación de DonWeb sin verificarla ni se duplicó una promoción que excluye renovaciones.
- **Decisión de Axel (07/11/2026): Hostinger KVM 1 por 24 meses.** Axel indicó «compraremos kvm1» después de aportar una captura con su código de recomendación aplicado. Se registra la elección; no se creó una orden ni se pagó desde esta sesión.
- Oferta de la captura: **ARS 232.300,80 por 24 meses**, equivalente a **ARS 9.679,20/mes**. Recursos: 1 vCPU, 4 GB RAM, 50 GB NVMe y 4 TB de transferencia. Renovación publicada en esa captura: ARS 24.199/mes por el mismo plazo. El precio con recomendación debe conservarse al comprar; no es el precio público sin ese código.
- La captura también mostró KVM 2 con recomendación: 2 vCPU, 8 GB RAM, 100 GB NVMe y 8 TB de transferencia por ARS 332.140,80 / 24 meses (ARS 13.839,20/mes). Es ARS 4.160/mes más que KVM 1. Se comparó como alternativa con más margen, pero **Axel eligió KVM 1**.
- Alcance del KVM 1: piloto con una línea y pocas conversaciones simultáneas, dedicado a WAHA + Chatwoot y sus servicios. 4 GB es el mínimo de memoria previsto; requiere monitoreo y margen para actualizaciones. La especificación de 2 vCPU del README era una referencia de capacidad: se revisó `infra/servidor.sh` y no tiene una validación que impida instalar por tener una sola CPU. No se probó todavía la carga real en KVM 1.
- Preparación propuesta para el VPS nuevo: Ubuntu 24.04 LTS, instalación mínima, swap de 2 GB y revisión de concurrencia de Rails/Sidekiq para poca memoria. **El script actual no configura swap**; Claude debe preparar ese ajuste y actualizar la documentación de capacidad y proveedor. Panel debe seguir el instalador revisado, sin improvisar cambios en el servidor.
- **09/11/2026 · VPS comprado y verificado:** KVM 1 `srv2145105.hstgr.cloud`, IPv4 `187.53.99.210`, Brazil – Campinas, Ubuntu 24.04.5 LTS, 1 vCPU / 4 GB RAM / 50 GB NVMe. Se verificó acceso root por la consola web y por SSH con la huella del servidor. Docker 29.9.3 y Compose 5.7.0 activos; swap persistente de 2 GB.
- Respaldos: cron del VPS activo y último archivo local verificado con `gzip -t`. hPanel muestra backup semanal y anuncia la primera copia automática para el **16/11/2026**. WAHA y el puerto directo de Chatwoot están en loopback; Postgres y Redis quedan en la red de Docker. Se observaron los puertos públicos 22, 80 y 443.
- Axel autorizó el rol **Admin** para `axellaban@gmail.com`, limitado a este VPS. Hostinger pidió verificar de nuevo la cuenta dueña por correo antes de emitir la invitación. Axel pidió retomar este paso después.
- Instalador de `main` (`7ac1fad`) copiado y validado. Se usó la instalación probada de Mindlin con GOWS y la integración nativa de Chatwoot. Se tomó de Turnia la práctica de fijar el digest y conservar sesiones separadas. WAHA `devlikeapro/waha@sha256:1f7faeb0227ad5edb5711f7058bfce807ea65e5f92234af0778e4db140f6eb46`; Chatwoot `chatwoot/chatwoot@sha256:a0d571a3a2f78f4a4b1d7c21a53309c0184068d6021b3664ab37788faef04c1`. Secretos propios en `/opt/mindlin-asistente`.
- **Chatwoot publicado:** `https://chat.mindlindevelopers.com`. Se agregó en DonWeb `A chat → 187.53.99.210` con TTL de 900 segundos. Google Public DNS y Cloudflare devolvieron la IP correcta. Tras comprobar que el alta inicial ya redirigía al inicio, se levantó Caddy. El sitio abrió con certificado válido de Let's Encrypt; `/api` devolvió HTTP 200, versión 4.19.1 y estado `ok` para cola y base. El resolvedor del VPS aún no devolvía la IP en la primera revisión; el HTTPS directo al VPS con el nombre del certificado validó correctamente.
- Salida de `servidor.sh verificar`:

```
Activos: caddy, chatwoot-rails, chatwoot-sidekiq, postgres, redis, waha.
Chatwoot 4.19.1 por HTTPS, cola y base ok. WAHA 2026.10.1 en puerto local.
Sesión default: SCAN_QR_CODE. Pendiente el vínculo desde el celular de prueba.
Recursos antes de publicar Caddy: 1722 de 3915 MB RAM usados y 38 GB libres de 48 GB.
Swap: 2 GB. Respaldo nocturno programado y primer respaldo comprobado.
```

### Reinstalación con Easypanel (tarea 9, 13/11/2026)

Hecha con Axel siguiendo `docs/easypanel.md`, sobre el mismo VPS (Hostinger KVM 1, `srv2145105.hstgr.cloud`, 187.53.99.210).

- **DNS (DonWeb):** se agregó `A waha.mindlindevelopers.com → 187.53.99.210`, TTL 900, igual que `chat`. No se creó el registro opcional `panel` ni se tocó ningún otro registro.
- **Reinstalación:** hPanel → Sistema operativo → «Ubuntu 24.04 with Easypanel». Axel puso la contraseña de root y confirmó el borrado. Tardó unos 3 minutos.
- **Firewall de Hostinger:** no hay ninguna regla creada, así que no bloquea 22, 80, 443 ni 3000.
- **Easypanel:** v2.38.0, en español, usuario administrador creado por Axel. El panel quedó en `http://187.53.99.210:3000`, sin dominio propio.
- **Servicio:** proyecto `mindlin`, servicio Compose `asistente` con `infra/easypanel/docker-compose.yml` de `main` (commit `777e85d`, 137 líneas) en Fuente: Inline. En Entorno, las nueve variables (dos dominios, dos de hilos y las cinco claves) con «Crear archivo .env» prendido.
- **Implementación:** la primera tardó 2 minutos. Los cinco contenedores quedaron corriendo.
- **Dominios:** `chat.mindlindevelopers.com` → `chatwoot-rails:3000` y `waha.mindlindevelopers.com` → `waha:3000`, los dos con HTTPS y certificado emitido por Easypanel.
- **Comprobaciones por HTTPS:** `chat…/api` devolvió `{"version":"4.19.1","queue_services":"ok","data_services":"ok"}` y `waha…/health` devolvió `401 Unauthorized`, que es lo esperado con la clave activa.
- **Chatwoot:** cuenta 1 «Mindlin Developers», alta hecha por Axel.
- **Línea:** `conectar default "WhatsApp Lerma 439"` creó la sesión en WAHA, la bandeja 1 y la conexión WAHA → Chatwoot. Axel escaneó el QR y la sesión pasó `STARTING` → `SCAN_QR_CODE` → `WORKING` a las 13:07, vinculada al número del chip.
- **Recepción probada:** los mensajes mandados desde otro teléfono entraron en la bandeja (conversación 2, tres mensajes entre las 13:09 y las 13:27).

Salida de `bash /root/servidor.sh easypanel` (verificar):

```
Creando 2 GB de swap (/swapfile)
  ✓ Swap de 2 GB activo (queda configurado para cada arranque)
  ✓ Proyecto de Easypanel: mindlin_asistente · Chatwoot en chat.mindlindevelopers.com · WAHA en waha.mindlindevelopers.com
  ✓ Respaldo de las bases programado todas las noches a las 3

Contenedores
  ✓ chatwoot-rails
  ✓ chatwoot-sidekiq
  ✓ postgres
  ✓ redis
  ✓ waha

Servicios
  ✓ Chatwoot 4.19.1
  ✓ WAHA 2026.10.1

HTTPS
  ✓ https://chat.mindlindevelopers.com responde con certificado válido

Líneas de WhatsApp
  (todavía no hay ninguna: bash servidor.sh conectar)

Recursos
  RAM: 1865 MB usados de 3915 MB
  Swap: 0 MB usados de 2047 MB
  Disco: 13G usados de 48G (35G libre)

  ✓ Todo en orden.
```

(Se corrió antes de `conectar`; por eso la sección de líneas figura vacía.)

#### Lo que salió distinto de la guía

1. En hPanel, la plantilla de Easypanel no está en la pestaña «Aplicaciones» sino en **«Panel de control»**.
2. Los dominios creados después de la primera implementación no los tomó el proxy: `chat…` devolvía «Service is not reachable» con Chatwoot sano por dentro. Se resolvió **volviendo a implementar**. Conviene crear los dominios y después implementar, o implementar de nuevo al final.
3. Easypanel crea solo un dominio por defecto, `mindlin-asistente.7qcwuq.easypanel.host → mindlin_asistente:80`, que no apunta a ningún servicio del Compose. Se dejó como está.
4. `servidor.sh generar` no se pudo usar en ese momento porque el instalador todavía no estaba en el servidor (el repo es privado, así que no se puede bajar con `curl` desde el VPS). Las cinco claves se generaron en la consola con los mismos comandos del script (`openssl rand -hex`, largos 24, 24, 64, 24 y 16) y se pegaron directo en el Entorno de Easypanel. Después el archivo se pasó con `cat > /root/servidor.sh` y un pegado desde «Copy raw file» de GitHub; el `md5sum` coincide con el de `main` salvo un salto de línea final de más.
5. Por indicación de Axel, no se pausó el asistente desde el hub antes del paso del bot.

#### Pendiente para cerrar la tarea 9

`servidor.sh bot` se corrió con la bandeja 1 y `https://mindlin-asistente.vercel.app`, y Axel cargó las cuatro variables en Vercel. **Falta volver a publicar en Vercel:** mientras tanto sigue sirviendo el despliegue anterior, con el token y el secreto del Chatwoot viejo. Por eso Chatwoot anotó en la conversación 2 «Conversation was marked open by system due to an error with the agent bot» y el asistente no contestó ninguno de los tres mensajes de prueba. `/api/salud` devuelve `configuracionCompleta: true`, pero eso solo comprueba que las variables existan, no que sean las nuevas.

Dato para la próxima: el proyecto `mindlin-asistente` no aparece en Vercel desde la cuenta `axellaban@gmail.com` ni en «laban's projects» ni en «Grego», aunque `mindlin-asistente.vercel.app` responde. Falta confirmar con Axel en qué cuenta o equipo está.

### Vercel después de la mudanza de cuenta (13/11/2026)

El 13/11, con el servidor ya andando, Axel movió el proyecto `mindlin-asistente` de Vercel al equipo **`mindlin-developers-ia`** (cuenta `mindlindevelopers.ia@gmail.com`), que está en **plan Hobby**. El objetivo es que el hub y sus proyectos queden bajo las cuentas de Mindlin. Eso destapó dos límites del plan, uno detrás del otro:

1. **Cron.** Vercel rechazó la publicación: «Hobby accounts are limited to daily cron jobs. This cron expression (`*/15 * * * *`) would run more than once per day.» Se resolvió con el PR #17, que pasó el cron de seguimientos a `0 13 * * *` (las 10 de Buenos Aires). Es reversible si el proyecto vuelve a un plan Pro.
2. **Autor del commit.** Con el cron ya diario, la publicación de `main` (`b80d9f5`) quedó en estado **Blocked**: «The deployment was blocked because the commit author did not have contributing access to the project on Vercel. The Hobby Plan does not support collaboration for private repositories.» En Hobby con repositorio privado, Vercel solo publica los commits firmados por la cuenta dueña; acá los firman `axellaban` y Claude. Ser colaborador en GitHub no alcanza: el permiso que mira Vercel es el de su propio equipo, y un equipo Hobby no admite miembros.

Axel decidió **hacer público el repositorio** para destrabarlo, en vez de pagar Pro o devolver el proyecto al equipo anterior. Se revisó el repo y su historial reciente: no hay claves, tokens ni archivos `.env` versionados, en línea con la regla del repo. Sí quedan a la vista datos de infraestructura: la IP y el nombre del VPS, los dominios, las cuentas de correo y los identificadores de Neon y Vercel.

Estado de las variables en la cuenta nueva: las cuatro de Chatwoot (`CHATWOOT_URL`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_BOT_TOKEN`, `CHATWOOT_WEBHOOK_SECRET`) figuran actualizadas el 13/11 alrededor de las 15:20, en Production. Las de Neon sobrevivieron la mudanza (`DATABASE_URL_UNPOOLED`, `PGHOST`, `PGPASSWORD`, `NEON_PROJECT_ID` y las demás, en Production y Preview).

**Pendiente:** que salga una publicación en Ready con esas variables. Hasta entonces producción sigue sirviendo un despliegue anterior a la carga, el Agent Bot usa las credenciales del Chatwoot viejo y Chatwoot anota «Conversation was marked open by system due to an error with the agent bot». Los mensajes entrantes sí llegan a la bandeja; lo único que falta es la respuesta del asistente.

## Chatwoot (tareas 5 a 7)

- Cuenta administradora: `mindlindevelopers.ia@gmail.com`, cuenta Chatwoot 3 «Mindlin Developers». Alta completada, panel en español con zona horaria de Buenos Aires.
- Línea de prueba: `default`, bandeja 1 «WhatsApp Lerma 439». Integración WAHA–Chatwoot creada. Pasó de `SCAN_QR_CODE` a `FAILED` sin una cuenta vinculada. Generar un QR fresco cuando esté disponible el celular de prueba. La conversación «Integración de WhatsApp» aparece dentro de «Sin asignar».
- Prueba de mensaje desde otro teléfono: pendiente del escaneo y de confirmar que WAHA pasa a `WORKING` con la cuenta esperada.
- Asistente: Agent Bot 1 «Asistente Mindlin» creado en la cuenta 3, con destino al webhook de producción. Configuración guardada en el VPS con permisos `600`. Axel autorizó y Vercel guardó `CHATWOOT_URL`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_BOT_TOKEN` y `CHATWOOT_WEBHOOK_SECRET` como Secrets de **Production** en `mindlin-asistente`. El redeploy del `main` vigente espera verificación de identidad. El bot sigue sin asignar a la bandeja hasta verificar el webhook y el proveedor de respuestas.
- Invitaciones de agentes: pendientes de definir el equipo y el correo de envío.

### Prueba de la línea Lerma 439 (10/11/2026)

- Se reinició la sesión `default` sin vincular y Axel escaneó el QR en Chatwoot. WAHA quedó en `WORKING` y el mensaje de prueba entró en la bandeja `WhatsApp Lerma 439`.
- El webhook de Production devolvió `401` a un aviso sin firma y `200` con `accion: ignorar` a un aviso de prueba firmado.
- OpenAI quedó activo en Production (`gpt-6.1-sol`). El simulador respondió y un envío puntual con el token del Agent Bot desde el VPS llegó a WhatsApp. WAHA confirmó `READ`.
- Con autorización de Axel, se reenvió al webhook un único mensaje entrante de la conversación de prueba, junto con el mensaje anterior del bot para darle contexto. El webhook devolvió `accion: responder`, el asistente anotó el interés y el panel mostró un contacto de CRM vinculado. Al mandar la respuesta, Vercel registró `Chatwoot respondió 401 en /2/messages`.
- Se reprodujo el problema con una lectura de la misma conversación y la misma credencial. `api_access_token` dio `200` contra Chatwoot local y `401` contra la URL pública. `Authorization: Bearer` dio `200` contra la URL pública.
- El [PR #12](https://github.com/axellaban/mindlin-asistente/pull/12) corrigió el encabezado. Tras publicar `116c585`, se reenvió un mensaje nuevo de la misma conversación de prueba. El webhook generó y mandó una respuesta del Agent Bot. Chatwoot la marcó `delivered` y WAHA confirmó `DEVICE`. El Agent Bot sigue sin asignar a la bandeja.

### Prueba de punta a punta (Easypanel) · 13/11/2026

Tarea 10, hecha con Axel sobre el servidor nuevo. **Resultado: el asistente atiende por WhatsApp de punta a punta.** Todo con datos inventados.

**Conexiones, antes de la prueba (17:00).** Dos cosas en rojo: el CRM y un aviso de Chatwoot.

| Qué | Estado | Detalle |
| --- | --- | --- |
| Chatwoot | ⚠️ Revisar | Responde, pero no se pudo confirmar el token del Agent Bot: 404 `{"error":"Resource could not be found"}` |
| Base de datos | ✅ | Responde, y el asistente está prendido. |
| Mensajes de WhatsApp | ✅ | El último llegó a las 16:42 (conversación 2). |
| Respuestas del asistente | ⚠️ Revisar | Todavía no respondió ninguna. |
| Seguimientos | ⚠️ Revisar | Corren una vez por día, a las 10, pero no hay ninguna regla en uso. |
| CRM (planilla) | ❌ No anda | Las columnas no son las que espera el asistente. |
| IA | ✅ | OpenAI (gpt-6.1-sol), 2,6 segundos. |

**Lo que se corrigió para destrabarla**

1. **La planilla del CRM.** En «CRM Contactos», la columna B decía `Proyecto` y las AC y AD estaban vacías. Se comprobó antes en el repo del hub (`lib/crm/modelo.ts`, `COLUMNAS_CONTACTOS`) que espera exactamente `Proyectos` (B), `Hora próximo paso` (AC) y `Tags` (AD), y que lee la planilla **por posición**: `lib/google/pestania.ts` solo reescribe los títulos si la fila está vacía o es un prefijo de los esperados, así que renombrar no lo afecta. Se corrigieron esas tres celdas de la fila 1 y nada más: ninguna fila de datos se tocó. Conexiones pasó a ✅.
2. **`CHATWOOT_ACCOUNT_ID`.** Se volvió a cargar en `1` (la cuenta del Chatwoot nuevo; la del anterior era la 3) y se republicó. No cambió el aviso de Chatwoot, así que no era eso.

**El aviso de Chatwoot es un falso positivo del chequeo, no un problema de configuración.** `lib/chequeo.ts` prueba el token con un POST a `/api/v1/accounts/<cuenta>/conversations/0/toggle_status` y da por buena la respuesta solo si el 404 menciona «conversation» o «account». Chatwoot 4.19.1 contesta `{"error":"Resource could not be found"}`, que no dice ninguna de las dos, y cae en el aviso genérico. Un token inválido daría 401, que el chequeo sí distingue. La prueba de punta a punta confirma que el token anda. **Para Claude: alcanza con aceptar también ese texto.**

**La prueba, paso por paso**

| Hora | Qué se mandó | Qué pasó |
| --- | --- | --- |
| 17:13 | «info de lerma» (conversación 2, en Pendiente) | Contestó en el momento, con la ficha bien usada: ubicación, estado de obra, 1 y 2 ambientes desde USD 88.000 y 105.000, aporte inicial y 24 cuotas por CAC, y repreguntó. Apareció una sola vez: no hubo eco ni se abrió la conversación. |
| 17:14 | «Soy Juan Prueba, busco 2 ambientes para invertir» | Contestó que lo anotó y preguntó presupuesto. En el CRM quedó el contacto `cmwb5wcob9uz6`, proyecto `lerma-439`, origen WhatsApp, etapa **Seguimiento**. El contacto ya existía de la prueba del 10/11, así que el «Alta por WhatsApp» tiene esa fecha. |
| 17:15 | «¿Puedo ir a ver el showroom esta semana?» | Movió la etapa a **Visita / reunión** (queda el «Cambio de etapa» en CRM Actividad) y **pasó la conversación al equipo**, con una nota interna correcta: qué pide, qué se informó y qué no se prometió. |
| 17:16 | «Prefiero hablar con alguien del equipo» | **No contestó**, que es lo esperado: ya la tenía el equipo. |
| 17:20 | Mensaje desde un número que nunca había escrito | Entró como **conversación 3** y el asistente contestó a las 17:21, sin que nadie tocara nada. Chatwoot la muestra como «gestionada por Asistente Mindlin». |

**Conexiones, después (17:23).** Igual que antes salvo las dos que importaban:

| Qué | Estado | Detalle |
| --- | --- | --- |
| Mensajes de WhatsApp | ✅ | El último llegó a las 17:20 (conversación 3). |
| **Respuestas del asistente** | **✅** | **La última salió el 13/11, 17:21 (conversación 3).** |
| CRM (planilla) | ✅ | La planilla responde y sus columnas son las que espera el asistente. |
| IA | ✅ | OpenAI (gpt-6.1-sol), 1,3 segundos. |

**Lo que hay que saber para usarlo**

- El asistente solo atiende conversaciones **pendientes**. Si alguien del equipo escribe desde Chatwoot, se corre a propósito y la conversación queda abierta: para devolvérsela hay que marcarla **pendiente**. Pasó varias veces durante la prueba y parecía que el bot no andaba.
- Un número nuevo entra siempre como conversación pendiente, así que va derecho al asistente.

**Para Axel**

- La fila de prueba del CRM es el contacto **`cmwb5wcob9uz6`**, hoy en etapa «Visita / reunión». No se borró: decidí vos si se elimina o se pasa a «Descartado».
- Hay **6 reglas de seguimiento cargadas pero archivadas**: mientras sigan así no sale ningún seguimiento. Se activan en `/panel` → Seguimientos.
- La pausa global quedó como estaba: «El asistente está respondiendo».

## Pendientes para retomar (09/11/2026)

- **Hostinger, diferido por Axel:** completar el código de la cuenta dueña y aceptar desde `axellaban@gmail.com` la invitación de Admin al VPS de Mindlin.
- **WhatsApp y webhook:** enlace y recepción de un mensaje verificados el 10/11. La configuración de Vercel está activa y el webhook validó la firma del aviso de prueba.
- **Proveedor de IA:** Axel indicó usar **OpenAI** en el asistente que corre en Vercel. El `main` publicado (`7ac1fad`) solo inicializa `modeloClaude` y lee `ANTHROPIC_API_KEY`; cargar una clave de OpenAI por sí sola no cambia el proveedor. Claude debe adaptar el cliente, las llamadas a herramientas y `/api/salud` para `OPENAI_API_KEY`, preservando el historial, las reglas y la derivación. Después se carga la clave en Production y se prueba con datos inventados antes de asignar el Agent Bot a la bandeja.
- **Prueba integral:** una vez publicados el webhook y el proveedor, probar WhatsApp, respuesta del asistente y escritura en el CRM con la línea y los datos de prueba acordados.
- **Equipo:** definir agentes y correo de envío de invitaciones. Falta validar ese flujo.
- **Acceso al servidor:** rotar las credenciales iniciales de la cuenta y de root desde sus pantallas de cambio de contraseña. Axel puede hacerlo cuando esté lista la delegación de Hostinger.

## Problemas

- 07/11/2026 · DonWeb: capacidad insuficiente del VPS actual. No se ejecutó el instalador.
- 07/11/2026 · Vercel / Supabase: «Unavailable - The following members have reached their 2 project Free Plan limit: axellaban. All active projects in Free Plan organizations count towards this limit.» Axel eligió Neon Free desde Vercel. Base vinculada y migraciones verificadas en producción el 09/11.
- 09/11/2026 · CRM: planilla y permiso de Editor confirmados, `CRM_SHEET_ID` activo en Production según `/api/salud`.
- 09/11/2026 · Hostinger: VPS comprobado, Chatwoot publicado por HTTPS y WAHA interno. Pendientes el código de Hostinger para delegar Admin, la vinculación de WhatsApp desde el celular de prueba y la configuración del agente en Vercel.
- Correo para invitaciones de Chatwoot pendiente de definir.
