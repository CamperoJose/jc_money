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

## Proyecto Next.js 🔒 (necesita credenciales Supabase)
- [ ] 🤖 `create-next-app` (App Router, TypeScript, Tailwind).
- [ ] 🤖 Instalar y configurar shadcn/ui (CLI) + componentes base (button, input, dialog, table, card…).
- [ ] 🤖 Instalar Phosphor Icons (React) — usar pesos Fill/Duotone para acentos.
- [ ] 🤖 Instalar AG Grid Community y Tremor/Recharts (se usan en Fase 1).
- [ ] 🤖 Cliente Supabase (browser + server) y helpers de sesión.
- [ ] 🤖 `.env.local.example` con todas las variables (sin valores reales). Nunca commitear `.env.local`.
- [ ] 🤖 Estructura de carpetas: `app/`, `app/api/`, `lib/`, `components/`.

## Tema visual 🔒 (necesita export de tweakcn del usuario)
- [ ] 👤 Diseñar tema en https://tweakcn.com/editor/theme (oscuro, acento dorado). → `cosas_manuales.md`
- [ ] 👤 Exportar variables CSS y pasarlas a Claude.
- [ ] 🤖 Pegar variables en `globals.css` + ajustar `tailwind.config`. **No inventar paleta.**

## Login + Deploy
- [ ] 🤖 Página de login con Google; página protegida de prueba que lea algo de la DB.
- [ ] 👤 Crear proyecto en Vercel, importar el repo, cargar variables de entorno. → `cosas_manuales.md`
- [ ] 🤖 Deploy inicial y verificación end-to-end (login → leer DB).

## Cierre de fase
- [ ] 🤖 Actualizar `claude/estado.md` con el estado y el punto de retome.
