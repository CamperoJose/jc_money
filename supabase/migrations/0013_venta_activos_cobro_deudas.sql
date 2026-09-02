-- ============================================================
-- Movimientos de venta de activos y cobro de deudas hacia una cuenta destino.
-- El registro guarda a qué cuenta ingresó el dinero y la fecha; el job diario
-- inyecta ese movimiento en la cuenta destino el día del evento (y el activo
-- deja de contar en la cuenta Activos / la deuda baja de Por Cobrar).
-- Idempotente.
-- ============================================================

-- Activos: cuenta a la que ingresó la venta.
alter table assets
  add column if not exists sold_account_id uuid references accounts(id) on delete set null;

-- Deudas: cuenta y fecha del cobro (dónde y cuándo me pagaron).
alter table debts
  add column if not exists paid_account_id uuid references accounts(id) on delete set null;
alter table debts
  add column if not exists collected_date date;
