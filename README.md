# Asistente comercial de IA · Mindlin Developers

El agente que atiende las consultas comerciales de los desarrollos por WhatsApp, con el tono de Mindlin, con el contexto de cada proyecto y conectado al CRM del hub. El equipo ve y responde todo desde Chatwoot.

- Arquitectura y decisiones: [`docs/arquitectura.md`](docs/arquitectura.md)
- Qué falta y quién lo hace: [`PENDIENTES.md`](PENDIENTES.md)
- Tareas en paneles (DonWeb, Vercel, Google): [`docs/tareas-panel.md`](docs/tareas-panel.md)
- Reglas para trabajar en el repo: [`AGENTS.md`](AGENTS.md)

## Para desarrollar

```bash
npm install
npm run dev          # http://localhost:3000: estado de la configuración
npm run verificar    # tipos, pruebas y armado (lo mismo que corre GitHub en cada PR)
```

Las variables van en `.env.local` (ver `.env.example`). En producción, en Vercel.
