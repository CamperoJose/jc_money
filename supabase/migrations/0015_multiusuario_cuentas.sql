-- =============================================================================
-- MyMoney Web — Multiusuario: cuentas administrables por cada usuario
-- NO borra ni recrea cuentas, balances, transacciones ni histórico existente.
-- Los usuarios nuevos registran sus propias cuentas desde Parámetros.
-- =============================================================================

alter table accounts add column if not exists system_key text;

create unique index if not exists ux_accounts_user_system_key
  on accounts(user_id, system_key)
  where system_key is not null;

-- Conserva el mismo id de la cuenta histórica Activos y evita que el cálculo
-- patrimonial dependa únicamente de su nombre visible.
update accounts
set system_key = 'assets'
where system_key is null and name = 'Activos';

comment on column accounts.system_key is
  'Clave interna opcional para cuentas derivadas. No depende del nombre visible.';

-- Los usuarios existentes conservan toda su información y reciben su correo
-- autenticado como destinatario inicial. No se pisa una configuración existente.
insert into app_settings(user_id, key, value)
select u.id, 'email_destino', u.email
from auth.users u
where u.email is not null
  and not exists (
    select 1 from app_settings s
    where s.user_id = u.id and s.key = 'email_destino'
  );
