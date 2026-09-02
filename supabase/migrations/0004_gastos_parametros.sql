-- =============================================================================
-- MyMoney Web — Gastos + Parámetros (Fase 2)
-- Añade: participantes (catálogo), fecha+hora en transacciones, participante en
-- la transacción, y el valor 'inversion' al enum de categorías.
--
-- ⚠️ ORDEN DE EJECUCIÓN EN EL SQL EDITOR DE SUPABASE:
--   1) Ejecuta ESTE archivo (0004) y confírmalo (commit).
--   2) LUEGO ejecuta 0005_seed_gastos_parametros.sql.
-- Motivo: Postgres no permite USAR un valor de enum recién agregado dentro de la
-- misma transacción en que se agregó. Por eso el seed de categorías de inversión
-- (que usa 'inversion') va en un archivo aparte.
-- =============================================================================

-- 1) Nuevo tipo de categoría: inversión ---------------------------------------
alter type category_kind add value if not exists 'inversion';

-- 2) Catálogo de participantes ------------------------------------------------
create table if not exists participants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Transacciones: fecha+hora exacta y participante --------------------------
-- occurred_at: instante exacto del movimiento (con zona). Fuente de verdad para
-- gastos. Se conserva txn_date (fecha local Bolivia) para índices/compat.
alter table transactions
  add column if not exists occurred_at timestamptz not null default now();

alter table transactions
  add column if not exists participant_id uuid references participants(id) on delete set null;

create index if not exists idx_txn_occurred_at  on transactions(occurred_at);
create index if not exists idx_txn_participant   on transactions(participant_id);

-- 4) Trigger updated_at para participants -------------------------------------
drop trigger if exists trg_participants_updated_at on participants;
create trigger trg_participants_updated_at before update on participants
  for each row execute function set_updated_at();

-- 5) RLS para participants (user_id = auth.uid()) -----------------------------
alter table participants enable row level security;
drop policy if exists participants_select on participants;
drop policy if exists participants_insert on participants;
drop policy if exists participants_update on participants;
drop policy if exists participants_delete on participants;
create policy participants_select on participants for select using (user_id = auth.uid());
create policy participants_insert on participants for insert with check (user_id = auth.uid());
create policy participants_update on participants for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy participants_delete on participants for delete using (user_id = auth.uid());
