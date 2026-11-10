-- Borradores con lo que mandaban los bots de Kommo (relevamiento del 10/11/2026, docs/kommo.md),
-- para que Mindlin no tenga que tipear todo de nuevo:
--
-- * Cinco proyectos nuevos, APAGADOS (activo = false): el asistente no los ofrece hasta que
--   alguien los revise y los active en el panel o desde el hub.
-- * Lerma 439 (el piloto, ya activo): se completan solo los datos que estaban vacíos.
-- * Un seguimiento por proyecto (a las 24 h sin respuesta), ARCHIVADO: no se manda nada hasta que
--   alguien lo pase a «Activa».
-- * El criterio «solo vendemos, no alquilamos», que el bot de entrada ya respondía.
--
-- Solo se cargó lo que estaba completo en el relevamiento. Lo que venía cortado (listas de
-- unidades, algunos precios) quedó vacío: el asistente no lo dice y ofrece que lo confirme el equipo.
-- Nunca pisa lo que ya cargó una persona. Idempotente.

begin;

-- Proyectos nuevos, apagados.
insert into public.proyectos (id, nombre, activo, palabras_clave, presentacion, descripcion, ubicacion, etapa_obra, entrega, tipologias, precios, financiacion, disponibilidad, amenities, links, notas_internas, actualizado_por)
values
  (
    'guemes', 'Güemes', false, array['güemes', 'guemes', 'palermo soho'],
    'Es un nuevo desarrollo, en plena primera fase: un fideicomiso al costo, en pleno Palermo Soho. Hay unidades de dos y tres ambientes, al frente y al contrafrente.',
    'Nuevo desarrollo, en plena primera fase. Fideicomiso al costo.',
    'Calle Güemes al 4776, en pleno Palermo Soho, a una cuadra de Distrito Arcos y La Rural.',
    'En plena primera fase.', '',
    'Dos y tres ambientes, al frente y al contrafrente: 44 y 77 metros totales cada una.',
    '',
    'Se hace un aporte inicial y luego se paga en hasta 40 cuotas mensuales que se actualizan con CAC. Además hay dos refuerzos.',
    'Hay unidades disponibles de dos y tres ambientes.',
    '', '',
    'Borrador armado el 10/11/2026 con lo que mandaba el bot de Kommo. Antes de activarlo: revisar que siga vigente y completar precios, entrega y lo que falte.',
    'Borrador de Kommo'
  ),
  (
    '17-y-43', '17 y 43', false, array['17 y 43', 'calle 17', 'fideicomiso 17 y 43', 'pozo la plata'],
    'Es nuestro fideicomiso en 17 y 43: un desarrollo en pozo, construido por Borok Construcciones y comercializado por Marcela Chama Bienes Raíces.',
    'Fideicomiso en 17 y 43. Desarrollo en pozo, construido por Borok Construcciones. Comercializado por Marcela Chama Bienes Raíces.',
    '17 y 43, La Plata.',
    'En pozo.', '',
    'Monoambiente Tipo B. Dos ambientes Tipo A.',
    '',
    'Se hace un aporte inicial y luego se pagan 30 cuotas ajustadas por el índice CAC.',
    '', '',
    E'Brochure: https://drive.google.com/file/d/1LCeyI1LKq_rIfZHDAFn3Qj8jp3gLhkGO/view?usp=sharing\nFicha del monoambiente Tipo B: https://mindlindevelopers.com/fideicomiso-17-y-43-monoambiente-tipo-b/',
    'Borrador armado el 10/11/2026 con lo que mandaba el bot de Kommo. La lista de unidades venía cortada (falta el link de la ficha del dos ambientes y puede haber más tipologías). Antes de activarlo: completar unidades, precios y disponibilidad.',
    'Borrador de Kommo'
  ),
  (
    'ramblas-del-plata', 'Ramblas del Plata', false, array['ramblas', 'ramblas del plata', 'nova', 'irsa'],
    'Ramblas del Plata es un desarrollo construido por Borok Construcciones, en el nuevo Puerto Madero. Es un proyecto liderado por IRSA.',
    'Desarrollo construido por Borok Construcciones, en el nuevo Puerto Madero. Proyecto liderado por IRSA.',
    'En el nuevo Puerto Madero.',
    '', '', '', '',
    'Se hace un aporte inicial y luego se pagan 36 cuotas ajustadas por el índice CAC.',
    '', '',
    'Brochure: https://drive.google.com/file/d/1s3IF5J-IWEkBroiQZZbiBUY_wiKY83S0/view',
    'Borrador armado el 10/11/2026 con lo que mandaba el bot de Kommo. El bot decía «te comento las unidades disponibles» pero la lista no estaba en el relevamiento. Antes de activarlo: completar unidades, precios, disponibilidad y etapa de obra.',
    'Borrador de Kommo'
  ),
  (
    'via-53', 'VIA 53', false, array['vía 53', 'via 53', '9 y 53', 'torre 53'],
    'VIA 53 es la torre en construcción con mejor ubicación de toda la ciudad: está enfrente del Teatro Argentino. La torre tendrá pileta, gimnasio, SUM y parrilla.',
    'Torre en construcción, enfrente del Teatro Argentino.',
    'Enfrente del Teatro Argentino.',
    'En construcción.',
    'Noviembre de 2026.',
    'Dos ambientes: de 43 a 55 metros cuadrados propios. Tres ambientes: de 75 a 78 metros cuadrados propios.',
    'Dos ambientes: desde USD 108.000. Tres ambientes: desde USD 189.000.',
    '', '',
    'Pileta, gimnasio, SUM y parrilla.',
    'Brochure: https://drive.google.com/file/d/1aw6PvjzbHY4fLqwnmpxB-raW-78NhWJ_/view?usp=sharing',
    'Borrador armado el 10/11/2026 con lo que mandaba el bot de Kommo. La lista de valores venía cortada (puede haber más tipologías). Revisar la fecha de entrega (el bot decía noviembre de 2026) y completar financiación y disponibilidad. Kommo también mandaba tres correos (a las 24 h, a los 7 y a los 14 días): el email queda para más adelante.',
    'Borrador de Kommo'
  ),
  (
    'torre-cuatro-vientos', 'Torre Cuatro Vientos (T4V)', false, array['torre cuatro vientos', 't4v', 'cuatro vientos', 'semipiso', 'semi piso'],
    'T4V es un desarrollo de primera categoría, con la torre ya terminada. Está en Calle 5 entre 43 y 44, en la zona de las facultades.',
    'Desarrollo de primera categoría. La torre está terminada.',
    'Calle 5 entre 43 y 44 (zona facultades, cerca de Pasaje Rodrigo).',
    'La torre está terminada.', '',
    '', '', '',
    'Quedan disponibles solo dos unidades.',
    'Gimnasio y SUM con parrilla. Cocheras cubiertas y descubiertas. Ventilación cruzada en todos los departamentos y muy buena iluminación.',
    'Planos y fotos de las unidades: https://mindlindevelopers.com/torrecuatrovientos/',
    'Borrador armado el 10/11/2026 con lo que mandaba el bot de Kommo. Los valores de las dos unidades venían cortados: completar precios y tipologías, y revisar si siguen quedando dos unidades.',
    'Borrador de Kommo'
  )
