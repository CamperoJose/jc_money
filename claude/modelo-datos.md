# Modelo de datos

Postgres en Supabase. **Todas** las tablas llevan `id` (PK), `user_id` (control por fila),
`created_at`, `updated_at`. **Row Level Security activo en todas** con política `user_id = auth.uid()`.
El SQL real está en `supabase/migrations/`. Este doc explica el porqué; el SQL es la fuente ejecutable.

Moneda base: **BOB**. Soportadas: BOB, USD, USDT.

## Enums

- `account_type`: `banco`, `efectivo`, `stablecoin`, `tarjeta_credito`, `dpf`, `por_cobrar`, `otro`
  - (`por_cobrar` agregado para modelar la columna `Debts` de CONTEOS — ver `decisiones.md` C1.)
- `currency`: `BOB`, `USD`, `USDT`
- `category_kind`: `gasto`, `ingreso`
- `txn_type`: `gasto`, `ingreso`
- `txn_source`: `manual`, `voz`, `api`
- `dpf_status`: `activo`, `pagado`
- `debt_status`: `pendiente`, `parcial`, `pagado`
- `reminder_recurrence`: `ninguna`, `diaria`, `semanal`, `mensual`
- `reminder_channel`: `email`
- `reminder_related`: `inversion`, `deuda`, `generico`

## Catálogos

### `accounts`
`name`, `type` (account_type), `currency`, `is_liability` bool, `active` bool.
Semilla: Banco SOL, Fortaleza, BMSC, BNB, IDEPRO CA, Efectivo Bs, Efectivo USD, USDT, DPF Congelado,
Por Cobrar (para `Debts`), Tarjeta Mercantil (tarjeta_credito, is_liability).

### `categories`
`name`, `kind` (category_kind), `parent_id` (self-FK, opcional), `active`.
Semilla básica: Alimentación, Transporte, Salud, Servicios, Ocio, Trámites, Tecnología (gasto);
Sueldo, Rendimientos (ingreso); Otros (ambos). El usuario ajusta.

## Patrimonio (hoja CONTEOS) — MÓDULO PRIORITARIO

Formato largo: una fila por cuenta por foto.

### `net_worth_snapshots`
- `snapshot_date` date
- `exchange_rate` numeric — T/C, Bs por USD
- `total_bob` numeric — calculado y **almacenado** para fidelidad histórica
- `total_usd` numeric — `total_bob / exchange_rate`
- `note` text opcional

### `net_worth_balances`
- `snapshot_id` FK → net_worth_snapshots (ON DELETE CASCADE)
- `account_id` FK → accounts
- `amount` numeric — en la moneda de la cuenta

### Regla de cálculo de una foto (adoptada, fiel al Excel)

```
total_bob = Σ(amount de cuentas en BOB, no pasivas)
          + exchange_rate · Σ(amount de cuentas en USD y USDT, no pasivas)
          − Σ(amount de cuentas is_liability = true)
```

- Las cuentas `por_cobrar` (la columna `Debts`) y `DPF Congelado` son **activos en BOB** → suman.
- `total_usd = total_bob / exchange_rate`.
- Se muestran ambos (decisión 5).
- Al migrar, se **recalcula** `total_bob` con esta regla (no se copia el `Total` del Excel, para
  corregir inconsistencias), pero se guarda para poder comparar contra el histórico.

## Gastos e ingresos (hoja GASTOS PRESUPUESTO)

### `transactions`
`txn_date`, `type` (txn_type), `amount` (>0), `currency`, `exchange_rate` (requerido si ≠ BOB),
`account_id` FK, `category_id` FK, `description`, `tags` text[], `source` (txn_source),
`raw_voice_text` opcional. DEBE→gasto, HABER→ingreso.

### `budgets`
`period` (YYYY-MM), `category_id` FK, `amount_planned`. Se crea la tabla desde el inicio; UI pospuesta.

## Inversiones DPF (hoja DPF LADDERING REAL)

