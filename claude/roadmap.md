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
- [x] 👤 Deploy en Vercel (en producción; la promoción a producción es **manual**).

Detalle: `claude/todos/fase-0-preparacion.md`.

## Fase 1 — Primer hito: Tracking

Meta: migrar el Excel y construir Tracking (híbrido: grid en PC, tarjetas/dashboards en celular).
**Orden: Patrimonio → Gastos → DPF → Deudas.**

- [x] 🤖 Script de migración en Python con **dry-run** (CONTEOS → patrimonio). [x] 👤 ejecutado.
- [x] 🤖 API + UI **Patrimonio**: dashboard, ABM, registros con diff por cuenta, tendencias y
      tipo de cambio. (Se descartó AG Grid: la matriz propia cubre el caso.)
- [x] 🤖 API + UI **Gastos** (filtros, dashboard categoría/mes, ingreso vs gasto).
- [x] 🤖 API + UI **Inversiones DPF** (registros + panel de indicadores + simulador de laddering).
- [x] 🤖 API + UI **Deudas por cobrar** (incluye "recibir cobro" hacia una cuenta destino).
- [x] 🤖 API + UI **Activos** (bienes vendibles, con venta hacia una cuenta destino).
- [x] 🤖 `budgets` en UI (**Presupuestos**, con avance mensual).

> **Fuera de alcance:** deudas propias (pasivos). El usuario no tiene. Ver decisión E2.

Detalle: `claude/todos/fase-1-tracking.md`.

## Fase 2 — Automatización

- [x] 🤖 Registro por **voz** con Gemini/Vertex (audio → JSON → validación → insert), asíncrono,
      con correo-recibo y pestaña de auditoría "Solicitudes por voz".
- [x] 🤖 Ingesta por token de larga duración para el **Atajo / botón de acción de iOS**.
- [x] 🤖 Correo de estado periódico (`api/jobs/correos`, Nodemailer + SMTP Gmail).
- [x] 🤖 Scheduler externo (GitHub Actions) que llama a rutas protegidas por token.
- [x] 🤖 Job diario de patrimonio (cierre a las 00:30 Bolivia).
- [ ] 🤖 Recordatorios por correo (vencimiento de DPF, deudas por cobrar) — ruta reservada, sin implementar.
- [ ] 🤖 `api/estado`: endpoint de salud — ruta reservada, sin implementar.
- [ ] 🤖 Alertas de presupuesto al superar el umbral.
- ~~Respaldos a Google Drive~~ — **descartado por el usuario** (decisión E3).

Detalle: `claude/todos/fase-2-automatizacion.md`.

## Fase 3 — Avanzado

- [x] 🤖 Simulador de proyección de laddering (recalcula al vuelo).
- [x] 🤖 Ruta de ingesta lista para el Atajo de iOS (token Bearer de larga duración).
- [ ] 🤖 **Tests automatizados (Vitest)** — la prioridad actual. Ver `claude/estado.md`.
- [ ] 🤖 Documentación de la API.

Detalle: `claude/todos/fase-3-avanzado.md`.

---

## Al cerrar cada fase

Anotar el estado en `claude/estado.md` para poder retomar sin recontextualizar.
