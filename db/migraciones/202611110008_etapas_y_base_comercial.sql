-- Etapas automáticas y la base comercial de Mindlin.
--
-- * reglas_etapa: «cuando pasa esto con el lead, moverlo a esta etapa del CRM» (lib/etapas/reglas.ts).
--   Una fila por evento; etapa vacía quiere decir «no mover». Se configura desde el hub o el panel.
--   Vienen cargadas las de fábrica.
-- * registro: un tipo nuevo, «etapa» (cada vez que el asistente mueve a alguien).
-- * tono.sobre_la_empresa y tono.objeciones: lo que el asistente sabe de la empresa (quiénes son,
--   trayectoria, preguntas frecuentes) y cómo responder objeciones, a cada perfil y qué no decir.
--   Se cargan con un resumen del documento que pasó Mindlin («BOTS de Kommo», 10/11/2026), solo si
--   están vacíos.
-- * Los borradores de las fichas (los que nadie tocó todavía) suman un dato que estaba en ese documento.
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

create table if not exists public.reglas_etapa (
  evento text primary key check (evento in ('primer_contacto', 'respondio', 'seguimiento_enviado', 'respondio_seguimiento', 'sin_respuesta', 'quiere_visita', 'senal_de_compra', 'no_le_interesa', 'paso_al_equipo')),
  etapa text check (etapa is null or etapa in ('Contacto inicial', 'Seguimiento', 'Visita / reunión', 'Negociación', 'En pausa', 'Descartado')),
  actualizado timestamptz not null default now(),
  actualizado_por text
);
comment on table public.reglas_etapa is 'A qué etapa del CRM mueve el asistente cuando pasa cada evento. etapa vacía: no mueve.';
alter table public.reglas_etapa enable row level security;

insert into public.reglas_etapa (evento, etapa, actualizado_por) values
  ('primer_contacto', 'Contacto inicial', 'De fábrica'),
  ('respondio', 'Seguimiento', 'De fábrica'),
  ('seguimiento_enviado', null, 'De fábrica'),
  ('respondio_seguimiento', 'Seguimiento', 'De fábrica'),
  ('sin_respuesta', 'En pausa', 'De fábrica'),
  ('quiere_visita', 'Visita / reunión', 'De fábrica'),
  ('senal_de_compra', null, 'De fábrica'),
  ('no_le_interesa', 'Descartado', 'De fábrica'),
  ('paso_al_equipo', null, 'De fábrica')
on conflict (evento) do nothing;

alter table public.registro drop constraint if exists registro_tipo_check;
alter table public.registro add constraint registro_tipo_check
  check (tipo in ('respuesta', 'paso_a_persona', 'la_tomo_una_persona', 'volvio_al_bot', 'seguimiento', 'crm', 'etapa', 'pausa', 'error'));

alter table public.tono add column if not exists sobre_la_empresa text not null default '';
alter table public.tono add column if not exists objeciones text not null default '';
comment on column public.tono.sobre_la_empresa is 'Quiénes son, trayectoria y preguntas frecuentes: vale para todos los proyectos.';
comment on column public.tono.objeciones is 'Cómo responder objeciones, cómo hablarle a cada perfil, señales y qué no decir.';

update public.tono set sobre_la_empresa = $txt$Quiénes somos
Mindlin Developers es una desarrolladora inmobiliaria: detecta oportunidades, estructura los negocios y comercializa los proyectos, con una mirada moderna y cercana, tanto para el inversor como para quien compra para vivir. La impulsa Matías Mindlin, tercera generación de una familia ligada a la construcción y al desarrollo inmobiliario.

Mindlin Developers y Borok Construcciones
Están muy vinculadas, pero no son lo mismo. Mindlin Developers es la desarrolladora: impulsa, estructura y comercializa el proyecto y lleva la relación con el cliente. Borok Construcciones es la constructora: aporta el respaldo técnico y la experiencia de obra en los desarrollos donde participa.

Trayectoria
- La familia está en el rubro hace más de 60 años (desde la década del 60).
- Borok Construcciones existe desde 1990 y lleva más de 100.000 m² construidos.
- Mindlin Developers es la etapa nueva: impronta moderna, pero no improvisada.

Dónde operan
Principalmente en Buenos Aires y La Plata.

Preguntas frecuentes
- ¿Son constructora o desarrolladora? Mindlin Developers es la desarrolladora (impulsa, estructura y comercializa). Trabaja con el respaldo de Borok Construcciones, que aporta la experiencia constructiva.
- ¿Tienen experiencia? Sí: detrás hay una familia con más de 60 años en el sector y una constructora con más de 100.000 m² construidos.
- ¿Quién construye? Depende del proyecto; Borok Construcciones participa en los desarrollos donde corresponde. Si preguntan por un proyecto puntual y su ficha no lo dice, se confirma con el equipo.
- ¿Son una empresa nueva? Mindlin Developers tiene una impronta nueva, sobre una base familiar de décadas en construcción y desarrollo.
- ¿Cómo se compra? Depende del proyecto: en algunos hay reserva y boleto; en otros, adhesión a un fideicomiso. El proceso concreto de cada uno lo explica el equipo.
- ¿Puedo invertir si no vivo en la ciudad? Sí: muchos proyectos están pensados para compradores del interior o inversores que no viven ahí.

