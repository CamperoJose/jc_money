# Fase 1 — Tracking · TODOs

Orden: **Patrimonio → Gastos → DPF → Deudas.** Patrón híbrido: grid (AG Grid) en PC,
tarjetas + dashboards en celular. API primero: la UI consume la API, no la DB directa.

## Migración del Excel (transversal, antes de las UIs con datos reales)
- [x] 🤖 Script Python `scripts/migracion/importar_excel.py` (openpyxl + psycopg2), CONTEOS → patrimonio.
- [x] 🤖 **Dry-run** por defecto: reporte de fotos válidas, filas descartadas y totales antes de escribir.
- [x] 🤖 Descarta datos sucios de CONTEOS (filas sin FECHA/T/C válidos: nota, #ERROR!, cálculos sueltos).
- [x] 🤖 Idempotente por fecha (salta fotos ya existentes).
- [ ] 👤 **Ejecutar** el script (dry-run + `--commit`) desde el PC. → `docs/desarrollo-local.md`
- [ ] 🤖 Extender a GASTOS, DPF y DEUDAS (hoy solo migra CONTEOS).
- [ ] 🤖 Bandera de origen / `import_batch` para revertir (pendiente; hoy la idempotencia es por fecha).
- [ ] 🤖 Reportar fechas sospechosas (posible typo mes/día) para confirmación (ver `decisiones.md` C3).

## PATRIMONIO — PRIORIDAD 1
Origen: hoja CONTEOS → `net_worth_snapshots` + `net_worth_balances`.

### Datos / migración
- [ ] 🤖 Mapear encabezado (fila 4) a `accounts`; cada fila (5–19) = 1 foto + N balances.
- [ ] 🤖 `exchange_rate` = columna T/C. Recalcular `total_bob` con la regla adoptada (no copiar `Total`).
- [ ] 🤖 Modelar columna `Debts` como cuenta `por_cobrar` (activo). Confirmar con usuario (`decisiones.md` C1).
- [ ] 🤖 `DPF Congelado` como activo en BOB.

### API
- [x] 🤖 `GET /api/patrimonio/snapshots` (fotos con balances y totales BOB/USD recalculados).
- [x] 🤖 `GET /api/patrimonio/resumen` (serie temporal, variación vs foto anterior, distribución por moneda).
- [x] 🤖 Capa de datos única `lib/queries/patrimonio.ts` (usada por API y página).
- [ ] 🤖 `GET /api/patrimonio/snapshots/:id` (detalle) — pendiente.
- [ ] 🤖 `POST/PUT/DELETE` de fotos y balances (alta/edición desde la web) — pendiente.

### UI
- [x] 🤖 Página `/tracking/patrimonio`: KPIs (patrimonio neto BOB/USD con acento del tema, variación, T/C),
      curva de evolución (Recharts) y tabla de fotos. Responsiva.
- [x] 🤖 Distribución por moneda (última foto).
- [x] 🤖 Acento del tema (primary) reservado al **patrimonio neto**.
- [ ] 🤖 **Grid editable AG Grid** (saldos por cuenta × fecha) para PC — pendiente.
- [ ] 🤖 Edición/alta de fotos desde la UI (formularios) — pendiente.
- [ ] 🤖 Distribución por **cuenta** (además de por moneda) — pendiente.

## GASTOS — PRIORIDAD 2
Origen: hoja GASTOS PRESUPUESTO → `transactions` (+ `budgets` tabla, UI pospuesta).
- [ ] 🤖 Migrar DEBE→gasto, HABER→ingreso; categoría inicial `Otros`; delimitar meses por fila-fecha.
- [ ] 🤖 API CRUD de transacciones con filtros (fecha, categoría, cuenta, tipo).
- [ ] 🤖 Grid con filtros/agrupación; dashboard gasto por categoría y por mes, ingreso vs gasto.
- [ ] (Opcional) 🤖 Gemini en lote para sugerir categorías desde el DETALLE.
- [ ] (Fase posterior) Comparación contra presupuesto.

## INVERSIONES DPF — PRIORIDAD 3
Origen: hoja DPF LADDERING REAL (filas 11+) → `dpf_deposits`.
- [ ] 🤖 Migrar depósitos; parsear `term_days` de `'90 DIAS'`; `status` = pagado si J='PAGADO', si no activo.
- [ ] 🤖 API CRUD + `GET /api/dpf/panel` (indicadores agregados, ver `modelo-datos.md`).
- [ ] 🤖 Grid de depósitos con estado y vencimientos; panel de indicadores (réplica del Excel).
- [ ] 🤖 Derivados en lectura: días restantes, interés diario informativo.

## DEUDAS — PRIORIDAD 4
Origen: hoja DEUDAS → `debts`.
- [ ] 🤖 Migrar (1 fila; confirmar dato mal ubicado, `decisiones.md` C4).
- [ ] 🤖 API CRUD + grid simple con estado.

## Cierre de fase
- [ ] 🤖 Verificar que todos los módulos leen/escriben en DB (decisión 2).
- [ ] 🤖 Actualizar `claude/estado.md`.
