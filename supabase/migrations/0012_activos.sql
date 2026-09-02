-- ============================================================
-- Activos (bienes vendibles / patrimonio no financiero).
-- Registra un activo: costo de adquisición, si es vendible, si cuenta
-- contablemente en el patrimonio, valor actual estimado; y al venderlo
-- (fecha + precio) permite calcular el rendimiento.
-- Se agrega una cuenta "Activos" (type 'otro') cuyo saldo lo autocalcula el
-- job diario = Σ valor de los activos que cuentan en patrimonio (status activo).
-- Idempotente. RLS por user_id.
-- ============================================================

do $$ begin
  create type asset_status as enum ('activo','vendido');
exception when duplicate_object then null; end $$;

create table if not exists assets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                  text not null,
  category              text,
  acquired_date         date,
  acquisition_cost      numeric(16,2) not null default 0,   -- costo de compra
  currency              currency not null default 'BOB',
  current_value         numeric(16,2),                      -- valor estimado actual (si null, usa el costo)
  sellable              boolean not null default true,
  counts_in_patrimonio  boolean not null default true,      -- si suma al patrimonio
  status                asset_status not null default 'activo',
  sold_date             date,
  sold_price            numeric(16,2),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_assets_status on assets(status);

-- Cuenta "Activos" para que el job sume el valor al patrimonio (como DPF/Por Cobrar).
do $$
declare uid uuid;
begin
  select id into uid from auth.users order by created_at asc limit 1;
  if uid is not null and not exists (select 1 from accounts where user_id = uid and name = 'Activos') then
    insert into accounts (user_id, name, type, currency, is_liability, active)
      values (uid, 'Activos', 'otro'::account_type, 'BOB'::currency, false, true);
  end if;
end $$;

-- Trigger updated_at + RLS
do $$
begin
  execute 'drop trigger if exists trg_assets_updated_at on assets';
  execute 'create trigger trg_assets_updated_at before update on assets for each row execute function set_updated_at()';
  execute 'alter table assets enable row level security';
  execute 'drop policy if exists assets_select on assets';
  execute 'drop policy if exists assets_insert on assets';
  execute 'drop policy if exists assets_update on assets';
  execute 'drop policy if exists assets_delete on assets';
  execute 'create policy assets_select on assets for select using (user_id = auth.uid())';
  execute 'create policy assets_insert on assets for insert with check (user_id = auth.uid())';
  execute 'create policy assets_update on assets for update using (user_id = auth.uid()) with check (user_id = auth.uid())';
  execute 'create policy assets_delete on assets for delete using (user_id = auth.uid())';
end $$;
