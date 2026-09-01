# Análisis del Excel `My_Money_v5.0.xlsx`

Análisis real hecho con `openpyxl` (`data_only=True`). Sirve para dimensionar la migración
(Fase 1) y para detectar datos sucios y decisiones abiertas.

## Resumen de volúmenes

| Hoja | Rol | Filas de datos reales | Estado |
|------|-----|----------------------|--------|
| `CONTEOS` | Patrimonio (fotos) | **~15 fotos** (filas 5–19), 10 cuentas c/u | **Rica. Es la prioridad.** |
| `DPF LADDERING REAL` | Inversiones DPF | **5 depósitos** (filas 11–15) + panel | Útil |
| `GASTOS  PRESUPUESTO` | Gastos/ingresos | **4 gastos** con monto, 0 ingresos | Casi vacía |
| `DEUDAS` | Deudas | **1 fila** (`pollo copacaban`, 380) | Casi vacía |
| `DPF LADDERING PROYECTION` | Simulador | No se migra | Se extraen supuestos |

> Nota: el nombre de la hoja de gastos tiene **doble espacio**: `GASTOS  PRESUPUESTO`.

---

## CONTEOS (patrimonio) — la hoja clave

- Encabezado en la **fila 4**: `FECHA | T/C | Banco SOL | Fortaleza | BMSC | BNB | IDEPRO CA | EFECTIVO BS | EFECTIVO USD | USDT | DPF CONGELADO | Debts | Total`.
- Datos en filas **5–19**. Cada fila es una **foto** de patrimonio con su T/C y saldos por cuenta.
- Cuentas en **BOB**: Banco SOL, Fortaleza, BMSC, BNB, IDEPRO CA, EFECTIVO BS.
- Cuentas en **moneda extranjera** (se multiplican por T/C): EFECTIVO USD, USDT.
- `DPF CONGELADO`: monto en BOB inmovilizado en DPF (se suma como activo).
- `Debts`: ver hallazgo crítico abajo.

### Hallazgo crítico: `Debts` se SUMA (no es un pasivo)

Validé la fórmula del `Total` con las filas reales:

```
Total_bob = Σ(cuentas BOB) + T/C · Σ(EFECTIVO USD + USDT) + DPF_CONGELADO + Debts
```

- **Fila 6** (sin deuda): BOB=24 832.68; extranjero=551.41·9.6=5 293.54 → 30 126.22 = `Total` (N6). ✓
- **Fila 5** (con Debts=5 536.6): BOB=11 132.93; extranjero=557.47·9.57=5 336.0; +Debts 5 536.6 → 22 005.5 ≈ `Total` 22 004.52. ✓ (la deuda se **suma**).

**Conclusión:** en la planilla, la columna `Debts` de CONTEOS representa dinero **por cobrar**
(un activo / cuenta por cobrar), no una obligación a pagar. Esto **contradice la sección 7.2**
de la spec, que dice "se restan los pasivos". → **Decisión abierta** (ver `decisiones.md`).

Modelado propuesto: tratar `Debts` de CONTEOS como una cuenta especial tipo *por_cobrar*
(activo) con su propio balance por foto, y mantener la hoja `DEUDAS` como registro aparte.

### Datos sucios en CONTEOS (a descartar/limpiar en la migración)

- `M21` = nota de texto libre: `// suamr dos pedidos de hambriguesas...` → descartar.
- `M22` = `#ERROR!` → descartar.
- Filas 30, 33, 34 (`E30`, `H30='nuevo dpf:'`, `I33`, `J33`, `J34`) → cálculos sueltos, descartar.
- Fechas: algunas parecen mal tipeadas por el usuario (p.ej. `B10=2026-02-02` fuera de orden
  cronológico, `B18=2026-12-08`, `B19=2026-01-09`). Se migran tal cual pero **conviene ordenar por
  fecha en la vista** y avisar de posibles fechas invertidas mes/día.
- Algunas celdas venían como fórmulas simples (`=4920+51.2`); con `data_only=True` se leen ya calculadas.

---

## DPF LADDERING REAL — inversiones

- **Panel de indicadores** en filas 3–7 (NO se migra, se recalcula por agregación).
- **Depósitos** desde la fila 11. Encabezado en fila 10:
  `NRO DPF | PIZARRA | EDV | ID DPF | FECHA INICIO | FECHA FIN | MONTO | PLAZO | % ANUAL | DÍAS REST | INT. DIARIO | ...`
- 5 depósitos (filas 11–15). Ejemplos:
  - ID `3000164272`, inicio 2026-02-24, fin 2026-05-25, monto 8000, plazo `90 DIAS`, tasa 0.077, estado `PAGADO`.
  - ID `3000206677`, inicio 2026-06-30, fin 2026-09-28, monto 18000, tasa 0.066, `DÍAS REST=27` (activo).
- **Estado:** la columna `DÍAS REST.` (J) mezcla dos cosas: si dice `PAGADO` el DPF está pagado;
  si es un número, está activo con esos días restantes. En la migración: `status = 'pagado'` cuando
  J = 'PAGADO', si no `'activo'`. `term_days` se parsea de `'90 DIAS'` → 90.
- Bloques `BENEFICIOS & RENDIMIENTO` (L–O) e `INGRESOS` (P–T) son datos auxiliares del usuario;
  de ahí salen `gcia_economica` / `gcia_financiera` cuando existan (los ingresa el usuario).

---

## GASTOS  PRESUPUESTO — casi vacía

- Estructura por meses: una fila con solo una **fecha** (`B2=2026-01-01`) delimita el mes; debajo,
  encabezados `DEBE | HABER | DETALLE | FECHA` y las transacciones.
- Datos reales: solo **4 gastos** (DEBE), **0 ingresos** (HABER). Ej.: `iPhone 17 pro` 13000 (2026-01-02),
  `pago tramite legalizaciones` 200, `chancho accl` 89, `Pasajes Presupuesto` 120.
- Migración: DEBE → `transactions.type='gasto'`, HABER → `'ingreso'`. Categoría inicial `Otros`.
- Por el volumen ínfimo, **no es urgente**; la parte de PRESUPUESTO está esencialmente sin usar.

---

## DEUDAS — casi vacía

- Encabezado fila 4: `FECHA | Monto | Razon | Estado`.
- 1 sola fila con datos: `Razon='pollo copacaban'`, `Estado=380` (parece mal ubicado: 380 debería ser Monto).
- Migración trivial; revisar con el usuario el dato mal ubicado.

---

## DPF LADDERING PROYECTION — supuestos del simulador

No se migra fila por fila. Se extraen los **supuestos base** para precargar el simulador (Fase 3):

- Plazo del DPF: **90 días**.
- Tasa anual: **0.077** (7.7%).
- Cadencia de nuevos depósitos: cada **30 días** (~mensual).
- Aporte de salario: bruto **10 000**, líquido **8 729** (resto 729/mes).
- Interés bruto de un depósito ≈ `monto · tasa_anual · plazo / 360`; líquido = bruto · 0.87 (RC-IVA 13%).
- Horizonte de ejemplo en la hoja: hasta ~1399 días; monto en DPF proyectado ~376 000.
