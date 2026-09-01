-- =============================================================================
-- MyMoney Web — Esquema inicial (Fase 0)
-- Postgres / Supabase. Todas las tablas con user_id + RLS (user_id = auth.uid()).
-- Moneda base: BOB. Ver claude/modelo-datos.md para el detalle.
-- =============================================================================

-- Extensiones -----------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- Enums -----------------------------------------------------------------------
do $$ begin
  create type account_type as enum
    ('banco','efectivo','stablecoin','tarjeta_credito','dpf','por_cobrar','otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type currency as enum ('BOB','USD','USDT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type category_kind as enum ('gasto','ingreso');
exception when duplicate_object then null; end $$;

do $$ begin
  create type txn_type as enum ('gasto','ingreso');
exception when duplicate_object then null; end $$;

do $$ begin
  create type txn_source as enum ('manual','voz','api');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dpf_status as enum ('activo','pagado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type debt_status as enum ('pendiente','parcial','pagado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_recurrence as enum ('ninguna','diaria','semanal','mensual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_channel as enum ('email');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_related as enum ('inversion','deuda','generico');
exception when duplicate_object then null; end $$;

-- Función de updated_at -------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =============================================================================
-- Catálogos
-- =============================================================================

create table if not exists accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null,
  type         account_type not null,
  currency     currency not null,
  is_liability boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  kind       category_kind not null,
  parent_id  uuid references categories(id) on delete set null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- Patrimonio (hoja CONTEOS)
-- =============================================================================

create table if not exists net_worth_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  snapshot_date date not null,
  exchange_rate numeric(12,4) not null,   -- T/C: Bs por USD
  total_bob     numeric(16,2),            -- calculado y almacenado (fidelidad histórica)
  total_usd     numeric(16,2),            -- total_bob / exchange_rate
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists net_worth_balances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  snapshot_id uuid not null references net_worth_snapshots(id) on delete cascade,
  account_id  uuid not null references accounts(id) on delete restrict,
  amount      numeric(16,2) not null,     -- en la moneda de la cuenta
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (snapshot_id, account_id)
);

-- =============================================================================
-- Gastos e ingresos (hoja GASTOS PRESUPUESTO)
-- =============================================================================

create table if not exists transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  txn_date       date not null,
  type           txn_type not null,
  amount         numeric(16,2) not null check (amount > 0),
  currency       currency not null default 'BOB',
  exchange_rate  numeric(12,4),           -- requerido si currency <> 'BOB' (validado en la API)
  account_id     uuid references accounts(id) on delete set null,
  category_id    uuid references categories(id) on delete set null,
  description    text,
  tags           text[] not null default '{}',
  source         txn_source not null default 'manual',
  raw_voice_text text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period         text not null,           -- 'YYYY-MM'
  category_id    uuid not null references categories(id) on delete cascade,
  amount_planned numeric(16,2) not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (period, category_id)
);

-- =============================================================================
-- Inversiones DPF (hoja DPF LADDERING REAL)
-- =============================================================================

create table if not exists dpf_deposits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nro_dpf          text,
  pizarra          text,
  edv              text,
  id_dpf_externo   text,
  start_date       date,
  end_date         date,
  principal        numeric(16,2),         -- MONTO en BOB
  term_days        integer,               -- PLAZO (ej. 90)
  annual_rate      numeric(6,4),          -- % anual (ej. 0.0770)
  status           dpf_status not null default 'activo',
  gcia_economica   numeric(16,2),         -- ingresado por el usuario (ganancia bruta)
  gcia_financiera  numeric(16,2),         -- ingresado por el usuario (ganancia líquida)
  rc_iva_retencion numeric(16,2),         -- economica - financiera
  account_id       uuid references accounts(id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists projection_scenarios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  params     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- Deudas (hoja DEUDAS)
-- =============================================================================

create table if not exists debts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debt_date    date,
  amount       numeric(16,2),
  reason       text,
  status       debt_status not null default 'pendiente',
  counterparty text,
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =============================================================================
-- Sistema
-- =============================================================================

create table if not exists reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null,
  remind_at    timestamptz not null,
  recurrence   reminder_recurrence not null default 'ninguna',
  channel      reminder_channel not null default 'email',
  related_type reminder_related,
  related_id   uuid,
  active       boolean not null default true,
  last_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =============================================================================
-- Índices útiles
-- =============================================================================
create index if not exists idx_balances_snapshot on net_worth_balances(snapshot_id);
create index if not exists idx_balances_account  on net_worth_balances(account_id);
create index if not exists idx_txn_date          on transactions(txn_date);
create index if not exists idx_txn_category       on transactions(category_id);
create index if not exists idx_snapshots_date     on net_worth_snapshots(snapshot_date);
create index if not exists idx_dpf_status         on dpf_deposits(status);

-- =============================================================================
-- Triggers updated_at
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','categories','net_worth_snapshots','net_worth_balances',
    'transactions','budgets','dpf_deposits','projection_scenarios','debts','reminders'
  ] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on %1$s;
       create trigger trg_%1$s_updated_at before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- =============================================================================
-- Row Level Security: activar y política user_id = auth.uid() en todas
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','categories','net_worth_snapshots','net_worth_balances',
    'transactions','budgets','dpf_deposits','projection_scenarios','debts','reminders'
  ] loop
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
