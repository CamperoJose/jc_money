-- =============================================================================
-- MyMoney Web — Gastos + Autocálculo de Patrimonio (Fase 2)
-- Añade: fecha+hora en transacciones, el valor 'inversion' al enum de
-- categorías, y en net_worth_snapshots un instante exacto (snapshot_at) y el
-- tipo (manual | auto) para el job diario.
--
-- ⚠️ ORDEN DE EJECUCIÓN EN EL SQL EDITOR DE SUPABASE:
--   1) Ejecuta ESTE archivo (0004) y confírmalo (commit).
--   2) LUEGO ejecuta 0005_seed_gastos_parametros.sql.
-- Motivo: Postgres no permite USAR un valor de enum recién agregado dentro de la
-- misma transacción en que se agregó (el seed de categorías de inversión lo usa).
-- =============================================================================

-- 0) Limpieza defensiva: si una versión previa creó participantes, se elimina.
alter table transactions drop column if exists participant_id;
drop table if exists participants cascade;

-- 1) Nuevo tipo de categoría: inversión ---------------------------------------
alter type category_kind add value if not exists 'inversion';

-- 2) Transacciones: fecha+hora exacta -----------------------------------------
-- occurred_at: instante exacto del movimiento (con zona). Fuente de verdad para
-- gastos. Se conserva txn_date (fecha local Bolivia) para índices/agrupación.
alter table transactions
  add column if not exists occurred_at timestamptz not null default now();

create index if not exists idx_txn_occurred_at on transactions(occurred_at);

-- 3) Patrimonio: instante exacto + tipo (manual | auto) -----------------------
do $$ begin
  create type snapshot_kind as enum ('manual','auto');
exception when duplicate_object then null; end $$;

alter table net_worth_snapshots
  add column if not exists snapshot_at timestamptz;

-- Backfill: fotos previas quedan ancladas al mediodía de su fecha (hora Bolivia).
update net_worth_snapshots
  set snapshot_at = (snapshot_date::timestamp + time '12:00') at time zone 'America/La_Paz'
  where snapshot_at is null;

alter table net_worth_snapshots alter column snapshot_at set not null;
alter table net_worth_snapshots alter column snapshot_at set default now();

alter table net_worth_snapshots
  add column if not exists kind snapshot_kind not null default 'manual';

create index if not exists idx_snapshots_at on net_worth_snapshots(snapshot_at);