on conflict (id) do nothing;

-- Lerma 439 (ya activo): solo lo que estaba vacío.
update public.proyectos set
  presentacion = case when presentacion = '' then 'Lerma 439 es un desarrollo en pozo entre Villa Crespo y Palermo, con una ubicación tremenda: está en la calle Lerma, entre Malabia y Scalabrini Ortiz. ¡Ya empezamos la obra!' else presentacion end,
  ubicacion = case when ubicacion = '' then 'Calle Lerma, entre Malabia y Scalabrini Ortiz, entre Villa Crespo y Palermo.' else ubicacion end,
  etapa_obra = case when etapa_obra = '' then 'En obra: se está terminando la losa del quinto piso.' else etapa_obra end,
  tipologias = case when tipologias = '' then 'Unidades de uno y dos ambientes.' else tipologias end,
  precios = case when precios = '' then 'Un ambiente: desde USD 88.000. Dos ambientes: desde USD 105.000. El precio varía por orientación y por altura.' else precios end,
  financiacion = case when financiacion = '' then 'Se hace un aporte inicial y luego se pagan 24 cuotas mensuales que se ajustan por el índice CAC.' else financiacion end,
  disponibilidad = case when disponibilidad = '' then 'Quedan disponibles unidades de uno y dos ambientes.' else disponibilidad end,
  links = case when links = '' then 'Brochure: https://drive.google.com/file/d/1ZtdTA8n5gqpvP3_DbxAZpiI_SD7CF12q/view?usp=sharing' else links end,
  notas_internas = case when notas_internas = '' then 'El 10/11/2026 se completó lo que estaba vacío con lo que mandaba el bot de Kommo. Revisar que siga vigente: precios, disponibilidad y avance de obra (decía «terminando la losa del quinto piso»).' else notas_internas end,
  palabras_clave = case when palabras_clave = array['lerma', 'lerma 439'] then array['lerma', 'lerma 439', 'queens', 'villa crespo'] else palabras_clave end
