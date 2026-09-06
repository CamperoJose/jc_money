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
| 11 | Respaldos a Drive | ~~Ambos formatos, SQL y CSV.~~ **Anulada** en la sesión 19: no se harán (ver E3). |
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

### C1. `Debts` en CONTEOS es un ACTIVO (por cobrar), no un pasivo — ✅ CONFIRMADA por el usuario

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

---

## E. Decisiones de la sesión 19 (confirmadas por el usuario)

### E1. La paleta y la tipografía dejan de ser las de tweakcn

`CLAUDE.md` §3 decía *"tema tweakcn — el usuario exporta el tema; NO inventar paleta"*. El usuario
pidió explícitamente adoptar el aspecto de la plantilla Tremor de `referencia/`, primero solo la
geometría y después también el color: *"ok, igual cambia paleta y tipografía"* y, más tarde,
*"no me gusta que sea azul medio brilloso, mejor que sea azul oscuro"*.

- **Paleta**: escala `gray` de Tailwind sobre blanco; **primario azul oscuro (~blue-800)**; en
  oscuro, fondo casi negro con tinte azul y tarjetas claramente elevadas. Serie de gráficos: azul,
  esmeralda, violeta, ámbar, cian.
- **Tipografía**: **Geist / Geist Mono**, autoalojadas con `next/font/google`.
- **Cómo se aplicó**: cambiando los **valores** de los tokens en `app/globals.css`, no sus nombres.
  Por eso ningún componente necesitó tocar una sola clase. **Esa sigue siendo la regla**: para
  cambiar el aspecto se editan los tokens, nunca se hardcodean colores en los componentes.

### E2. No habrá módulo de deudas propias (pasivos)

El roadmap contemplaba modelar deudas por pagar. El usuario lo descartó: *"yo nunca debo"*. La
tabla `debts` queda como está, modelando **solo** dinero por cobrar (activo que suma al patrimonio,
coherente con la decisión C1). No se agrega campo de dirección ni lógica de pasivos al job.

> Nota: el esquema **sí** soporta cuentas de pasivo (`accounts.is_liability`), y el job las trata
> correctamente (un gasto sube el saldo de un pasivo). Eso se conserva por si algún día aparece una
> tarjeta de crédito; lo que no se construye es el módulo de deudas propias.

### E3. No habrá respaldos a Google Drive

Anula la decisión A11. El usuario lo descartó de plano. Se elimina del roadmap y de los TODOs de
Fase 2; la ruta `api/respaldo` sigue excluida del middleware pero no se implementará.

### E4. Semántica del job de patrimonio (consolidada)

Se cierran las idas y vueltas de las sesiones 17–19:
- La **base** es el **último registro** existente (manual o auto), no "el día anterior".
- Se cuentan los gastos e ingresos del **día entero** procesado, sin importar la hora ni la del
  registro base. El usuario lo confirmó explícitamente tras probar un caso real: *"yo sí quería que
  lo cuente"*. Esto implica que un gasto anterior a una foto manual del mismo día se cuenta dos
  veces, y **es intencional**.
- Manuales y automática **coexisten** en un mismo día; lo único prohibido son **dos automáticas**.
- **Invariante permanente**: `total_bob = Σ(saldos de la foto)`. El total se calcula DESDE los
  saldos, nunca sumando piezas por separado. Romper esto fue el bug de la sesión 19.

### E5. ESLint obligatorio

No había configuración, así que `next build` no linteaba nada. Se agrega `eslint.config.mjs` con
`next/core-web-vitals` + `next/typescript`. `@typescript-eslint/no-explicit-any` es **error**, no
aviso: en una app de dinero, perder el tipo de un monto o de una fila de Supabase es exactamente
donde aparecen los bugs caros. Todo desarrollo futuro debe dejar `npm run lint` limpio.
