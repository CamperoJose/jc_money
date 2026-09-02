-- =============================================================================
-- MyMoney Web — Semillas de Gastos + Parámetros
-- Ejecutar DESPUÉS de 0004 (y de que exista el usuario en auth.users).
-- Idempotente: no duplica por nombre. Un solo usuario: toma el primero.
-- =============================================================================

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users order by created_at asc limit 1;
  if uid is null then
    raise notice 'No hay usuarios en auth.users todavía. Inicia sesión y vuelve a correr este script.';
    return;
  end if;

  -- ---- Participante por defecto --------------------------------------------
  insert into participants (user_id, name, active)
  select uid, v.name, true
  from (values ('Yo')) as v(name)
  where not exists (
    select 1 from participants p where p.user_id = uid and p.name = v.name
  );

  -- ---- Categorías de inversión ---------------------------------------------
  insert into categories (user_id, name, kind, active)
  select uid, v.name, 'inversion'::category_kind, true
  from (values
    ('DPF'),
    ('Criptomonedas'),
    ('Acciones'),
    ('Fondos de inversión'),
    ('Bienes raíces'),
    ('Otros')
  ) as v(name)
  where not exists (
    select 1 from categories c
    where c.user_id = uid and c.name = v.name and c.kind = 'inversion'::category_kind
  );

  raise notice 'Semillas de gastos/parámetros cargadas para el usuario %', uid;
end $$;
