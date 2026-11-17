-- La lista de precios del hub (17/11/2026, pedido de Mati): cada proyecto del asistente dice de qué
-- proyecto del hub toma las unidades disponibles y sus precios (el Excel madre, la misma lista de
-- Comercial → Lista de precios). Vacío: no la usa y vale solo la ficha.
--
-- Los ids del hub no siempre son los del asistente (Güemes es «guemes-4676», T4V es «t4v», 17 y 43 es
-- «fideicomiso-17-y-43»): acá se cargan los que corresponden. Se cambian desde el hub (Proyectos).
--
-- Cómo se aplica: igual que las anteriores (sola, en cada publicación). Idempotente.

begin;

alter table public.proyectos add column if not exists lista_hub text not null default '';

update public.proyectos p
set lista_hub = m.hub
from (values
  ('lerma-439', 'lerma-439'),
  ('guemes', 'guemes-4676'),
  ('17-y-43', 'fideicomiso-17-y-43'),
  ('ramblas-del-plata', 'ramblas-del-plata'),
  ('via-53', 'via-53'),
  ('torre-cuatro-vientos', 't4v')
) as m(asistente, hub)
where p.id = m.asistente and p.lista_hub = '';

commit;