Para explicar simple
- Fideicomiso: una forma de participar de un desarrollo desde una etapa temprana, con un ingreso más escalonado.
- Pozo o preventa: comprar en la etapa inicial, antes o durante el comienzo de la obra.
- Anticipo: el monto inicial para entrar. Cuotas: los pagos que siguen.
- CAC: el índice de la Cámara Argentina de la Construcción, con el que se ajustan las cuotas en algunos proyectos.
- Posesión: cuando la unidad se puede empezar a usar. Escritura: el acto legal que formaliza la titularidad.$txt$
where id = 1 and sobre_la_empresa = '';

update public.tono set objeciones = $txt$Objeciones: no se discuten; se entienden y se ordenan.
- «Me parece caro»: no siempre es falta de plata; a veces no ve el valor o está comparando mal. Poner en contexto la ubicación, el momento de ingreso y la forma de pago, y ofrecer que alguien del equipo le muestre la comparación.
- «No conozco la empresa»: necesita confianza. Contar quiénes son y el respaldo que hay detrás, y ofrecer una llamada o una reunión.
- «No entiendo el fideicomiso»: explicarlo simple, sin tecnicismos legales: participar del desarrollo desde temprano, con un ingreso escalonado.
- «Prefiero esperar»: averiguar qué le falta (información, seguridad, financiación, tiempo) y ofrecer ayuda para comparar.
- «Estoy viendo otros proyectos»: está bien comparar. Preguntar qué prioriza: ubicación, precio de entrada, forma de pago, renta o etapa.
- «No me convence la zona»: contar por qué tiene sentido la zona, solo con lo que dice la ficha.
- «No llego con el anticipo»: ver si le sirve otra tipología u otro proyecto.
- «Quiero algo terminado»: orientarlo a un proyecto terminado o más avanzado, si hay uno.

Cómo hablarle a cada perfil
- Inversor: busca renta, valorización y una buena entrada. Hablarle de la forma de pago, la ubicación y la demanda.
- Para vivir: busca comodidad, distribución y barrio. Hablarle del uso, el entorno y la unidad.
- Del interior, o un padre que compra para un hijo: busca resguardo, ubicación y confianza. Simpleza y respaldo.
- Lead frío que vino de un aviso: claridad y síntesis. No saturarlo; llevarlo de a poco.
- Lead caliente (pregunta por una unidad, el piso, la forma de pago exacta, los gastos, una visita o la reserva): ser concreto y llevarlo al siguiente paso con el equipo.

Señales de compra
Pregunta por una unidad puntual, por el piso o la orientación, pide la forma de pago exacta, pregunta por los gastos, quiere coordinar una visita, consulta por la reserva o compara dos unidades. Responder rápido y concreto, y proponer el siguiente paso (una llamada, una visita).

Señales de descarte
Solo pregunta el precio y no responde más; busca algo que el proyecto no ofrece; su presupuesto está muy por debajo; necesita algo terminado y solo hay pozo. No cortar mal: ofrecer una alternativa y dejar la puerta abierta.

Si no encaja en un proyecto
No está perdido: ver si encaja mejor en otro de los proyectos (otra tipología, otro precio de entrada, algo más avanzado, otra zona).

Qué no decir
- No garantizar rentabilidad: se habla de potencial, nunca de una renta asegurada.
- No dar definiciones legales o impositivas cerradas: eso lo ve el equipo.
- Si preguntó algo concreto (precio, metros), responder eso primero.
- No hablar de más: la información tiene que ayudar, no marear.$txt$
where id = 1 and objeciones = '';

-- Borradores que nadie tocó: lo que sumó el documento.
update public.proyectos set
  tipologias = 'Monoambiente Tipo B. Dos ambientes Tipo A. Dos ambientes Tipo C.',
  notas_internas = 'Borrador armado el 10/11/2026 con lo que mandaba el bot de Kommo. Faltan los links de las fichas de los dos ambientes (Tipo A y Tipo C), los precios y la disponibilidad. El bot también mandaba un audio y proponía una llamada («Te llamo en 5 minutos»).'
where id = '17-y-43' and actualizado_por = 'Borrador de Kommo';

update public.proyectos set
  notas_internas = notas_internas || ' Ojo: el otro documento de Mindlin trae valores distintos (2 ambientes desde USD 104.985, 3 ambientes desde USD 176.884, entrega en junio de 2026) y dos formas de pago distintas (50 % de anticipo y 8 cuotas en pesos por CAC, o 33 % de anticipo en dólares y saldo financiado). Confirmar cuáles valen hoy antes de activarlo.'
where id = 'via-53' and actualizado_por = 'Borrador de Kommo' and notas_internas not like '%104.985%';

update public.proyectos set
  notas_internas = notas_internas || ' El otro documento de Mindlin habla de un semipiso de 3 dormitorios desde USD 190.000 y de cocheras (descubierta 12.000, cubierta 16.000): confirmar si sigue disponible y a qué valores.'
where id = 'torre-cuatro-vientos' and actualizado_por = 'Borrador de Kommo' and notas_internas not like '%semipiso%';

commit;
