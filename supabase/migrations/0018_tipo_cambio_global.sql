-- Tipo de cambio global: la cotización del BCB es información compartida.
-- Todos los usuarios deben ver exactamente el mismo histórico.

-- Si existen filas duplicadas de distintos usuarios, conserva la más reciente.
with duplicados as (
  select id,
         row_number() over (
           partition by rate_date, cod_indicador, cod_moneda
           order by fetched_at desc, created_at desc, id desc
         ) as rn
  from exchange_rates
)
delete from exchange_rates e
using duplicados d
where e.id = d.id
  and d.rn > 1;

alter table exchange_rates
  drop constraint if exists exchange_rates_user_id_rate_date_cod_indicador_cod_moneda_key;

alter table exchange_rates
  drop constraint if exists exchange_rates_user_id_fkey;

alter table exchange_rates
  alter column user_id drop not null;

-- Las filas dejan de pertenecer a un usuario concreto.
update exchange_rates set user_id = null where user_id is not null;

create unique index if not exists ux_exchange_rates_global
  on exchange_rates(rate_date, cod_indicador, cod_moneda);

alter table exchange_rates enable row level security;

drop policy if exists exchange_rates_select on exchange_rates;
drop policy if exists exchange_rates_insert on exchange_rates;
drop policy if exists exchange_rates_update on exchange_rates;
drop policy if exists exchange_rates_delete on exchange_rates;

-- Lectura compartida para cualquier usuario autenticado.
create policy exchange_rates_select
  on exchange_rates for select
  using (auth.uid() is not null);

-- No se permiten escrituras desde el navegador. El job BCB usa service_role,
-- que omite RLS, y es el único flujo que actualiza la cotización compartida.
