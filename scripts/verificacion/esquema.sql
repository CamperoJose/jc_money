-- Esquema mínimo equivalente al de Supabase, sin RLS ni auth (no aplican aquí).
create type currency as enum ('BOB','USD','USDT');
create type account_type as enum ('efectivo','banco','stablecoin','dpf','por_cobrar','activo','tarjeta_credito','otro');
create type txn_type as enum ('gasto','ingreso');
create type txn_source as enum ('manual','voz','api');
create type debt_status as enum ('pendiente','parcial','pagado');
create type snapshot_kind as enum ('manual','auto');

create table accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  name text not null, type account_type not null, currency currency not null default 'BOB',
  is_liability boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now());

create table net_worth_snapshots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  snapshot_date date not null, snapshot_at timestamptz not null default now(),
  kind snapshot_kind not null default 'manual',
  exchange_rate numeric(12,4) not null, total_bob numeric(16,2), total_usd numeric(16,2), note text);

create table net_worth_balances (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  snapshot_id uuid not null references net_worth_snapshots(id) on delete cascade,
  account_id uuid not null references accounts(id), amount numeric(16,2) not null,
  unique (snapshot_id, account_id));

create table transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  txn_date date not null, occurred_at timestamptz not null default now(),
  type txn_type not null, amount numeric(16,2) not null, currency currency not null default 'BOB',
  exchange_rate numeric(12,4), account_id uuid references accounts(id),
  category_id uuid, description text, tags text[] not null default '{}',
  source txn_source not null default 'manual');

create table debts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  debt_date date, amount numeric(16,2), paid_amount numeric(16,2) default 0, reason text,
  status debt_status not null default 'pendiente', counterparty text, due_date date,
  source_account_id uuid references accounts(id), paid_account_id uuid references accounts(id),
  collected_date date);

create table dpf_deposits (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  principal numeric(16,2) not null, status text not null default 'activo');

create table assets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  name text, acquisition_cost numeric(16,2) not null default 0, current_value numeric(16,2),
  currency currency not null default 'BOB', status text not null default 'activo',
  counts_in_patrimonio boolean not null default true, sold_price numeric(16,2),
  sold_date date, sold_account_id uuid references accounts(id));

-- Memoria de «ya avisé esto» (migración 0008). La usan los correos de alerta
-- y el job de vigilancia para no repetir el mismo aviso a diario.
create table if not exists app_settings (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  key     text not null,
  value   text,
  unique (user_id, key)
);
