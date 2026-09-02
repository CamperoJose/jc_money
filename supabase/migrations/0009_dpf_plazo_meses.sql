-- ============================================================
-- DPF: plazo en MESES (el interés es anual y se prorratea por meses).
-- - term_months: nuevo plazo base del cálculo.
-- - Se recalcula la ganancia con la base mensual (capital · tasa · meses/12),
--   respetando cobra_iva (si false, líquido = bruto).
-- La fecha de liberación (end_date) NO se toca: pasa a ser editable manualmente.
-- Idempotente.
-- ============================================================

alter table dpf_deposits
  add column if not exists term_months integer;

-- Estima meses desde los días existentes (≈30 días/mes) para las filas ya cargadas.
update dpf_deposits
  set term_months = greatest(1, round(term_days / 30.0))
  where term_months is null and term_days is not null;

-- Recalcula ganancias con la base mensual para las filas existentes.
update dpf_deposits
  set gcia_economica   = round(principal * annual_rate * term_months / 12.0, 2),
      gcia_financiera  = round(principal * annual_rate * term_months / 12.0 * (case when cobra_iva then 0.87 else 1 end), 2),
      rc_iva_retencion = round(principal * annual_rate * term_months / 12.0 * (case when cobra_iva then 0.13 else 0 end), 2)
  where term_months is not null;
