# Ruta / Roadmap — MyMoney Web

Objetivo del primer hito: llevar el Excel a una base de datos real y exponerlo en **Tracking**,
empezando por **Patrimonio** (prioridad del usuario y hoja con más datos reales).

Leyenda: 🔒 bloqueado por tarea manual del usuario · 🤖 lo hace Claude · 👤 lo hace el usuario.

---

## Ruta recomendada de arranque (los próximos pasos concretos)

```
1. 👤  Tareas manuales base  →  ver cosas_manuales.md
       (crear proyecto Supabase, Google OAuth, tema tweakcn, GitHub repo/secrets)
2. 🤖  Aplicar el esquema SQL + semillas a Supabase           [Fase 0]
3. 🤖  Scaffold Next.js + shadcn + Phosphor + auth Google     [Fase 0]  🔒 (necesita 1)
4. 🤖  Aplicar tema tweakcn                                    [Fase 0]  🔒 (necesita tema)
5. 🤖  Script de migración del Excel (Python) + dry-run       [Fase 1]
6. 🤖  Módulo PATRIMONIO (API + grid + dashboard)             [Fase 1]  ← primer valor visible
7. 🤖  Módulo GASTOS, luego DPF, luego DEUDAS                 [Fase 1]
8. 🤖  Automatización: voz, recordatorios, respaldos          [Fase 2]
9. 🤖  Simulador de proyección, docs API, Siri                [Fase 3]
```

El "primer valor visible" para el usuario es el **paso 6: ver su patrimonio en la web**, con la
curva histórica en BOB y USD. Todo lo anterior es cimiento para que eso persista bien desde el inicio.

---

## Fase 0 — Preparación

Meta: esquema de DB + autenticación funcionando **antes** de tocar la interfaz.

- [x] Documentación de planificación (`claude/`, `CLAUDE.md`, `cosas_manuales.md`).
- [x] Esquema SQL completo con RLS (`supabase/migrations/0001_schema_inicial.sql`).
- [x] Semillas de catálogos (`supabase/migrations/0002_seed_catalogos.sql`).
- [x] 👤 Proyecto Supabase creado (credenciales entregadas). [ ] 👤 aplicar migraciones (pendiente).
- [x] 👤 Google OAuth configurado y pegado en Supabase.
- [x] 🤖 Scaffold Next.js (App Router) + Tailwind v4 + shadcn/ui + Phosphor.
- [x] 👤/🤖 Tema de tweakcn exportado y aplicado en `app/globals.css`.
- [x] 🤖 Login con Google + middleware de lista blanca (solo el correo del usuario).
- [ ] 👤 Deploy en Vercel (repo importado; falta env vars + rama de producción).

Detalle: `claude/todos/fase-0-preparacion.md`.

## Fase 1 — Primer hito: Tracking

Meta: migrar el Excel y construir Tracking (híbrido: grid en PC, tarjetas/dashboards en celular).
**Orden: Patrimonio → Gastos → DPF → Deudas.**

- [x] 🤖 Script de migración en Python con **dry-run** (CONTEOS → patrimonio). [ ] 👤 ejecutarlo.
- [~] 🤖 API + UI **Patrimonio**: lectura (curva BOB/USD, distribución por moneda, tabla) HECHA;
      falta grid editable AG Grid, alta/edición desde la web, y distribución por cuenta.
- [ ] 🤖 API + UI **Gastos** (grid con filtros, dashboard categoría/mes, ingreso vs gasto).
- [ ] 🤖 API + UI **Inversiones DPF** (grid + panel de indicadores).
- [ ] 🤖 API + UI **Deudas** (grid simple).
- [ ] (Opcional) `budgets` en UI o pospuesto.

Detalle: `claude/todos/fase-1-tracking.md`.

## Fase 2 — Automatización

- [ ] 🤖 Registro de gasto por **voz** con Gemini Flash (audio → JSON → validación → insert).
- [ ] 🤖 Recordatorios por correo (vencimiento DPF, deudas) — Nodemailer + SMTP Gmail.
- [ ] 🤖 Correo de estado periódico (patrimonio, gasto del mes, próximos vencimientos).
- [ ] 🤖 Scheduler externo (GitHub Actions / cron-job.org) que llama a rutas protegidas por token.
- [ ] 🤖 Respaldos a Google Drive (SQL + CSV) con service account, versionados por fecha.

Detalle: `claude/todos/fase-2-automatizacion.md`.

## Fase 3 — Avanzado

- [ ] 🤖 Simulador de proyección de laddering pulido (recalcula al vuelo).
- [ ] 🤖 Documentación de la API.
- [ ] 🤖 Ruta de ingesta lista para el Atajo de Siri (token Bearer).

Detalle: `claude/todos/fase-3-avanzado.md`.

---

## Al cerrar cada fase

Anotar el estado en `claude/estado.md` para poder retomar sin recontextualizar.
