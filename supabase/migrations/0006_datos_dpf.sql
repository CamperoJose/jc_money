-- ============================================================
-- Exportable DPF LADDERING REAL -> dpf_deposits
-- Generado desde: My Money v5.0.xlsx | hoja "DPF LADDERING REAL"
-- 5 depósitos (4 cobrados + 1 activo al 2026-09).
-- Requiere: esquema 0001 aplicado, y login >= 1 vez.
-- Idempotente: salta cada DPF cuyo (id_dpf_externo, start_date) ya exista.
--
-- Convención de intereses (igual que en la app):
--   bruto   = principal * tasa * plazo / 365
--   líquido = bruto * 0.87   (retención RC-IVA 13%)
-- Los saldos aquí NO afectan patrimonio ni gastos (módulo independiente).
-- ============================================================
do $$
declare
  uid uuid;
begin
  select id into uid from auth.users order by created_at asc limit 1;
  if uid is null then
    raise exception 'No hay usuario en auth.users. Inicia sesion primero.';
  end if;

  -- Nº 1 | 3000164272 | 2026-02-24 → 2026-05-25 | 8.000 Bs | 90 días | 7,70% | cobrado
  if not exists (select 1 from dpf_deposits where user_id=uid and id_dpf_externo='3000164272' and start_date='2026-02-24') then
    insert into dpf_deposits(user_id, nro_dpf, id_dpf_externo, start_date, end_date, principal, term_days, annual_rate, status,
      gcia_economica, gcia_financiera, rc_iva_retencion)
    values(uid, '1', '3000164272', '2026-02-24', '2026-05-25', 8000, 90, 0.0770, 'pagado',
      round(8000*0.0770*90/365.0, 2), round(8000*0.0770*90/365.0*0.87, 2), round(8000*0.0770*90/365.0*0.13, 2));
  end if;

  -- Nº 2 | 3000175559 | 2026-03-26 → 2026-06-24 | 8.729 Bs | 90 días | 7,70% | cobrado
  if not exists (select 1 from dpf_deposits where user_id=uid and id_dpf_externo='3000175559' and start_date='2026-03-26') then
    insert into dpf_deposits(user_id, nro_dpf, id_dpf_externo, start_date, end_date, principal, term_days, annual_rate, status,
      gcia_economica, gcia_financiera, rc_iva_retencion)
    values(uid, '2', '3000175559', '2026-03-26', '2026-06-24', 8729, 90, 0.0770, 'pagado',
      round(8729*0.0770*90/365.0, 2), round(8729*0.0770*90/365.0*0.87, 2), round(8729*0.0770*90/365.0*0.13, 2));
  end if;

  -- Nº 3 | 3000164272 | 2026-04-30 → 2026-07-29 | 10.474 Bs | 90 días | 7,70% | cobrado
  if not exists (select 1 from dpf_deposits where user_id=uid and id_dpf_externo='3000164272' and start_date='2026-04-30') then
    insert into dpf_deposits(user_id, nro_dpf, id_dpf_externo, start_date, end_date, principal, term_days, annual_rate, status,
      gcia_economica, gcia_financiera, rc_iva_retencion)
    values(uid, '3', '3000164272', '2026-04-30', '2026-07-29', 10474, 90, 0.0770, 'pagado',
      round(10474*0.0770*90/365.0, 2), round(10474*0.0770*90/365.0*0.87, 2), round(10474*0.0770*90/365.0*0.13, 2));
  end if;

  -- Nº 4 | 3000198304 | 2026-05-31 → 2026-08-29 | 18.629 Bs | 90 días | 6,60% | cobrado
  if not exists (select 1 from dpf_deposits where user_id=uid and id_dpf_externo='3000198304' and start_date='2026-05-31') then
    insert into dpf_deposits(user_id, nro_dpf, id_dpf_externo, start_date, end_date, principal, term_days, annual_rate, status,
      gcia_economica, gcia_financiera, rc_iva_retencion)
    values(uid, '4', '3000198304', '2026-05-31', '2026-08-29', 18629, 90, 0.0660, 'pagado',
      round(18629*0.0660*90/365.0, 2), round(18629*0.0660*90/365.0*0.87, 2), round(18629*0.0660*90/365.0*0.13, 2));
  end if;

  -- Nº 5 | 3000206677 | 2026-06-30 → 2026-09-28 | 18.000 Bs | 90 días | 6,60% | ACTIVO
  if not exists (select 1 from dpf_deposits where user_id=uid and id_dpf_externo='3000206677' and start_date='2026-06-30') then
    insert into dpf_deposits(user_id, nro_dpf, id_dpf_externo, start_date, end_date, principal, term_days, annual_rate, status,
      gcia_economica, gcia_financiera, rc_iva_retencion)
    values(uid, '5', '3000206677', '2026-06-30', '2026-09-28', 18000, 90, 0.0660, 'activo',
      round(18000*0.0660*90/365.0, 2), round(18000*0.0660*90/365.0*0.87, 2), round(18000*0.0660*90/365.0*0.13, 2));
  end if;
end $$;
