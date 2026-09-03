-- ============================================================
-- Asistente IA (registro por voz asíncrono + auditoría).
--  - ai_requests: histórico de cada solicitud por voz (estado, resultado,
--    transcripción, correo enviado, etc.) para auditoría.
--  - api_ingest_tokens: token de larga duración (1 por usuario) para que un
--    Shortcut / Action Button de iOS mande audio sin sesión web. Regenerable.
-- Idempotente. RLS por user_id.
-- ============================================================

do $$ begin
  create type ai_request_status as enum ('procesando','completado','parcial','incompleto','error');
exception when duplicate_object then null; end $$;

create table if not exists ai_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  origen        text not null default 'app',          -- 'app' | 'shortcut'
  status        ai_request_status not null default 'procesando',
  audio_mime    text,
  transcripcion text,                                 -- lo que el modelo entendió (audio → texto)
  n_gastos      int not null default 0,               -- gastos registrados
  n_deudas      int not null default 0,               -- deudas registradas
  resumen       text,                                 -- texto legible de lo registrado
  detalle       jsonb,                                -- items + resultado (auditoría)
  error         text,                                 -- motivo si falló / faltó dato crítico
  correo_ok     boolean not null default false        -- si se envió el correo
);

create index if not exists idx_ai_requests_user_created on ai_requests(user_id, created_at desc);

create table if not exists api_ingest_tokens (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  token       text not null unique,
  created_at  timestamptz not null default now(),
  rotated_at  timestamptz not null default now()
);

-- Token inicial para el usuario existente (si aún no tiene).
do $$
declare uid uuid;
begin
  select id into uid from auth.users order by created_at asc limit 1;
  if uid is not null and not exists (select 1 from api_ingest_tokens where user_id = uid) then
    insert into api_ingest_tokens (user_id, token)
      values (uid, replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''));
  end if;
end $$;

-- RLS
do $$
begin
  execute 'alter table ai_requests enable row level security';
  execute 'drop policy if exists ai_requests_select on ai_requests';
  execute 'drop policy if exists ai_requests_insert on ai_requests';
  execute 'drop policy if exists ai_requests_update on ai_requests';
  execute 'drop policy if exists ai_requests_delete on ai_requests';
  execute 'create policy ai_requests_select on ai_requests for select using (user_id = auth.uid())';
  execute 'create policy ai_requests_insert on ai_requests for insert with check (user_id = auth.uid())';
  execute 'create policy ai_requests_update on ai_requests for update using (user_id = auth.uid()) with check (user_id = auth.uid())';
  execute 'create policy ai_requests_delete on ai_requests for delete using (user_id = auth.uid())';

  execute 'alter table api_ingest_tokens enable row level security';
  execute 'drop policy if exists ingest_tokens_select on api_ingest_tokens';
  execute 'drop policy if exists ingest_tokens_all on api_ingest_tokens';
  -- El usuario puede leer/rotar su propio token; la validación del token en el
  -- endpoint de ingesta usa la service role (sin sesión).
  execute 'create policy ingest_tokens_select on api_ingest_tokens for select using (user_id = auth.uid())';
  execute 'create policy ingest_tokens_all on api_ingest_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
end $$;
