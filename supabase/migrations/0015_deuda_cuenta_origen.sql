-- ============================================================
-- Cuenta de ORIGEN de una deuda por cobrar: de qué cuenta salió el dinero
-- cuando se prestó.
--
-- Con esto el ciclo de una deuda queda cerrado en el patrimonio:
--   1. Al prestar: sale de `source_account_id` y entra a la cuenta derivada
--      "Por Cobrar". El patrimonio TOTAL no cambia, solo su composición.
--   2. Al cobrar (ya existía, migración 0013): sale de "Por Cobrar" y entra a
--      `paid_account_id`. El total tampoco cambia.
-- El job diario aplica ambos movimientos el día del evento.
--
-- Idempotente.
-- ============================================================

alter table debts
  add column if not exists source_account_id uuid references accounts(id) on delete set null;

comment on column debts.source_account_id is
  'Cuenta de la que salió el dinero al prestar. El job la descuenta el día del préstamo.';
