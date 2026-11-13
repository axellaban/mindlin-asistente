-- Reglas de seguimiento sugeridas, para que Mindlin las revise.
--
-- Quedan «archivadas»: el bot no manda nada hasta que alguien cambie el estado a «activa» (o
-- «a_prueba», para comparar con otra versión) en la consola de Neon → Tables → reglas_seguimiento.
-- Variables del mensaje: {{nombre}} (el primer nombre; si no lo sabe, lo saca) y {{proyecto}}.
--
-- Cómo funcionan (lib/seguimientos.ts): si la persona no volvió a escribir después de la última
-- respuesta del bot, pasados `dias_sin_respuesta` se manda el paso 1; si sigue sin escribir, el 2.
-- La etapa es la del contacto en el CRM («Nuevo» si no está). De lunes a sábado, de 9 a 20.
--
-- Se cargan solo si la tabla está vacía. Idempotente.

begin;

insert into public.reglas_seguimiento (etapa, paso, dias_sin_respuesta, estado, mensaje, notas)
select * from (values
  ('Nuevo', 1, 1, 'archivada',
   'Hola {{nombre}}, ¿cómo va? ¿Pudiste ver lo que te pasé de {{proyecto}}? Si te queda alguna duda o querés coordinar una visita, decime.',
   'Sugerida por el equipo técnico: revisar el texto con Mindlin antes de activarla.'),
  ('Nuevo', 2, 4, 'archivada',
   'Hola {{nombre}}, te escribo por última vez por {{proyecto}} para no llenarte el WhatsApp. Si más adelante te interesa, escribime y lo retomamos.',
   'Último intento. Sugerida por el equipo técnico: revisar con Mindlin.')
) as v(etapa, paso, dias_sin_respuesta, estado, mensaje, notas)
where not exists (select 1 from public.reglas_seguimiento);

commit;
