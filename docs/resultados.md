# Qué flujo y qué seguimiento venden

Pedido de Axel (15/11, mejora 3): no alcanza con saber cuántos responden a cada flujo y a cada versión de un seguimiento. Hay que saber cuántos de esos leads **llegaron a una visita, a una negociación o a una reserva** en el CRM.

## Qué se mide

Para cada **flujo** y para cada **versión de cada seguimiento**, en los últimos 90 días:

- **leads**: a cuántas personas distintas les tocó (si a alguien le tocó dos veces, cuenta una);
- cuántos llegaron a **Visita / reunión**;
- cuántos llegaron a **Negociación**;
- cuántos llegaron a **Reserva**. Vendido también cuenta como Reserva.

«Llegó» quiere decir que su etapa está en ese lugar del embudo o más adelante. Se toma la más avanzada que se conoce:

- la etapa que tiene **hoy en el CRM**;
- la más alta a la que lo movió **el asistente**, que queda en su registro. Así cuenta el que pidió una visita y después se descartó.

Lo que el equipo movió a mano y después volvió atrás no se ve: el CRM guarda solo la etapa de hoy.

El lead se cruza con el CRM por el ID que anotó el asistente o por el teléfono. Si no está en el CRM, cuenta como lead, pero sin llegar a nada.

## Dónde se ve

En el hub, en Asistente de WhatsApp:
- en cada flujo, junto a «arrancaron» y «respondieron»;
- en cada versión de un seguimiento, junto a enviados y respuestas.

Así se compara qué presentación o qué mensaje trae más visitas, y no solo más respuestas.

## Cómo se calcula

Cuando se abre la pantalla, el hub pide `GET /api/hub/resultados` ([`api-hub.md`](api-hub.md)). El asistente lee las corridas de los flujos y los seguimientos enviados (su base), y la planilla del CRM entera (una lectura). Si el CRM no está conectado o no responde, lo dice; no muestra ceros como si nadie hubiera llegado.

## Código

- `lib/resultados.ts`: el orden del embudo y la cuenta (puro, con pruebas en `resultados.test.ts`).
- `lib/panel/datos.ts`, `leadsDeResultados`: los leads de cada flujo y de cada versión, con las etapas que les puso el asistente.
- `lib/hub/api.ts`, `resultados`.
