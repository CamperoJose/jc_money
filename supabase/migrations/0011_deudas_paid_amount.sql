-- ============================================================
-- Deudas (que me deben): saldo pagado para soportar cobros parciales.
-- El saldo por cobrar = amount - paid_amount (para status 'parcial').
-- Idempotente.
-- ============================================================
alter table debts
  add column if not exists paid_amount numeric(16,2) not null default 0;