where id = 'lerma-439';

-- Un seguimiento por proyecto a las 24 h sin respuesta, como en Kommo. Archivados: no sale ninguno
-- hasta que alguien los pase a «Activa». Solo si ese proyecto todavía no tiene reglas.
insert into public.reglas_seguimiento (etapa, paso, dias_sin_respuesta, version, estado, proyecto, mensaje, notas)
select 'Nuevo', 1, 1, 1, 'archivada', b.proyecto, b.mensaje, 'Borrador: es el seguimiento que mandaba el bot de Kommo a las 24 h. Para usarlo, pasarlo a «Activa».'
from (values
  ('lerma-439', 'Hola {{nombre}}! Espero que estés teniendo un buen día. Te escribo para saber si tenés alguna duda sobre el proyecto que te compartí. Si lo que ves no es lo que buscás, tenemos muchas alternativas más accesibles y en distintas ubicaciones. Me encantaría ayudarte a encontrar la mejor opción. ¡Quedo a disposición! Saludos!'),
  ('guemes', 'Hola {{nombre}}! ¿Cómo estás? Espero que estés teniendo un lindo día. No te quiero molestar, ¿pudiste ver la info que te mandé? Cualquier cosa preguntame. ¡Gracias y saludos!'),
  ('17-y-43', 'Hola {{nombre}}! Espero que estés teniendo un buen día. Te escribo para saber si tenés alguna duda sobre el proyecto que te compartí. Si lo que ves no es lo que buscás, tenemos otras alternativas que podrían interesarte en distintas ubicaciones. Me encantaría ayudarte a encontrar la mejor opción. ¡Quedo a disposición, saludos!'),
  ('ramblas-del-plata', 'Hola {{nombre}}! Espero que estés teniendo un buen día. Te escribo para saber si tenés alguna duda sobre el proyecto que te compartí. Si lo que ves no es lo que buscás, tenemos otras alternativas que podrían interesarte en distintas ubicaciones. Me encantaría ayudarte a encontrar la mejor opción. ¡Quedo a disposición, saludos!'),
  ('via-53', 'Hola {{nombre}}! Espero que estés teniendo un buen día. Te molesto para saber si pudiste ver el proyecto que te compartí. Tenemos otras alternativas que podrían interesarte en otros lugares. Me encantaría ayudarte a encontrar la mejor opción. ¡Quedo a disposición, saludos!'),
  ('torre-cuatro-vientos', 'Hola {{nombre}}! Espero que estés teniendo un buen día. Te molesto para saber si te surgió alguna duda sobre las unidades que te compartí. Si lo que ves no es lo que buscás, tenemos otras alternativas que podrían interesarte en distintas ubicaciones. Me encantaría ayudarte a encontrar la mejor opción. ¡Quedo a disposición, saludos!')
) as b(proyecto, mensaje)
where exists (select 1 from public.proyectos p where p.id = b.proyecto)
  and not exists (select 1 from public.reglas_seguimiento r where r.proyecto = b.proyecto);

-- El bot de entrada respondía que solo venden. Se suma a los criterios si todavía no hablan de alquiler.
update public.tono
set criterios_comerciales = trim(criterios_comerciales || ' Mindlin solo vende: si consultan por alquiler, decilo con amabilidad y ofrecé contarles sobre los proyectos en venta.')
where id = 1 and criterios_comerciales not ilike '%alquil%';

commit;
