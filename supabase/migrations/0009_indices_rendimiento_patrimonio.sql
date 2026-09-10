-- =============================================================================
-- Optimización de consultas de patrimonio
--
-- Mantiene intacta la lógica funcional y RLS. Los índices siguen el patrón
-- real de acceso: filtrar por usuario y ordenar por fecha/hora.
-- =============================================================================

create index if not exists idx_snapshots_user_at
  on net_worth_snapshots(user_id, snapshot_at);

create index if not exists idx_balances_user_snapshot
  on net_worth_balances(user_id, snapshot_id);
