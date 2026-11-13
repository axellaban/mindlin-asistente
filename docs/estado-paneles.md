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
- Instalador de `main` (`7ac1fad`) copiado y validado. Se usó la instalación probada de Mindlin con GOWS y la integración nativa de Chatwoot. Se tomó de Turnia la práctica de fijar el digest y conservar sesiones separadas. WAHA `devlikeapro/waha@sha256:1f7faeb0227ad5edb5711f7058bfce807ea65e5f92234af0778e4db140f6eb46`; Chatwoot `chatwoot/chatwoot@sha256:a0d571a3a2f78f4fa4b1d7c21a53309c0184068d6021b3664ab37788faef04c1` (corregido por Claude el 10/11: a la copia original le faltaba una «f»; es el digest de `v4.19.1` en Docker Hub y el que fija ahora `servidor.sh`). Secretos propios en `/opt/mindlin-asistente`.
- **Chatwoot publicado:** `https://chat.mindlindevelopers.com`. Se agregó en DonWeb `A chat → 187.53.99.210` con TTL de 900 segundos. Google Public DNS y Cloudflare devolvieron la IP correcta. Tras comprobar que el alta inicial ya redirigía al inicio, se levantó Caddy. El sitio abrió con certificado válido de Let's Encrypt; `/api` devolvió HTTP 200, versión 4.19.1 y estado `ok` para cola y base. El resolvedor del VPS aún no devolvía la IP en la primera revisión; el HTTPS directo al VPS con el nombre del certificado validó correctamente.
- Salida de `servidor.sh verificar`:

```
Activos: caddy, chatwoot-rails, chatwoot-sidekiq, postgres, redis, waha.
Chatwoot 4.19.1 por HTTPS, cola y base ok. WAHA 2026.10.1 en puerto local.
Sesión default: SCAN_QR_CODE. Pendiente el vínculo desde el celular de prueba.
Recursos antes de publicar Caddy: 1722 de 3915 MB RAM usados y 38 GB libres de 48 GB.
Swap: 2 GB. Respaldo nocturno programado y primer respaldo comprobado.
```

## Chatwoot (tareas 5 a 7)

- Cuenta administradora: `mindlindevelopers.ia@gmail.com`, cuenta Chatwoot 3 «Mindlin Developers». Alta completada, panel en español con zona horaria de Buenos Aires.
- Línea de prueba: `default`, bandeja 1 «WhatsApp Lerma 439». Integración WAHA–Chatwoot creada. Pasó de `SCAN_QR_CODE` a `FAILED` sin una cuenta vinculada. Generar un QR fresco cuando esté disponible el celular de prueba. La conversación «Integración de WhatsApp» aparece dentro de «Sin asignar».
- Prueba de mensaje desde otro teléfono: pendiente del escaneo y de confirmar que WAHA pasa a `WORKING` con la cuenta esperada.
- Asistente: Agent Bot 1 «Asistente Mindlin» creado en la cuenta 3, con destino al webhook de producción. Configuración guardada en el VPS con permisos `600`. Axel autorizó y Vercel guardó `CHATWOOT_URL`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_BOT_TOKEN` y `CHATWOOT_WEBHOOK_SECRET` como Secrets de **Production** en `mindlin-asistente`. El redeploy del `main` vigente espera verificación de identidad. El bot sigue sin asignar a la bandeja hasta verificar el webhook y el proveedor de respuestas.
- Invitaciones de agentes: pendientes de definir el equipo y el correo de envío.

## Pendientes para retomar (09/11/2026)

- **Hostinger, diferido por Axel:** completar el código de la cuenta dueña y aceptar desde `axellaban@gmail.com` la invitación de Admin al VPS de Mindlin.
- **WhatsApp:** generar un QR fresco con Axel y el celular del piloto listos. Confirmar `WORKING` y el número esperado; hacer la prueba desde otro teléfono.
- **Publicación y webhook:** completar la verificación de Vercel, confirmar que `/api/salud` reconoce las cuatro variables de Chatwoot y probar que el webhook acepta un evento inocuo firmado y rechaza uno sin firma.
- **Proveedor de IA:** Axel indicó usar **OpenAI** en el asistente que corre en Vercel. El `main` publicado (`7ac1fad`) solo inicializa `modeloClaude` y lee `ANTHROPIC_API_KEY`; cargar una clave de OpenAI por sí sola no cambia el proveedor. Claude debe adaptar el cliente, las llamadas a herramientas y `/api/salud` para `OPENAI_API_KEY`, preservando el historial, las reglas y la derivación. Después se carga la clave en Production y se prueba con datos inventados antes de asignar el Agent Bot a la bandeja. **Actualización 10/11 (Claude):** Axel cargó `ANTHROPIC_API_KEY` en Vercel y `/api/salud` ya la reconoce: se sigue con Claude y no hace falta adaptar el código a OpenAI.
- **Prueba integral:** una vez publicados el webhook y el proveedor, probar WhatsApp, respuesta del asistente y escritura en el CRM con la línea y los datos de prueba acordados.
- **Equipo:** definir agentes y correo de envío de invitaciones. Falta validar ese flujo.
- **Acceso al servidor:** rotar las credenciales iniciales de la cuenta y de root desde sus pantallas de cambio de contraseña. Axel puede hacerlo cuando esté lista la delegación de Hostinger.

## Problemas

- 07/11/2026 · DonWeb: capacidad insuficiente del VPS actual. No se ejecutó el instalador.
- 07/11/2026 · Vercel / Supabase: «Unavailable - The following members have reached their 2 project Free Plan limit: axellaban. All active projects in Free Plan organizations count towards this limit.» Axel eligió Neon Free desde Vercel. Base vinculada y migraciones verificadas en producción el 09/11.
- 09/11/2026 · CRM: planilla y permiso de Editor confirmados, `CRM_SHEET_ID` activo en Production según `/api/salud`.
- 09/11/2026 · Hostinger: VPS comprobado, Chatwoot publicado por HTTPS y WAHA interno. Pendientes el código de Hostinger para delegar Admin, la vinculación de WhatsApp desde el celular de prueba y la configuración del agente en Vercel.
- Correo para invitaciones de Chatwoot pendiente de definir.
