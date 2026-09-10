-- =============================================================================
-- MyMoney Web — Multiusuario: cuentas administrables por cada usuario
--
-- Las cuentas ya pertenecen a user_id. Esta migración agrega una clave interna
-- opcional para cuentas derivadas que no deben depender de su nombre visible.
-- NO borra ni recrea cuentas, balances, transacciones ni histórico existente.
-- =============================================================================

alter table accounts
  add column if not exists system_key text;

create unique index if not exists ux_accounts_user_system_key
  on accounts(user_id, system_key)
  where system_key is not null;

-- Conserva la cuenta histórica "Activos" como cuenta derivada especial.
-- Solo se marca la cuenta existente; no se crea una cuenta nueva.
update accounts
set system_key = 'assets'
where system_key is null
  and name = 'Activos';

-- Las cuentas DPF y Por Cobrar siguen identificándose por su type actual.
-- No se les asigna system_key para evitar conflictos si algún usuario ya tiene
-- más de una cuenta de esos tipos.

comment on column accounts.system_key is
  'Clave interna opcional para cuentas derivadas. No depende del nombre visible.';
