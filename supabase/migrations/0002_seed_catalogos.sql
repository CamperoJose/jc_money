-- =============================================================================
-- MyMoney Web — Semillas de catálogos (accounts + categories)
-- Ejecutar DESPUÉS de que el usuario haya iniciado sesión al menos una vez
-- (para que exista su fila en auth.users). Como la app es de un solo usuario,
-- este script toma el ÚNICO usuario de auth.users. Si hubiera más de uno,
-- ajusta el WHERE para fijar el correo del usuario.
-- Idempotente: no duplica si ya existen (por nombre).
-- =============================================================================

do $$
declare
  uid uuid;
begin
  -- Un solo usuario: tomar el primero. Para fijarlo, usar:
  --   select id into uid from auth.users where email = 'jcampero124@gmail.com';
  select id into uid from auth.users order by created_at asc limit 1;

  if uid is null then
    raise notice 'No hay usuarios en auth.users todavía. Inicia sesión y vuelve a correr este script.';
    return;
  end if;

  -- ---- Cuentas / billeteras (derivadas del Excel) --------------------------
  insert into accounts (user_id, name, type, currency, is_liability, active)
  select uid, v.name, v.type::account_type, v.currency::currency, v.is_liability, true
  from (values
    ('Banco SOL',       'banco',           'BOB', false),
    ('Fortaleza',       'banco',           'BOB', false),
    ('BMSC',            'banco',           'BOB', false),
    ('BNB',             'banco',           'BOB', false),
    ('IDEPRO CA',       'banco',           'BOB', false),
    ('Efectivo Bs',     'efectivo',        'BOB', false),
    ('Efectivo USD',    'efectivo',        'USD', false),
    ('USDT',            'stablecoin',      'USDT', false),
    ('DPF Congelado',   'dpf',             'BOB', false),
    ('Por Cobrar',      'por_cobrar',      'BOB', false),   -- columna "Debts" de CONTEOS (activo)
    ('Tarjeta Mercantil','tarjeta_credito','BOB', true)     -- pasivo (ejemplo de voz)
  ) as v(name, type, currency, is_liability)
  where not exists (
    select 1 from accounts a where a.user_id = uid and a.name = v.name
  );

  -- ---- Categorías (set básico en español) ----------------------------------
  insert into categories (user_id, name, kind, active)
  select uid, v.name, v.kind::category_kind, true
  from (values
    ('Alimentación', 'gasto'),
    ('Transporte',   'gasto'),
    ('Salud',        'gasto'),
    ('Servicios',    'gasto'),
    ('Ocio',         'gasto'),
    ('Trámites',     'gasto'),
    ('Tecnología',   'gasto'),
    ('Otros',        'gasto'),
    ('Sueldo',       'ingreso'),
    ('Rendimientos', 'ingreso'),
    ('Otros',        'ingreso')
  ) as v(name, kind)
  where not exists (
    select 1 from categories c
    where c.user_id = uid and c.name = v.name and c.kind = v.kind::category_kind
  );

  raise notice 'Semillas cargadas para el usuario %', uid;
end $$;
