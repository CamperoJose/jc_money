# Estado del proyecto (bitácora de retome)

> Actualiza este archivo al cerrar cada bloque de trabajo, para retomar sin recontextualizar.

## Última actualización: 2026-09-01

### Fase actual: 0 (Preparación) — en curso

### Hecho
- Análisis completo del Excel `My_Money_v5.0.xlsx` (5 hojas). Ver `claude/analisis-excel.md`.
- Documentación de planificación: `CLAUDE.md`, carpeta `claude/` (roadmap, modelo de datos,
  decisiones, todos por fase), `cosas_manuales.md`.
- Esquema SQL inicial con RLS: `supabase/migrations/0001_schema_inicial.sql`.
- Semillas de catálogos: `supabase/migrations/0002_seed_catalogos.sql`.
- Hallazgo clave: la columna `Debts` de CONTEOS se **suma** al patrimonio (activo por cobrar), no
  se resta como pasivo. Discrepa de la spec §7.2 → decisión abierta C1 en `decisiones.md`.

### Punto de retome (próximo paso)
1. El usuario ejecuta las tareas marcadas 👤 en `cosas_manuales.md` (Supabase, Google OAuth, tweakcn).
2. Con las credenciales de Supabase: aplicar las migraciones y verificar RLS.
3. Scaffold del proyecto Next.js (Fase 0) → luego migración + módulo **Patrimonio** (Fase 1).

### Esperando del usuario (bloqueantes)
- Credenciales de Supabase (URL + keys).
- Tema exportado de tweakcn (no se estiliza nada sin él).
- Confirmar decisión C1 (`Debts` de CONTEOS = por cobrar).
- Credenciales Google OAuth para el login.

### Decisiones abiertas pendientes de confirmar
- C1 (`Debts` = activo por cobrar), C3 (fechas con posible typo), C4 (dato mal ubicado en DEUDAS).
- Preguntas de spec §18 (categorías, anticipación recordatorios, frecuencia correo, retención respaldos, budgets en Fase 1).
