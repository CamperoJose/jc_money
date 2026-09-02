-- ============================================================
-- DPF: bandera de cobro de IVA (RC-IVA) y declaración explícita de cobro.
-- - cobra_iva: si el DPF retiene RC-IVA (13%). Por defecto FALSE (hoy ninguno).
-- - paid_account_id: a qué cuenta/banco se cobró el DPF (al marcarlo pagado).
-- - paid_at: fecha en que se cobró.
-- Idempotente.
-- ============================================================

alter table dpf_deposits
  add column if not exists cobra_iva boolean not null default false;

alter table dpf_deposits
  add column if not exists paid_account_id uuid references accounts(id) on delete set null;

alter table dpf_deposits
  add column if not exists paid_at date;

-- Los DPF ya cargados (migración 0006) NO cobran IVA: se deja en el default false.
-- Recalcula la ganancia líquida = bruta cuando no cobra IVA (sin retención),
-- para dejar consistentes los datos existentes con la nueva regla.
update dpf_deposits
  set gcia_financiera = gcia_economica,
      rc_iva_retencion = 0
  where cobra_iva = false and gcia_economica is not null;
