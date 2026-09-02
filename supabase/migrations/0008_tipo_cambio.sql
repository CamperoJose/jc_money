-- ============================================================
-- Tipo de cambio (BCB) — tabla externa propia + configuración paramétrica.
-- - exchange_rates: histórico de T/C consumido del servicio SOAP del BCB.
-- - app_settings:   parámetros clave/valor (código de indicador y moneda BCB).
-- Idempotente. RLS por user_id como el resto del esquema.
-- ============================================================

create table if not exists exchange_rates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rate_date     date not null,                 -- fecha del T/C (día en curso)
  cod_indicador integer not null default 1,    -- 1=Tipo de cambio (cod. BCB N°1)
  cod_moneda    integer not null,              -- código de moneda BCB (cod. N°2)
  moneda_desc   text,                          -- descripción legible (ej. "USD venta")
  valor         numeric(14,5) not null,        -- Bs por unidad de moneda
  source        text not null default 'bcb',   -- 'bcb' | 'manual'
  fetched_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, rate_date, cod_indicador, cod_moneda)
);

create index if not exists idx_exchange_rates_date on exchange_rates(rate_date);

create table if not exists app_settings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key        text not null,
  value      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- Triggers updated_at
do $$
declare t text;
begin
  foreach t in array array['exchange_rates','app_settings'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on %1$s;
       create trigger trg_%1$s_updated_at before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- RLS
do $$
declare t text;
begin
  foreach t in array array['exchange_rates','app_settings'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    execute format('drop policy if exists %1$s_insert on %1$s;', t);
    execute format('drop policy if exists %1$s_update on %1$s;', t);
    execute format('drop policy if exists %1$s_delete on %1$s;', t);
    execute format('create policy %1$s_select on %1$s for select using (user_id = auth.uid());', t);
    execute format('create policy %1$s_insert on %1$s for insert with check (user_id = auth.uid());', t);
    execute format('create policy %1$s_update on %1$s for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
    execute format('create policy %1$s_delete on %1$s for delete using (user_id = auth.uid());', t);
  end loop;
end $$;

-- Configuración por defecto: USD venta oficial (indicador 1, moneda 35).
-- El usuario puede cambiar el código de moneda desde Configuración → Parámetros.
insert into app_settings(user_id, key, value)
select u.id, s.key, s.value
from (select id from auth.users order by created_at asc limit 1) u
cross join (values
  ('tc_cod_indicador', '1'),
  ('tc_cod_moneda',    '35')
) as s(key, value)
on conflict (user_id, key) do nothing;
