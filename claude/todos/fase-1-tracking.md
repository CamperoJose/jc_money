# Fase 1 — Tracking · TODOs

> **Fase cerrada.** Todos los módulos están en producción. Este archivo queda como registro de lo
> hecho y de lo poco que se decidió no hacer. El trabajo vivo está en `claude/estado.md`
> ("Punto de retome") y en `claude/todos/fase-2-automatizacion.md`.

Patrón adoptado: **API primero** (la UI consume la API, nunca la DB directa) y **doble vista** —
tabla densa en PC (`hidden lg:block`), lista de tarjetas en celular (`lg:hidden`) con la **misma**
información. Ambas hay que mantenerlas: tocar solo la tabla deja el celular sin el cambio.

## Migración del Excel
- [x] 🤖 Script Python `scripts/migracion/importar_excel.py` (openpyxl + psycopg2), CONTEOS → patrimonio.
- [x] 🤖 **Dry-run** por defecto: reporte de fotos válidas, filas descartadas y totales antes de escribir.
- [x] 🤖 Descarta datos sucios de CONTEOS (filas sin FECHA/T/C válidos: nota, #ERROR!, cálculos sueltos).
- [x] 🤖 Idempotente por fecha (salta fotos ya existentes).
- [x] 👤 Ejecutado por el usuario. Los datos históricos de CONTEOS están en producción (`0003`).
- [x] 🤖 DPF reales cargados por migración (`0006`).
- [ ] 🤖 (Nunca hizo falta) Extender el script a GASTOS y DEUDAS: el usuario los fue cargando desde
      la app. Solo tendría sentido si aparece un histórico grande que valga la pena importar.

## PATRIMONIO — ✅ COMPLETO
Origen: hoja CONTEOS → `net_worth_snapshots` + `net_worth_balances`.
- [x] 🤖 `exchange_rate` = columna T/C; `total_bob` **recalculado** con la regla adoptada (no se copia `Total`).
- [x] 🤖 Columna `Debts` modelada como cuenta `por_cobrar` (activo) — decisión C1 confirmada.
- [x] 🤖 `DPF Congelado` como activo en BOB.
- [x] 🤖 API: `GET/POST/PUT/DELETE` de fotos y balances + `resumen` (serie, variación, distribución).
- [x] 🤖 Capa de datos única `lib/queries/patrimonio.ts`; cálculo en `lib/patrimonio.ts`.
- [x] 🤖 Dashboard: KPIs, evolución BOB/USD, distribución por moneda y por cuenta, disponibilidad rápida.
- [x] 🤖 Registros: matriz estilo Excel, alta/edición desde la web y **diff por cuenta** entre fotos.
- [x] 🤖 Tendencias (regresión + crecimiento compuesto) y Tipo de cambio (BCB).
- [x] 🤖 Ejes de tiempo reales en los gráficos (`lib/charts.ts`), no categóricos.
- [ ] ~~Grid editable AG Grid~~ — **descartado**: la matriz propia cubre el caso y evita una dependencia.

## GASTOS — ✅ COMPLETO
- [x] 🤖 API CRUD de transacciones con filtros (fecha, categoría, cuenta, tipo).
- [x] 🤖 Movimientos con filtros y dashboard por categoría y por mes, ingreso vs gasto.
- [x] 🤖 **Presupuestos** con avance mensual (la tabla `budgets` sí entró en Fase 1).
- [x] 🤖 Los gastos impactan el patrimonio **solo** vía el job diario (son independientes entre sí).

## INVERSIONES DPF — ✅ COMPLETO
- [x] 🤖 Migrados los depósitos reales; `status` activo/pagado.
- [x] 🤖 API CRUD + panel de indicadores (capital, ganancia líquida, liberaciones, vencidos).
- [x] 🤖 Registros con ABM y **simulador de laddering**.
- [x] 🤖 Derivados en lectura: días restantes, avance del plazo, interés mensual, RC-IVA.
- [x] 🤖 Integrado con patrimonio: el job autocalcula la cuenta `DPF` desde los depósitos activos.

## DEUDAS (por cobrar) — ✅ COMPLETO
- [x] 🤖 API CRUD + lista con estado, antigüedad, vencimiento y avance de cobro.
- [x] 🤖 "Recibir cobro": marca la cuenta donde llegó el dinero; el job lo mueve de `Por Cobrar` a
      esa cuenta (el patrimonio total no cambia, solo la disponibilidad).
- [ ] ~~Deudas propias / pasivos~~ — **fuera de alcance**, decisión E2 (*"yo nunca debo"*).

## ACTIVOS (bienes vendibles) — ✅ COMPLETO (no estaba en el plan original)
- [x] 🤖 API CRUD, resultado realizado/no realizado, y venta hacia una cuenta destino que el job aplica.

## Cierre de fase
- [x] 🤖 Todos los módulos leen y escriben en DB (decisión A2).
- [x] 🤖 `claude/estado.md` actualizado.
