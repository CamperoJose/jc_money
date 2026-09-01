# Fase 0 — Preparación · TODOs

Meta: DB + auth funcionando antes de tocar UI. 🤖 Claude · 👤 usuario · 🔒 bloqueado.

## Documentación (hecho)
- [x] `CLAUDE.md`, carpeta `claude/`, `cosas_manuales.md`.
- [x] Esquema SQL con RLS (`supabase/migrations/0001_schema_inicial.sql`).
- [x] Semillas de catálogos (`supabase/migrations/0002_seed_catalogos.sql`).

## Supabase
- [ ] 👤 Crear proyecto en Supabase (región cercana, plan gratuito). → `cosas_manuales.md`
- [ ] 👤 Guardar `SUPABASE_URL`, `anon key`, `service_role key` (esta última solo server-side).
- [ ] 🤖/👤 Aplicar `0001` y `0002` (SQL Editor de Supabase o `supabase db push` con CLI).
- [ ] 🤖 Verificar que RLS está activo en todas las tablas y que las policies `user_id = auth.uid()` existen.
- [ ] 🤖 Definir cómo se asigna `user_id` en el insert (default `auth.uid()` en columnas o en la API).

## Autenticación Google
- [ ] 👤 Crear credenciales OAuth en Google Cloud (Client ID/Secret). → `cosas_manuales.md`
- [ ] 👤 Habilitar proveedor Google en Supabase Auth y pegar Client ID/Secret.
- [ ] 👤 Añadir las Redirect URLs (local y Vercel) en Google y en Supabase.
- [ ] 🤖 Middleware/lista blanca: permitir **solo** el correo del usuario; rechazar el resto.

## Proyecto Next.js — HECHO
- [x] 🤖 Proyecto Next.js 15 (App Router, TypeScript) — hecho a mano (no create-next-app).
- [x] 🤖 shadcn/ui base (button, card, table). Faltan más componentes según se necesiten (input, dialog, select…).
- [x] 🤖 Phosphor Icons (React) integrado (pesos duotone/bold).
- [x] 🤖 Recharts instalado. **Falta AG Grid Community** (grid editable de PC) — pendiente Fase 1.
- [x] 🤖 Cliente Supabase browser + server (`lib/supabase/`) y refresco de sesión.
- [x] 🤖 `.env.local.example` con todas las variables.
- [x] 🤖 Estructura `app/`, `app/api/`, `lib/`, `components/`.

## Tema visual — HECHO
- [x] 👤 Usuario diseñó y exportó el tema de tweakcn (verde, Tailwind v4).
- [x] 🤖 Aplicado en `app/globals.css` tal cual. **No se inventó paleta.**

## Login + Deploy
- [x] 🤖 Página de login con Google + middleware con lista blanca (`ALLOWED_EMAIL`).
- [x] 🤖 Página protegida `/tracking/patrimonio` que lee de la DB.
- [x] 👤 Proyecto creado en Vercel e importado el repo.
- [ ] 👤 Cargar variables de entorno en Vercel + definir **rama de producción**. → `cosas_manuales.md`
- [ ] 👤 Aplicar `0001` (esquema) y `0002` (semillas) en Supabase. → `docs/desarrollo-local.md`
- [ ] 👤/🤖 Verificación end-to-end (login → leer DB) — pendiente hasta aplicar el esquema.

## Cierre de fase
- [x] 🤖 `claude/estado.md` actualizado con el punto de retome.
