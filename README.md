# Asistente comercial de IA · Mindlin Developers

El agente que atiende las consultas comerciales de los desarrollos por WhatsApp, con el tono de Mindlin, con el contexto de cada proyecto y conectado al CRM del hub. El equipo ve y responde todo desde Chatwoot.

- Arquitectura y decisiones: [`docs/arquitectura.md`](docs/arquitectura.md)
- Cómo funciona el asistente (el recorrido de un mensaje): [`docs/asistente.md`](docs/asistente.md)
- Lo que se confirmó probando con Chatwoot y WAHA: [`docs/chatwoot.md`](docs/chatwoot.md)
- Seguimientos (reglas, versiones, cron): [`docs/seguimientos.md`](docs/seguimientos.md)
- Panel del equipo (`/panel`): [`docs/panel.md`](docs/panel.md)
- API para configurar el asistente desde el hub: [`docs/api-hub.md`](docs/api-hub.md)
- De los bots de Kommo al asistente (qué quedó y dónde se configura): [`docs/kommo.md`](docs/kommo.md)
- Integración con el CRM de Mindlin (qué lee, qué escribe, qué haría falta del hub): [`docs/integracion-crm.md`](docs/integracion-crm.md)
- Qué falta y quién lo hace: [`PENDIENTES.md`](PENDIENTES.md)
- Instrucciones para la IA de paneles (Hostinger, Vercel, Neon, Google, Chatwoot): [`IA_DE_PANELES.md`](IA_DE_PANELES.md)
- Instalador del servidor (WAHA + Chatwoot): [`infra/`](infra/README.md)
- Base de datos (Neon/Postgres): [`db/migraciones/`](db/migraciones/), se aplican solas en cada publicación
- Reglas para trabajar en el repo: [`AGENTS.md`](AGENTS.md)

## Para desarrollar

```bash
npm install
npm run dev          # http://localhost:3000: estado de la configuración; /panel, el panel
npm run verificar    # tipos, pruebas y armado (lo mismo que corre GitHub en cada PR)
```

Las variables van en `.env.local` (ver `.env.example`). En producción, en Vercel.

Las pruebas contra Postgres se saltean sin base: para correrlas, `PRUEBA_DATABASE_URL=postgres://… npm test` (una base de prueba: se vacía). En GitHub corren siempre.
