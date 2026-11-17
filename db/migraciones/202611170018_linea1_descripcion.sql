-- La descripción de la línea 1 (outreach frío) decía que su panel «se suma más adelante». Desde el
-- 16/11 el panel está (hub → Asistente de WhatsApp → línea 1). Solo se cambia si nadie la editó.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

update public.lineas
set descripcion = 'Le escribe primero a las bases de leads viejas, de a uno y con tope, pausas y franjas. Quien responde entra al CRM y lo atiende el equipo (o la IA, si se elige en Secuencia).'
where id = 'linea-1'
  and descripcion = 'Le escribe primero a contactos nuevos (prospección). Su panel se suma más adelante: mientras tanto, si alguien responde, atiende el equipo.';

commit;
