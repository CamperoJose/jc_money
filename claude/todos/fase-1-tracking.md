# Fase 1 — Tracking · TODOs

Orden: **Patrimonio → Gastos → DPF → Deudas.** Patrón híbrido: grid (AG Grid) en PC,
tarjetas + dashboards en celular. API primero: la UI consume la API, no la DB directa.

## Migración del Excel (transversal, antes de las UIs con datos reales)
- [ ] 🤖 Script Python (`scripts/migracion/`) con pandas + openpyxl (`data_only=True`).
- [ ] 🤖 **Dry-run obligatorio**: reporte de cuántos registros por hoja y qué filas se descartan,
      mostrado al usuario **antes** de escribir en Supabase.
- [ ] 🤖 Bandera de origen / `import_batch` para poder revertir la carga inicial.
- [ ] 🤖 Descartar datos sucios de CONTEOS (`M21` nota, `M22` #ERROR!, filas 30/33/34).
- [ ] 🤖 Reportar fechas sospechosas (posible typo mes/día) para confirmación (ver `decisiones.md` C3).
- [ ] 🤖 Idempotencia (o aviso antes de duplicar).

## PATRIMONIO — PRIORIDAD 1
Origen: hoja CONTEOS → `net_worth_snapshots` + `net_worth_balances`.

### Datos / migración
- [ ] 🤖 Mapear encabezado (fila 4) a `accounts`; cada fila (5–19) = 1 foto + N balances.
- [ ] 🤖 `exchange_rate` = columna T/C. Recalcular `total_bob` con la regla adoptada (no copiar `Total`).
- [ ] 🤖 Modelar columna `Debts` como cuenta `por_cobrar` (activo). Confirmar con usuario (`decisiones.md` C1).
- [ ] 🤖 `DPF Congelado` como activo en BOB.

### API
- [ ] 🤖 `GET /api/patrimonio/snapshots` (lista con totales BOB/USD y variación vs foto anterior).
- [ ] 🤖 `GET /api/patrimonio/snapshots/:id` (balances por cuenta).
- [ ] 🤖 `POST/PUT/DELETE` de fotos y balances. Recalcular y almacenar `total_bob`/`total_usd`.
- [ ] 🤖 `GET /api/patrimonio/resumen` (serie temporal + distribución por cuenta y por moneda).

### UI
- [ ] 🤖 PC: grid editable (AG Grid) saldos por cuenta y por fecha, con totales.
- [ ] 🤖 Dashboard: curva de patrimonio neto en **BOB y USD**, distribución por cuenta y por moneda,
      variación respecto a la foto anterior.
- [ ] 🤖 Celular: tarjetas/lista + dashboards responsivos.
- [ ] 🤖 Acento dorado reservado para el **patrimonio neto** (según dirección visual de la spec).

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
