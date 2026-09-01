# Decisiones

## A. Decisiones confirmadas por el usuario (spec §6, no reabrir sin pedido)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Orden de módulos | Asumido: **Patrimonio y Gastos primero**, luego Inversiones, al final Deudas. Reordenable. |
| 2 | DB desde el inicio | Sí, todo persiste en DB desde el primer arranque. |
| 3 | Modelo de gastos | Registro **simple pero robusto** (no doble entrada). |
| 4 | Cuentas y catálogos | Sí, parámetros configurables para cuentas y categorías. |
| 5 | Multimoneda | Sí. Base **BOB**, mostrar ponderación final en **BOB y USD**. |
| 6 | Cálculo de inversiones | El usuario ingresa los valores; la app agrega indicadores del panel. |
| 7 | Proyección de laddering | **Simulador interactivo**. |
| 8 | Vista de Tracking | Réplica mejorada, híbrida (grid editable + dashboards). |
| 9 | Autenticación | Supabase Auth con Google. |
| 10 | Base de datos | Supabase. |
| 11 | Respaldos a Drive | Ambos formatos, **SQL y CSV**. |
| 12 | Voz | Audio directo a Gemini. Siri es futuro. |
| 13 | API con token | Sí, token Bearer desde el inicio. |

## B. Decisión de arranque (esta sesión)

- **Orden de Tracking confirmado por el usuario:** empezar por **Patrimonio** ("lo que primero me
  interesa es gestión de patrimonio"). Coincide con que CONTEOS es la hoja con más datos reales.
  Orden: **Patrimonio → Gastos → Inversiones DPF → Deudas.**
- **No se scaffolda Next.js todavía** en esta sesión: depende de credenciales de Supabase y del tema
  de tweakcn, que son tareas manuales del usuario (`cosas_manuales.md`). Primero se dejan listos los
  docs, el esquema SQL y las semillas.

## C. Correcciones / discrepancias respecto a la spec (requieren confirmación del usuario)

### C1. `Debts` en CONTEOS es un ACTIVO (por cobrar), no un pasivo — ⚠️ ABIERTA

La spec §7.2 dice que las deudas se **restan** del patrimonio. Pero validando la fórmula del `Total`
contra las filas reales del Excel, la columna `Debts` de CONTEOS se **suma** (es dinero por cobrar).

- **Propuesta:** modelar `Debts` de CONTEOS como una cuenta especial de tipo `por_cobrar` (activo),
  con `is_liability = false`, y su propio balance por foto. La hoja `DEUDAS` queda como registro
  independiente de deudas (que sí pueden ser por pagar o por cobrar según su naturaleza).
- **Fórmula de patrimonio adoptada** (fiel al Excel):
  `total_bob = Σ(cuentas BOB activo) + T/C·Σ(saldos moneda extranjera) + DPF_congelado + por_cobrar − Σ(pasivos)`
  Hoy no hay pasivos en las fotos históricas (la Tarjeta Mercantil no aparece en CONTEOS).
- **Pendiente:** confirmar con el usuario que `Debts` de CONTEOS es efectivamente "por cobrar".

### C2. Tarjeta Mercantil no aparece en CONTEOS

La spec pide sembrar `Tarjeta Mercantil` (tipo `tarjeta_credito`, pasivo) porque sale en el ejemplo
de voz. Se siembra en el catálogo, pero **no tiene datos históricos** en las fotos. Sin acción extra.

### C3. Fechas posiblemente invertidas (mes/día) en CONTEOS

Varias fechas rompen el orden cronológico (`2026-02-02`, `2026-12-08`, `2026-01-09`). Se migran tal
cual, pero la migración debe **listar estas filas** para que el usuario confirme si hubo typo.

### C4. Dato mal ubicado en DEUDAS

La única fila de DEUDAS tiene `Estado=380` (parece que 380 es el Monto). Confirmar con el usuario
en la migración.

## D. Preguntas abiertas de la spec §18 (no bloquean el arranque)

- Conjunto inicial definitivo de categorías de gasto e ingreso.
- Anticipación de recordatorios de vencimiento de DPF.
- Frecuencia del correo de estado (semanal/mensual).
- Política de retención de respaldos (propuesta: 30 diarios + 12 mensuales).
- Si `budgets` entra en Fase 1 o se posterga (propuesta: tabla creada, UI pospuesta).