### `dpf_deposits`
`nro_dpf`, `pizarra`, `edv`, `id_dpf_externo`, `start_date`, `end_date`, `principal` (BOB),
`term_days` int, `annual_rate` numeric, `status` (dpf_status), `gcia_economica`, `gcia_financiera`,
`rc_iva_retencion`, `account_id` FK, `notes`.
**Sesión 6 (migración 0007):** `cobra_iva` bool (default false — solo entonces se retiene RC-IVA;
si false, líquido = bruto), `paid_account_id` FK accounts (a qué cuenta se cobró al pagar) y
`paid_at` date. Los montos/tasas se redondean (tasa 4 dec., dinero 2 dec.) para evitar ruido de float.
Derivados en lectura (no almacenados): días restantes = end_date − hoy; interés diario informativo.
**Convención de interés (implementada en `lib/dpf.ts`):** base **365 días** (año que usaba el Excel),
`bruto = principal · tasa · plazo/365`, `líquido = bruto · 0,87` (RC-IVA 13%). Estado de liberación
derivado: activo / por liberar (≤7 d) / vencido / cobrado. Módulo **independiente** de patrimonio y
gastos (por pedido del usuario; integración futura opcional).

### Panel de indicadores (agregación, todo derivado en lectura)
Monto en DPF (Σ principal activos − liberado), Ganancia económica (Σ gcia_economica), Ganancia
líquida (Σ gcia_financiera), Retención RC-IVA (económica − líquida), Tasa promedio (avg annual_rate
activos), Días invertido (hoy − min start_date), DPFs activos (count activo), Próx. vencimiento
(min end_date futuro + días rest.), Rendimiento neto (gcia económica / capital invertido),
Total histórico (count).

## Proyección de laddering (hoja PROYECTION)

No se migra. Simulador interactivo (Fase 3). Opcional persistir escenarios:

### `projection_scenarios`
`name`, `params` jsonb (monto inicial, aporte/periodo, cadencia días, plazo días, tasa anual,
salario bruto/líquido, horizonte meses).

Lógica del simulador: cada periodo abre un depósito = aporte + capital liberado que vence + aporte
salario. Interés bruto = monto · tasa · plazo/360; líquido = bruto · 0.87.

## Tipo de cambio (BCB) — migración 0008

### `exchange_rates` (tabla externa propia)
`rate_date` date, `cod_indicador` int (1=T/C), `cod_moneda` int (código BCB, ej. 35=USD venta),
`moneda_desc`, `valor` numeric(14,5) (Bs por unidad), `source` ('bcb'|'manual'), `fetched_at`.
Único por (user_id, rate_date, cod_indicador, cod_moneda). RLS.

### `app_settings` (parámetros clave/valor)
`key`, `value`. Config del T/C: `tc_cod_indicador` (def. '1'), `tc_cod_moneda` (def. '35').
Opcionales para el SOAP: `tc_bcb_namespace`, `tc_bcb_soap_action`.

**Consumo:** cliente SOAP `lib/bcb.ts` (método `obtenerIndicador`, WSDL del BCB). El **job 12:17**
(`/api/jobs/tipo-cambio`) trae el T/C del **día en curso** y lo guarda (idempotente). La **foto de
patrimonio manual** autollena su T/C del último `exchange_rate` de esa fecha (editable). El cierre
**automático** de patrimonio NO pisa el T/C (conserva el de la base) para no distorsionar el histórico,
ya que el BCB publica el dólar oficial (~6,96) y el patrimonio usa el paralelo (~9,60).

## Deudas (hoja DEUDAS)

### `debts`
`debt_date`, `amount`, `reason`, `status` (debt_status), `counterparty` opcional, `due_date` opcional.

## Sistema

### `reminders`
`title`, `remind_at`, `recurrence`, `channel`, `related_type` opcional, `related_id` opcional,
`active`, `last_sent_at` opcional. Token de API como variable de entorno (no tabla) para el MVP.

## Notas de migración

- Bandera de origen recomendada (`source`/`import_batch`) para poder distinguir y revertir la carga
  inicial. Script en Python (pandas + openpyxl), idempotente o que avise antes de duplicar.
- Nombre de hoja de gastos con doble espacio: `GASTOS  PRESUPUESTO`.
