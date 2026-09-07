-- Reproduce el caso real del 3 de septiembre de la bitácora.
\set u '11111111-1111-1111-1111-111111111111'
insert into accounts (id,user_id,name,type,currency) values
 ('a0000000-0000-0000-0000-000000000001', :'u', 'Efectivo Bs','efectivo','BOB'),
 ('a0000000-0000-0000-0000-000000000002', :'u', 'BNB','banco','BOB'),
 ('a0000000-0000-0000-0000-000000000003', :'u', 'USDT','stablecoin','USDT'),
 ('a0000000-0000-0000-0000-000000000004', :'u', 'DPF Congelado','dpf','BOB'),
 ('a0000000-0000-0000-0000-000000000005', :'u', 'Por Cobrar','por_cobrar','BOB'),
 ('a0000000-0000-0000-0000-000000000006', :'u', 'Activos','activo','BOB');

-- Foto MANUAL del 3 de septiembre a las 09:06 (hora Bolivia = 13:06 UTC).
insert into net_worth_snapshots (id,user_id,snapshot_date,snapshot_at,kind,exchange_rate,total_bob)
 values ('50000000-0000-0000-0000-000000000001', :'u', '2026-09-03','2026-09-03T13:06:00Z','manual',12.32,null);
insert into net_worth_balances (user_id,snapshot_id,account_id,amount) values
 (:'u','50000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',685.30),
 (:'u','50000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',603.14),
 (:'u','50000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003',783.70),
 (:'u','50000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004',39000),
 (:'u','50000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000005',1605),
 (:'u','50000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000006',11571);

-- Los tres gastos del día, todos en Efectivo Bs (3 + 18 + 3 = 24).
insert into transactions (user_id,txn_date,type,amount,account_id) values
 (:'u','2026-09-03','gasto',3,'a0000000-0000-0000-0000-000000000001'),
 (:'u','2026-09-03','gasto',18,'a0000000-0000-0000-0000-000000000001'),
 (:'u','2026-09-03','gasto',3,'a0000000-0000-0000-0000-000000000001');

-- Derivadas: DPF 39000, Activos 11571, y deudas por 1745 (Por Cobrar sube de 1605).
insert into dpf_deposits (user_id,principal,status) values (:'u',39000,'activo');
insert into assets (user_id,name,acquisition_cost,currency,status,counts_in_patrimonio) values (:'u','Bienes',11571,'BOB','activo',true);
insert into debts (user_id,debt_date,amount,paid_amount,status,counterparty) values
 (:'u','2026-08-20',1605,0,'pendiente','Deuda vieja'),
 (:'u','2026-09-03',140,0,'pendiente','Deuda nueva del día');
