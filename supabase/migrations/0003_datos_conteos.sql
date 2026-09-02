-- ============================================================
-- Exportable CONTEOS -> patrimonio (net_worth_snapshots/balances)
-- Generado desde: My Money v5.0 (1).xlsx  | hoja CONTEOS
-- Fotos: 15  | Regla: 'Debts' SUMA como activo (Por Cobrar)
-- Requiere: esquema 0001 + semillas 0002 aplicados, y login >=1 vez.
-- Idempotente: salta fotos cuya snapshot_date ya exista.
-- ============================================================
do $$
declare
  uid uuid;
  snap uuid;
  acc uuid;
begin
  select id into uid from auth.users order by created_at asc limit 1;
  if uid is null then raise exception 'No hay usuario en auth.users. Inicia sesion primero.'; end if;

  -- 2025-12-28  (fila Excel 5)  T/C=9.57
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2025-12-28') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2025-12-28',9.57,22004.52,2299.32) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,5813.0); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,332.13); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,16.6); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo Bs';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,4971.2); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,407.47); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,5536.6); end if;
  end if;

  -- 2025-12-30  (fila Excel 6)  T/C=9.6
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2025-12-30') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2025-12-30',9.6,30126.22,3138.15) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,23519.15); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,302.13); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo Bs';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,1011.4); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,401.41); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
  end if;

  -- 2026-01-07  (fila Excel 7)  T/C=9.6
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-01-07') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-01-07',9.6,17325.08,1804.7) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,2701.28); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,6643.93); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,1411.76); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo Bs';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,1091.4); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,407.47); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,125.0); end if;
  end if;

  -- 2026-02-24  (fila Excel 8)  T/C=9.02
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-02-24') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-02-24',9.02,17562.37,1947.05) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,1408.0); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.95); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.47); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo Bs';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,380.0); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,512.3); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,8100.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,1549.0); end if;
  end if;

  -- 2026-02-27  (fila Excel 9)  T/C=9.03
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-02-27') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-02-27',9.03,25783.62,2855.33) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,729.0); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.95); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,9424.1); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,512.3); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,8100.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,1549.0); end if;
  end if;

  -- 2026-02-02  (fila Excel 10)  T/C=9.06
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-02-02') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-02-02',9.06,25847.27,2852.9) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,729.0); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.95); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.24); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,9467.64); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,512.3); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,8100.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,1549.0); end if;
  end if;

  -- 2026-03-18  (fila Excel 11)  T/C=9.3
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-03-18') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-03-18',9.3,28735.01,3089.79) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.1); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,98.57); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.95); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,13086.0); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo Bs';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,590.0); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,512.3); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,8100.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,700.0); end if;
  end if;

  -- 2026-03-31  (fila Excel 12)  T/C=9.31
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-03-31') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-03-31',9.31,34907.0,3749.41) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.1); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,8.57); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.95); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,9574.52); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,697.89); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,16729.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,700.0); end if;
  end if;

  -- 2026-04-30  (fila Excel 13)  T/C=10.1
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-04-30') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-04-30',10.1,40592.4,4019.05) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.1); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,9.38); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.95); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,5452.55); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,590.24); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,27203.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,450.0); end if;
  end if;

  -- 2026-05-05  (fila Excel 14)  T/C=9.99
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-05-05') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-05-05',9.99,46396.74,4644.32) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.1); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,258.41); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.95); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,11539.28); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,590.24); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,27203.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
  end if;

  -- 2026-05-29  (fila Excel 15)  T/C=9.97
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-05-29') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-05-29',9.97,62720.59,6290.93) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.1); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,7375.01); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,20491.69); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,8119.25); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,605.42); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,19203.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
  end if;

  -- 2026-06-01  (fila Excel 16)  T/C=9.91
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-06-01') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-06-01',9.91,61806.3,6236.76) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.1); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,13906.8); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.55); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,25.27); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,825.74); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,37832.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,372.0); end if;
  end if;

  -- 2026-06-30  (fila Excel 17)  T/C=9.93
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-06-30') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-06-30',9.93,65983.19,6644.83) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.1); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,7019.13); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,1.99); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.0); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,305.03); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,956.64); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,47103.0); end if;
    select id into acc from accounts where user_id=uid and name='Por Cobrar';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,565.0); end if;
  end if;

  -- 2026-12-08  (fila Excel 18)  T/C=11.53
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-12-08') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-12-08',11.53,63141.63,5476.29) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.1); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,8425.35); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,11.99); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,1057.45); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,5286.66); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo Bs';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,780.0); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,799.79); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,36629.0); end if;
  end if;

  -- 2026-01-09  (fila Excel 19)  T/C=12.02
  if not exists (select 1 from net_worth_snapshots where user_id=uid and snapshot_date='2026-01-09') then
    insert into net_worth_snapshots(user_id,snapshot_date,exchange_rate,total_bob,total_usd)
      values(uid,'2026-01-09',12.02,51715.68,4302.47) returning id into snap;
    select id into acc from accounts where user_id=uid and name='Banco SOL';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,0.1); end if;
    select id into acc from accounts where user_id=uid and name='Fortaleza';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,3465.04); end if;
    select id into acc from accounts where user_id=uid and name='BMSC';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,12.01); end if;
    select id into acc from accounts where user_id=uid and name='BNB';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,8734.62); end if;
    select id into acc from accounts where user_id=uid and name='IDEPRO CA';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,10284.8); end if;
    select id into acc from accounts where user_id=uid and name='Efectivo USD';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,150.0); end if;
    select id into acc from accounts where user_id=uid and name='USDT';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,783.37); end if;
    select id into acc from accounts where user_id=uid and name='DPF Congelado';
    if acc is not null then insert into net_worth_balances(user_id,snapshot_id,account_id,amount) values(uid,snap,acc,18000.0); end if;
  end if;

  raise notice 'Migracion CONTEOS completada.';
end $$;
