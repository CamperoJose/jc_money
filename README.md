# MyMoney Web (jc_money)

Aplicación web personal de gestión de finanzas e inversiones, de un solo usuario y **costo cero**.
Migra una planilla de Excel a una base de datos real y la expone en un apartado **Tracking**,
empezando por **gestión de patrimonio**.

## Estado

**Fase 0 (Preparación) — en curso.** Aún no hay app Next.js; está esperando tareas manuales del
usuario (credenciales Supabase, tema de tweakcn). Ya existen la documentación, el esquema SQL y las
semillas. Ver [`claude/estado.md`](./claude/estado.md).

## Dónde está cada cosa

| Ruta | Qué es |
|------|--------|
| [`CLAUDE.md`](./CLAUDE.md) | Guía maestra para sesiones de Claude en este repo |
| [`cosas_manuales.md`](./cosas_manuales.md) | Tareas que gestiona el usuario (Supabase, Google, Vercel…) |
| [`claude/`](./claude/) | Roadmap, modelo de datos, decisiones y **todos los TODOs** |
| [`supabase/migrations/`](./supabase/migrations/) | Esquema SQL con RLS + semillas |
| [`docs/especificacion.md`](./docs/especificacion.md) | Especificación maestra original |

## Stack

Next.js · Supabase (Postgres + Auth) · Vercel · shadcn/ui + Tailwind · Phosphor Icons ·
AG Grid Community · Tremor/Recharts · Gemini (voz) · Nodemailer. Todo en planes gratuitos.

## Cómo continuar

1. El usuario ejecuta las tareas de [`cosas_manuales.md`](./cosas_manuales.md).
2. Claude aplica el esquema a Supabase, scaffolda Next.js y construye el módulo de **Patrimonio**.

Ver la ruta completa en [`claude/roadmap.md`](./claude/roadmap.md).
