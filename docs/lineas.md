# Líneas de WhatsApp

Desde el 15/11 el asistente maneja varias líneas. Cada número de WhatsApp es una sesión de WAHA y una **bandeja** de Chatwoot. El asistente sabe de qué línea es cada mensaje por la bandeja del aviso. Código: `lib/lineas.ts`; en la base, la tabla `lineas` (migración `202611150011`).

## Las cuatro que pidió Mindlin

| # | Línea | Tipo | Qué hace el asistente |
| --- | --- | --- | --- |
| 1 | Outreach frío | `outreach_frio` | Nada todavía: tendrá su propio panel, y Mindlin va a pasar qué incorporar. Si alguien responde ahí, la conversación pasa al equipo con una nota. |
| 2 | Equipo: facturas y outreach cálido | `equipo` | Nada todavía: es la migración del bot de Telegram (facturas, recibos, presupuestos, consultas del hub) más el outreach a contactos conocidos. **Va al final.** Mientras tanto, pasa al equipo. |
| 3 | Leads entrantes | `entrada` | La que ya andaba: bandeja 1 «WhatsApp Lerma 439». Responde la IA o un flujo. |
| 4 | Leads entrantes 2 | `entrada` | Igual que la 3, para otra campaña o zona. Falta conectarla (ver «Sumar una línea»). |

## Qué es compartido y qué es de cada línea

Lo compartido es lo que sabe Mindlin. Lo de cada línea es cómo atiende.

- **Compartido entre todas:** las fichas de los proyectos, «Sobre la empresa», objeciones, el horario del equipo, los ejemplos y las etapas automáticas (el embudo del CRM es uno solo).
- **De cada línea:**
  - si está **pausada**: cada conversación nueva pasa al equipo y no salen seguimientos ni flujos;
  - el modo **«presenta y pasa»**, que antes era uno solo, en el tono;
  - sus **instrucciones**: lo que el asistente tiene que saber de esa línea, por ejemplo de qué campaña vienen. Van en las instrucciones de la IA, después del tono;
  - qué **proyectos** atiende (sin elegir ninguno, todos los activos);
  - sus **flujos** ([`flujos.md`](flujos.md));
  - sus **seguimientos**: una regla puede valer para una sola línea o para todas. Va primero la de la línea y, dentro de cada una, la del proyecto.

En el hub, adentro de cada línea aparecen todas las solapas. Lo compartido lleva la marca «Vale para todas las líneas».

## Cómo decide qué hacer con un mensaje (lib/webhook.ts)

1. Busca la línea por la bandeja del aviso. Si el aviso no trae bandeja (no pasa con Chatwoot 4.19), usa la línea por defecto, que es la 3.
2. **La bandeja no es de ninguna línea:** no contesta la IA. La conversación pasa al equipo con una nota que explica cómo asignarla en el hub. Pasa, por ejemplo, si se conecta un número nuevo antes de cargar su bandeja.
3. **Es de outreach o del equipo:** pasa al equipo con una nota.
4. **El asistente está pausado entero, o esa línea está pausada:** pasa al equipo.
5. **Si no, la atiende:** con los proyectos y las instrucciones de esa línea y, si hay, su flujo.

Si no se pueden leer las líneas (falla la base), atiende como antes de las líneas, para no dejar a nadie sin respuesta.

## Sumar una línea (por ejemplo, la 4)

Lo hace la IA de paneles (tarea 11 de [`IA_DE_PANELES.md`](../IA_DE_PANELES.md)):

1. **En WAHA:** una sesión nueva con el número y el QR escaneado (`servidor.sh conectar <sesión> "<nombre de la bandeja>"` crea la sesión, la bandeja y la conexión con Chatwoot).
2. **En Chatwoot:** asignarle el Agent Bot «Asistente Mindlin» a esa bandeja, solo si es una línea de leads. A las otras no hace falta, pero si se lo asigna no pasa nada: pasan al equipo.
3. **En el hub:** Comercial → Asistente de WhatsApp → la línea → Conexión. Cargar el número de bandeja (se ve en Chatwoot, en Configuración → Bandejas, en la dirección: `/inboxes/2`) y el número de teléfono.
4. **Probar las conexiones** (en el Resumen): «Líneas» tiene que decir «Atiende en … (bandeja 2)».

Dos líneas no pueden tener la misma bandeja: la base no lo deja y el hub avisa cuál la tiene.

## Las conversaciones que ya había

Todas quedaron en la línea 3 (la migración las marca). Desde ahora cada conversación guarda su línea y su bandeja.
