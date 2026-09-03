# Estado del proyecto (bitácora de retome)

> Actualiza este archivo al cerrar cada bloque de trabajo, para retomar sin recontextualizar.

## Última actualización: 2026-09-03 (sesión 14 — registro por voz (Gemini/Vertex) + pulido iOS/PWA)

### Sesión 14 — lo hecho ✅
- **Registro por voz de gastos y deudas** (botón flotante abajo-derecha en todo `/tracking`):
  graba audio y lo envía **directo** a Gemini (Vertex AI `generateContent`). Acepta varios gastos
  y/o deudas en un solo comando, sin orden fijo. Muestra una **revisión editable** (monto, moneda,
  T/C, cuenta, categoría; quién/motivo en deudas) antes de registrar.
  - `lib/gcp/` (credencial + token OAuth2 vía JWT RS256 con `node:crypto`), `lib/voz/gemini.ts`
    (prompt con catálogo de cuentas/categorías → JSON `{gastos, deudas}`), API `/api/voz/parse` y
    `/api/voz/registrar` (gastos `source='voz'`, deudas nuevas pendientes). `components/voz/voz-fab.tsx`.
  - **Credencial:** GitHub Push Protection **bloquea** versionar la private key. Se usa por env var
    **`GCP_SA_JSON`** (JSON crudo o base64) en Vercel; archivo local `credenciales/vertex-ai.json`
    gitignored para dev. Ver `credenciales/README.md`.
  - **IAM pendiente (usuario):** el service account necesita rol **Vertex AI User**
    (`roles/aiplatform.user`); los roles "Service Agent" actuales NO permiten invocar el modelo.
    Habilitar la **Vertex AI API** en el proyecto `accl-507423`.
  - Env opcionales: `GEMINI_MODEL` (def. `gemini-2.5-flash`), `GCP_LOCATION` (def. `global`).
- **Pulido iOS / sensación de app (PWA):** `app/manifest.ts` (standalone, iconos), metadatos
  `appleWebApp` + `themeColor` + `viewport-fit=cover`, iconos PWA en `public/` (192/512 + maskable),
  áreas seguras (notch/home indicator) en header móvil, main y botón de voz, `min-h-dvh`, sin
  tap-highlight/callout/zoom-doble-tap, scroll sin rebote. "Agregar a inicio" abre en modo app.

---

## Update previo: 2026-09-02 (sesión 13 — venta de activos y cobro de deudas hacia cuenta destino)

### Sesión 13 — lo hecho ✅
- **Registro de venta de activos con cuenta destino y plusvalía** y **registro de cobro de deudas con
  cuenta y fecha**: el registro solo se guarda; el **job diario** contabiliza el movimiento hacia la
  cuenta destino el día del evento.
  - Migración `0013_venta_activos_cobro_deudas.sql` (pendiente de aplicar por el usuario):
    `assets.sold_account_id`, `debts.paid_account_id`, `debts.collected_date`.
  - Formularios: en Activos, al marcar "Vendido" se elige **cuenta destino** (además de fecha y
    precio, con plusvalía calculada en vivo). En Deudas, si hay monto cobrado aparece la sección
    **Cobro** (fecha + cuenta destino). Cuentas destino = reales activas (no DPF/por_cobrar/pasivos).
  - Types/mutations/queries actualizados (`Asset.sold_account_id`, `Debt.paid_account_id` +
    `collected_date`). Páginas `activos`/`deudas` inyectan `getCuentas`.
  - **Job (`lib/jobs/patrimonio-diario.ts`) → `getMovimientosDelDia`:** por cada venta/cobro cuyo
    `sold_date`/`collected_date` cae en `(base.snapshot_date, targetDate]`, inyecta el importe (a BOB
    para el total; a la moneda nativa de la cuenta para el saldo) en la cuenta destino. El activo/
    deuda ya salió de su cuenta derivada (Activos/Por Cobrar), así que el efecto neto = resultado
    realizado (venta) o cero (cobro solo mueve valor de «por cobrar» a una cuenta real). Se inyecta
    **una sola vez** (el día que el cierre cruza el evento; después el saldo queda copiado de la base).
  - Limitación asumida (app monousuario): el modelo de deuda usa una sola `collected_date`, así que un
    cobro parcial seguido de otro con fecha distinta podría recontabilizar; para el uso real (un evento
    de cobro) es correcto.

---

## Update previo: 2026-09-02 (sesión 12 — presupuestos, tema, correos periódicos)

### Sesión 12 — lo hecho ✅
- **Operativo:** migraciones 0010/0011/0012 aplicadas por el usuario; repo con UNA sola rama `main`
  (regla reforzada en CLAUDE.md §6: **NUNCA crear ramas**). Tema/monitoreo lo revisa el usuario.
- **Selector de tema (claro/oscuro/sistema):** en el pie del sidebar, persistido en localStorage, sin
  flash (script inline en `<head>`). Respeta la paleta tweakcn (no se inventan colores). Dark mode por
  clase `.dark` en `<html>`. Versión mini cuando el sidebar está colapsado.
- **Presupuestos** (`/tracking/gastos/presupuestos`, tabla `budgets` ya existente): tope mensual por
  categoría de gasto, barras de avance vs. gastado, alertas (≥85% y excedido), KPIs (planeado,
  gastado, restante, % global) y **copiar del mes anterior**. `lib/presupuestos.ts` + queries/mutations
  + API `/api/presupuestos{,/copiar}`. Guardado inline (blur/Enter), 0 quita el tope.
- **Correos periódicos** (todos salen del job de medianoche `/api/jobs/correos`):
  - Diario: patrimonio + alerta de DPF que vence hoy (ya existían).
  - **Semanal (lunes):** resumen de la semana (gasto 7d + top categorías, Δ patrimonio 7d, DPF que
    vencen esta semana, avance de presupuesto).
  - **Mensual (1er lunes):** reporte del mes que cerró (gasto/ingreso/balance, top categorías, Δ
    patrimonio del mes, presupuesto cumplido/excedido, DPF cobrados y su ganancia).
  - Lógica de fecha en `lib/jobs/correos.ts`; plantillas nuevas en `lib/emails/plantillas.ts`.
- **Decisión:** NO se harán respaldos a Drive (por pedido del usuario).

---

## Update previo: 2026-09-02 (sesión 11 — Tendencias, gastos 7 días, autofill, UI polish)

### Sesión 11 — lo hecho ✅
- **Correos:** probados en producción por el usuario, funcionan. ✅
- **Tab Tendencias** (`/tracking/patrimonio/tendencias`): regresión lineal + crecimiento compuesto
  sobre la serie de patrimonio. KPIs (ritmo mensual, crecimiento compuesto, **R²/confianza**, valor
  actual), gráfico histórico + **línea proyectada**, proyecciones a 1/3/6/12/24 meses (lineal y
  compuesto), y **metas** ("¿cuándo llego a 75k/100k/…?" con fecha estimada). Narrativa tipo
  "si sigues así, el {fecha} tendrás {X}". Lógica pura en `lib/tendencias.ts`.
- **Gastos últimos 7 días:** en el dashboard de gastos, card con total, promedio/día y **mini-gráfico
  de barras por día**. Nuevos campos en `getResumenGastos`.
- **Autollenar registro manual de patrimonio:** al crear una foto nueva, se copian los saldos por
  cuenta y el T/C del **último registro** (editable; el T/C se refresca del BCB si hay dato del día).
- **UI polish:** fondo del área de tracking con **difuminados/blobs** verdes suaves (fixed, -z-10) y
  **sombras más suaves y con hover** en todas las tarjetas (base `Card`).
- **Ícono rehecho:** moneda con degradado radial, anillo grabado, realce superior y flecha de
  tendencia con cabeza sólida (favicon SVG + apple-icon PNG). Se ve mucho mejor.
- **Sidebar:** Patrimonio ahora incluye **Tendencias**.

---

## Update previo: 2026-09-02 (sesión 10 — Deudas, Activos, disponibilidad rápida, ícono)

### Sesión 10 — lo hecho ✅
- **BCB (fix definitivo):** con el cliente de referencia del usuario se confirmó: namespace fijo
  `http://ws.bcb.gob.bo`, params `codIndicador/codMoneda/fecha`, y **USD = código 12** (34/35 dan 1003).
  Se quitó el reintento arg0 (causaba HTTP 500). Migración `0010` pasa la config 35→12.
- **Módulo Deudas ("que me deben"):** ABM + KPIs (por cobrar, cobrado, vencidas, por deudor) sobre la
  tabla `debts` (+ `paid_amount`, migración 0011 para parciales). El job copia cada día su total a la
  cuenta **Por Cobrar** = Σ saldo de deudas no pagadas (igual que DPF).
- **Módulo Activos (bienes vendibles):** tabla `assets` (migración 0012) — costo, moneda, valor actual,
  vendible, cuenta-en-patrimonio, y al **vender** (fecha+precio) calcula el **resultado/rendimiento**.
  KPIs: en patrimonio, plusvalía no realizada, ganancia realizada, rendimiento. El job suma al
  patrimonio (cuenta **Activos**, type 'otro') = Σ valor de activos contables activos (en BOB).
- **Job genérico:** las cuentas derivadas (DPF, Por Cobrar, Activos) ahora se autocalculan de forma
  unificada y **resiliente** (si una tabla/migración no está, se omite sin romper el job).
- **Disponibilidad rápida:** card en el dashboard de patrimonio = efectivo + banco + stablecoins de la
  última foto (sin DPF, activos ni por cobrar), con % del patrimonio.
- **Ícono de la app:** moneda verde con flecha de crecimiento (`app/icon.svg` favicon + `app/apple-icon.png`
  para iOS).
- **Sidebar:** grupos **Activos** y **Deudas** activados.
- **Migraciones pendientes de aplicar (en orden):** 0010, 0011, 0012.

### Correos — CÓDIGO LISTO ✅ (falta que el usuario setee las env vars)
- `lib/mailer.ts` (Nodemailer, credenciales SOLO por env), plantillas HTML en `lib/emails/plantillas.ts`
  (mini-dash de patrimonio + alerta de DPF que vence hoy), job `lib/jobs/correos.ts`, endpoint
  `/api/jobs/correos` y paso en el workflow (después del cierre, `continue-on-error`).
- **Env vars que el usuario debe setear (SOLO en Vercel; el correo se envía desde la función):**
  `SMTP_USER` (gmail), `SMTP_PASS` (App Password, sin espacios), `MAIL_TO` (opcional, default = SMTP_USER).
  GitHub solo necesita los ya existentes APP_URL + API_BEARER_TOKEN (curl al endpoint).
  Opcionales: `SMTP_HOST` (default smtp.gmail.com), `SMTP_PORT` (default 465). La App Password NUNCA
  va al repo. Probar: `POST /api/jobs/correos` con el bearer token.

---

## Update previo: 2026-09-02 (sesión 9 — BCB: formato real de respuesta + reintento de params)

### Sesión 9 — lo hecho ✅ (T/C del BCB, con la respuesta REAL de producción)
- **El debug reveló la respuesta real del BCB:** no es `<codError>/<valor>`, sino una **lista de
  pares** `<return><codDato>Nombre</codDato><dato>Valor</dato></return>`. El namespace real es
  `http://ws.bcb.gob.bo/`. Y devolvía **CodError 1003** (moneda inválida) con `codMoneda=35`.
- **Fix parser:** `parseRespuestaBCB` ahora entiende el formato de pares (CodError, Valor, CodMoneda,
  Fecha, Descripcion), con respaldo al formato plano del doc y a tomar el primer par numérico si no
  hay clave "Valor".
- **Fix binding (causa del 1003):** clásico gotcha JAX-WS — los parámetros reales suelen ser
  `arg0/arg1/arg2`, no `codIndicador/codMoneda/fecha`. El cliente ahora **reintenta con arg0/arg1/arg2**
  cuando el codError es de binding (1001/1002/1003). Si ambas convenciones fallan con 1003, lanza el
  error real (entonces sí es la moneda: cambiar el código en Parámetros, ej. 34 compra).
- **Debug mejorado:** `/api/jobs/tipo-cambio?debug=1` ahora devuelve **la matriz de intentos**
  (ambas convenciones) con sobre, status y XML crudo.
- **Tests internos con la respuesta real** en `scripts/test-bcb.ts` (32 checks, todos pasan): parseo
  del 1003 real, parseo de éxito en pares, reintento a arg0/arg1/arg2, y 1003 en ambas → lanza.

---

## Update previo: 2026-09-02 (sesión 8 — job usa capital DPF activo, dashboard DPF enriquecido)

### Sesión 8 — lo hecho ✅
- **Job de patrimonio · valor DPF dinámico:** el saldo de la cuenta de tipo `dpf` (ej. "DPF
  Congelado") en el cierre automático ya NO se copia de la base: se toma de **Σ principal de los DPF
  activos** (`status='activo'`). Todo lo demás sigue igual (copy-paste de la última foto ± gastos del
  día). El total se ajusta por `(capital DPF activo − DPF en la base)`. Si no hay cuenta de tipo dpf,
  no toca nada. El resultado del job expone `dpf_activo_bob` y `dpf_ajuste_bob`.
- **Dashboard de DPF enriquecido:** KPIs hero (capital en DPF, **ganancia total** = realizada +
  proyectada, **capital rotado**, rendimiento activo/realizado) + 6 métricas (ganancia realizada,
  proyectada, **interés mensual/flujo**, tasa promedio con rango, DPFs cobrados/activos, RC-IVA),
  **rotación de capital** (barras abierto/mes + línea acumulada), capital por entidad, **ganancia
  realizada vs proyectada**, liberación por mes, próximas liberaciones. Nuevos indicadores en
  `resumenDpf` (capitalRotado, gananciaTotal, interesMensualActivo, rendimientoRealizado,
  diasInvertido, porEntidad, serieRotacion, etc.).
- **T/C no aparecía:** el run del workflow que compartió el usuario **solo mostraba el paso de
  patrimonio, no el de T/C** → GitHub Actions está usando el **workflow viejo** (de la rama por
  defecto, aún no `main`). Los cron y "Run workflow" leen el YAML de la **rama por defecto**. Fix
  operativo: poner `main` como rama por defecto (y Production Branch de Vercel = main), o al usar "Run
  workflow" elegir la rama **main** en el desplegable. La tabla `exchange_rates` sí existe (0008
  aplicada); solo falta que el paso de T/C corra. Se puede cargar ya llamando el endpoint directo.

---

## Update previo: 2026-09-02 (sesión 7 — DPF plazo en meses, fecha liberación manual, debug BCB)

### Sesión 7 — lo hecho ✅
- **DPF · plazo en MESES:** el interés es anual y se prorratea por meses invertidos
  (`bruto = capital · tasa · meses/12`). `term_months` reemplaza a `term_days` como base
  (migración **0009**, que además recalcula las ganancias existentes con esta base). El form usa
  plazos en meses (1/2/3/6/9/12/18/24/36).
- **DPF · fecha de liberación manual:** el `end_date` es ahora un input editable (default = inicio +
  plazo; botón "Auto" para volver a calcularlo). El simulador también pasó a meses (cadencia y plazo).
- **BCB · diagnóstico (para el T/C que no cargaba):** el cliente ahora **descubre del WSDL** tanto el
  namespace como los **nombres de parámetro** (JAX-WS a veces usa `arg0/arg1/arg2` en vez de
  `codIndicador/codMoneda/fecha`). Nuevo endpoint de depuración `GET /api/jobs/tipo-cambio?debug=1`
  (con token): devuelve el sobre SOAP enviado, el HTTP status y el **XML crudo** del BCB, sin
  persistir. Overrides opcionales en `app_settings`: `tc_bcb_namespace`, `tc_bcb_param_names`,
  `tc_bcb_soap_action`. Tests de `descubrirParamNames` en `scripts/test-bcb.ts` (todos pasan).
- **Sobre el "no cargó el T/C":** en GitHub Actions **no hace falta configurar nada** aparte de los
  secrets ya existentes (APP_URL, API_BEARER_TOKEN). El paso de T/C es `continue-on-error`, así que un
  run **verde no significa** que el T/C se cargó — hay que abrir el step "Tipo de cambio del día (BCB)"
  y leer el JSON. Causas típicas: (a) migración 0008 aún no aplicada, (b) el deploy con el endpoint no
  está en vivo / Vercel apunta a otra rama, (c) el formato SOAP; para (c) usar `?debug=1`.

---

## Update previo: 2026-09-02 (sesión 6 — DPF IVA/cobro, floats, tipo de cambio BCB)

### Sesión 6 — lo hecho ✅
- **DPF · IVA opcional:** switch "¿Cobra IVA (RC-IVA 13%)?" en el form (por defecto **OFF**;
  hoy ningún DPF cobra IVA). Si OFF, interés líquido = bruto (sin retención); si ON, ×0,87.
  `cobra_iva` en `dpf_deposits` (migración 0007). El simulador también trae el toggle.
- **DPF · cobro explícito:** al marcar un DPF como *pagado* se declara **a qué cuenta/banco** se
  cobró (`paid_account_id`) y la **fecha de cobro** (`paid_at`). Se muestra en registros y dashboard.
- **Floats:** se mató el ruido de coma flotante (ej. tasa 6.6 → 6.6000000005). `redondeaTasa`
  (4 dec.) y `redondeaMonto` (2 dec.) en `lib/dpf.ts`; el form muestra la tasa limpia y las
  mutations redondean tasa/monto/ganancias antes de persistir.
- **Tipo de cambio (BCB) — NUEVO:**
  - Cliente SOAP puro `lib/bcb.ts` del servicio de Indicadores del BCB
    (`obtenerIndicador`, WSDL `indicadores.bcb.gob.bo/ServiciosBCB/indicadores?wsdl`). Descubre el
    targetNamespace del WSDL, arma el sobre SOAP, parsea tolerante a prefijos. **Tests** en
    `scripts/test-bcb.ts` (node --experimental-strip-types; todos pasan).
  - Tabla externa `exchange_rates` + `app_settings` (parámetros) — migración **0008**. RLS.
  - **Job 12:17** (`/api/jobs/tipo-cambio`): trae el T/C del **día en curso** (no ayer) y lo
    registra. Se agregó como primer paso del workflow (antes del cierre de patrimonio),
    `continue-on-error` para no tumbar el cierre si el BCB falla. Mismos secrets.
  - **Foto de patrimonio manual:** el T/C se **autollena** del último registro del BCB de esa
    fecha (editable). Endpoint `/api/tipo-cambio/ultimo`.
  - **Vista visual** `/tracking/patrimonio/tipo-cambio`: KPIs + gráfico de evolución + historial.
  - **Parámetros → Tipo de cambio:** configura el código de indicador y moneda del BCB
    (por defecto **USD venta oficial = 35**). Códigos en `lib/bcb.ts`.
  - ⚠️ El BCB da el dólar **oficial** (~6,96), distinto del paralelo (~9,60) que usa el patrimonio.
    Por eso el cierre **automático** conserva el T/C de la base (no lo pisa) y el manual queda editable.
- **Dashboard de patrimonio:** card enriquecido de **DPF** (capital, ganancia líquida, tasa
  promedio, **próxima liberación** con progreso y días, alerta de vencidos).
- **Migraciones pendientes de aplicar por el usuario (EN ORDEN):** 0006 (si no se aplicó), **0007**
  (DPF iva/cobro) y **0008** (tipo de cambio). Nuevo componente UI `components/ui/switch.tsx`.

---

## Update previo: 2026-09-02 (sesión 5 — unificación de ramas en `main`)

### Sesión 5 — lo hecho ✅
- **Módulo Inversiones DPF (NUEVO).** Monitoreo de DPF activos y sus liberaciones + simulador.
  - **Panel** `/tracking/inversiones/dpf`: KPIs (capital en DPF, ganancia líquida proyectada,
    tasa promedio ponderada, activos/vencidos), **próximas liberaciones** con barra de progreso y
    días restantes, capital por entidad (donut) y liberación por mes (barras). Alerta de vencidos.
  - **Registros** `/tracking/inversiones/dpf/registros`: lista/ABM con filtros por estado, tabla en
    desktop y tarjetas en móvil. Estado de liberación derivado: activo / por liberar (≤7 d) /
    vencido / cobrado.
  - **Simulador** `/tracking/inversiones/simulador`: laddering interactivo (capital inicial, aporte
    por periodo, cadencia, plazo, tasa, nº de aportes, reinversión). KPIs + gráfico de crecimiento +
    tabla por periodo. 100% cliente, no persiste nada.
  - **Independiente de patrimonio y gastos** (por pedido): solo lee/escribe `dpf_deposits`.
  - Código: `lib/dpf.ts` (cálculo puro + simulador, base **365 días**, RC-IVA 13%),
    `lib/queries/dpf.ts`, `lib/mutations/dpf.ts`, `app/api/inversiones/dpf/{,[id]}`,
    componentes en `components/dpf/*`. Sidebar: grupo **Inversiones** activado.
  - **Migración `0006_datos_dpf.sql`** (pendiente de aplicar por el usuario): 5 DPF reales del Excel
    (4 cobrados + 1 activo), idempotente. La tabla `dpf_deposits` ya existía desde 0001.
- **Fix job patrimonio (bug en prod):** el insert en `net_worth_balances` iba **sin `user_id`** y con
  la service role el default `auth.uid()` es null → violaba el not-null. Ahora va explícito + rollback
  de la foto si falla el insert de balances. Cron movido de :30 a **:17** (menos encolado); el retraso
  de GitHub Actions no afecta la exactitud (cierra "ayer" idempotente).
- **Todo el trabajo unificado en una sola rama `main`.** Se consolidó el contenido de
  `claude/jc-money-setup-dzuiql` (que era la rama por defecto/producción y contenía todo) en `main`.
  Las ramas viejas (`claude/jc-money-setup-dzuiql`, `claude/proyecto-google-login-status-yixjuh`,
  `claude/project-status-review-mj36je`) quedaron obsoletas.
- **Regla nueva de flujo (ver `CLAUDE.md` §6): se trabaja SIEMPRE y SOLO en `main`.** No más ramas
  de feature ni de Claude; commit y push directos a `main`.
- ⚠️ **Pendiente manual del usuario:** en **Vercel**, cambiar la *Production Branch* a `main`
  (Project → Settings → Git). Antes desplegaba `claude/jc-money-setup-dzuiql`.

---

## Update previo: 2026-09-01 (sesión 4 — deploy, job en vivo, UI/responsive)

### Fase actual: 2 (Tracking) — Patrimonio + Gastos EN PRODUCCIÓN

### Sesión 4 — lo hecho ✅
- **Desplegado a producción**: todo el trabajo (sesiones 2–4) fusionado por fast-forward a la rama
  por defecto (histórico; ahora unificada en `main`). `jc-money.vercel.app` en vivo.
- **Job diario FUNCIONANDO**. Depuración: el `catch` ocultaba los errores de PostgREST (no son
  `Error` → mostraba "Error en el job"); ahora se expone el detalle real. Causa raíz del fallo:
  se había corrido una versión **vieja** de `0004` sin `snapshot_at`/`kind`; **re-correr `0004`**
  (idempotente) lo arregló. Además el job obtiene el user_id **desde tablas** (service role), no del
  endpoint admin de auth (evita "User not allowed").
- **Auth login prod**: el redirect caía a localhost porque la allow-list de Supabase solo tenía
  localhost. Fix = agregar en Supabase → Auth → URL Config: Site URL `https://jc-money.vercel.app`
  y Redirect URLs `https://jc-money.vercel.app/auth/callback` y `/**`. En Google, el único redirect
  URI válido es el callback de Supabase (se quitó el `/login`). El código usa `window.location.origin`
  (no cambió).
- **Sesiones largas (~90 días)**: cookies de auth con `maxAge` extendido en `lib/supabase/server.ts`
  y `lib/supabase/middleware.ts`. Ojo: revisar que Supabase → Auth → Sessions no imponga un timeout menor.
- **Se quitó la lista blanca por correo** (`ALLOWED_EMAIL`): entra cualquier usuario autenticado con
  Google; el aislamiento de datos queda por RLS.
- **UI + responsive**: fix del layout (era `flex` siempre → en móvil la barra del menú se encogía y
  "se perdía"; ahora `lg:flex`, apilado en móvil). Sidebar rediseñado + drawer móvil de ancho completo
  con barra superior que muestra la sección. Matriz de Patrimonio oculta T/C/USD/Cuentas en pantallas
  chicas. Loaders en todas las secciones para navegación ágil.
- **SSH**: remoto del repo cambiado a `git@github.com:CamperoJose/jc_money.git` (la clave
  `~/.ssh/id_ed25519` ya autentica con GitHub).
- **Config manual pendiente del usuario** (ver `cosas_manuales.md` §8b): secrets de GitHub `APP_URL`
  + `API_BEARER_TOKEN`; en Vercel `SUPABASE_SERVICE_ROLE_KEY` (la service_role real) + `API_BEARER_TOKEN`.

### Sesión 3 — lo hecho ✅
- **Participantes: ELIMINADOS** de todo el sistema (por pedido). La migración 0004 incluye una
  limpieza defensiva (`drop table participants`, `drop column participant_id`) por si ya se aplicó.
- **Job de patrimonio diario (autocálculo)**:
  - `POST /api/jobs/patrimonio-diario` (token `API_BEARER_TOKEN`) + `.github/workflows/patrimonio-diario.yml`
    (cron 04:30 UTC = **00:30 Bolivia**). Lógica en `lib/jobs/patrimonio-diario.ts`, admin client
    (service role) en `lib/supabase/admin.ts`. Middleware ya excluye `api/jobs`.
  - Cierra **ayer 23:59** (Bolivia): toma la **última foto** (manual o auto, ≤ ese instante) y le suma
    el **neto (ingresos − gastos) del día**. Copia los saldos de la base para conservar composición.
    Idempotente por día (no repite si ya existe la foto auto de ese día). `date=YYYY-MM-DD` para backfill.
- **Patrimonio: manual vs auto** — `net_worth_snapshots` ahora tiene `snapshot_at` (instante exacto,
  permite varias fotos/día) y `kind` (`manual`|`auto`). getSnapshots ordena por `snapshot_at` y para
  `auto` **confía en el total almacenado** (ya incluye los gastos); para `manual` recalcula de saldos.
  Los gastos SOLO impactan patrimonio vía el job; una foto manual es independiente.
- **Matriz de Patrimonio rediseñada** (estilo Excel: header sticky, zebra, líneas, tabular-nums),
  con badge **Manual/Auto** y nueva columna **Δ vs. anterior** (BOB + % con flecha/color). Las fotos
  auto no se editan a mano (candado); sí se pueden borrar.
- **Lentitud entre tabs**: se agregó el loader que faltaba (`configuracion/parametros/loading.tsx`);
  ya existen loaders en gastos/patrimonio → la navegación muestra esqueleto instantáneo.
- **Módulo Gastos** (calca el patrón de Patrimonio):
  - Registro de movimientos (gasto/ingreso) con **fecha+hora** (o botón "En este momento"),
    **hora de Bolivia GMT-4** fija (sin DST). Selección de **cuenta de salida**, **categoría**,
    **participante**, monto + moneda (BOB/USD/USDT con T/C) y descripción.
    ⚠️ De momento NO impacta cuentas/patrimonio: es independiente (por pedido del usuario).
  - `/tracking/gastos` (dashboard: KPIs, gasto vs ingreso por mes, gasto por categoría, top gastos)
    y `/tracking/gastos/registros` (lista con filtros, tabla en desktop / tarjetas en móvil, ABM).
  - API: `app/api/gastos/transacciones/{,[id]}`. Queries/mutations en `lib/{queries,mutations}/gastos.ts`.
  - Helpers de zona horaria: `lib/datetime.ts` (datetime-local ↔ ISO, ancla -04:00).
- **Configuración → Parámetros** (`/tracking/configuracion/parametros`): ABM de **participantes**,
  **categorías de gasto**, **de ingreso** y **de inversión** (tabs). API en `app/api/parametros/*`.
- **Nuevas primitivas UI**: `components/ui/select.tsx`, `components/ui/textarea.tsx`.
- **Sidebar**: Gastos activado (Dashboard + Movimientos) y nuevo grupo Configuración → Parámetros.
- **Migraciones** (pendientes de aplicar por el usuario, EN ORDEN):
  `0004_gastos_parametros.sql` (enum `inversion`, tabla `participants`, `transactions.occurred_at`
  + `participant_id`) y luego `0005_seed_gastos_parametros.sql` (participante "Yo" + categorías de
  inversión). ⚠️ 0004 debe confirmarse ANTES de 0005 (enum recién creado no se usa en la misma tx).
- **SSH**: remoto de este repo cambiado a `git@github.com:CamperoJose/jc_money.git` (la clave
  `~/.ssh/id_ed25519` ya autentica con GitHub).
- **Decisión de diseño**: "participante" = catálogo simple; un movimiento tiene **un** participante
  opcional (ampliable a varios más adelante sin romper el esquema).

### Fase 1 previa — módulo Patrimonio funcional con ABM y dashboard

### Sesión 2 — lo hecho ✅
- **Auth arreglada:** el login daba `Invalid API key` porque `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  tenía una *secret key* mal pegada (y sin la `s` inicial). Debe ser la **publishable key**
  (`sb_publishable_...`). El usuario corrigió el `.env` y ya entra.
- **Importación de datos (patrimonio):** además del script Python, se generó un **exportable SQL**
  idempotente `supabase/migrations/0003_datos_conteos.sql` con las **15 fotos** de CONTEOS
  (5 filas sucias descartadas). Se pega en el SQL Editor de Supabase — no requiere red desde el sandbox.
  Total validado contra el Excel (fila 1 = 22.004,52 Bs). `Debts` suma como activo (Por Cobrar).
- **Rediseño completo de Patrimonio:**
  - **Sidebar izquierdo** colapsable (recuerda preferencia en localStorage) + drawer móvil.
    `components/tracking/sidebar.tsx`. El layout `app/tracking/layout.tsx` ya lo usa.
  - **Dos vistas:** `/tracking/patrimonio` (Dashboard) y `/tracking/patrimonio/registros` (lista + ABM).
  - **ABM de fotos:** formulario popup crear/editar (`components/patrimonio/registro-form.tsx`) con
    total calculado en vivo; tabla con detalle por cuenta expandible y borrado con confirmación
    (`components/patrimonio/registros-client.tsx`).
  - **API mutaciones:** `POST /api/patrimonio/snapshots`, `PATCH`+`DELETE /api/patrimonio/snapshots/[id]`,
    `GET /api/patrimonio/cuentas`. Lógica en `lib/mutations/patrimonio.ts` (valida y calcula totales server-side).
  - **Dashboard enriquecido:** KPIs sin desborde (formato compacto), 6 métricas de decisión
    (crecimiento mensual compuesto, variación promedio, mejor/peor período, promedio, días desde última),
    evolución (área, toggle BOB/USD), **timeline de crecimiento por cuenta** (multi-línea con leyenda toggle),
    variación por período (barras), distribución por moneda y por cuenta (donut, paleta multi-tono).
    `components/patrimonio/dashboard-charts.tsx`. Se quitó la tarjeta "Fotos registradas".
  - **Perf:** `optimizePackageImports` (phosphor/recharts) en `next.config.ts` — la lentitud en dev era
    barrel imports. Latencia en caliente ~80 ms.
  - **Loaders:** `loading.tsx` con skeletons en ambas rutas (feedback instantáneo al navegar).
    `components/ui/skeleton.tsx`. Nuevos primitivos UI: dialog, input, label, badge.
- Nuevos primitivos UI sin dependencias extra (dialog es portal propio, sin Radix salvo slot).
- `tsc --noEmit` limpio; `npm run build` verde (con el código de sesión 1; sesión 2 validada por tsc).

### ⚠️ Gotcha de entorno (sesión 2)
No correr `next build` mientras `next dev` está activo: comparten `.next` y lo corrompen
(el login empezó a dar 500). Para verificar usar `tsc --noEmit`. Si se hace build, parar el dev,
`rm -rf .next` y reiniciar. (También en memoria de Claude.)

---

### Fase previa: 0 → 1 (scaffold hecho, esperando datos en Supabase)

### App Next.js scaffoldeada (build verde) ✅
- Next.js 15 (App Router) + Tailwind v4 + tema de tweakcn del usuario aplicado en `app/globals.css`.
- shadcn/ui base (button, card, table) + Phosphor Icons. Fuentes Montserrat/Merriweather/Source Code Pro.
- Auth Supabase con Google: `/login`, `/auth/callback`, `/auth/signout`, middleware con lista blanca
  (`ALLOWED_EMAIL`).
- Módulo **Patrimonio**: `lib/queries/patrimonio.ts` (fuente única), API `/api/patrimonio/snapshots`
  y `/api/patrimonio/resumen`, página `/tracking/patrimonio` con KPIs, gráfico (Recharts) y tabla.
- `npm run build` pasa limpio.
- Script de migración de CONTEOS: `scripts/migracion/importar_excel.py` (con dry-run).
- Guía local: `docs/desarrollo-local.md`.
- Decisiones confirmadas: C1 (Debts = por cobrar), diseño (empezar ya, tema aplicado).

### Pendiente del usuario para ver datos reales
1. Aplicar `0001` (esquema) en Supabase; entrar una vez a la app; aplicar `0002` (semillas).
2. Correr `importar_excel.py` (dry-run y luego --commit) para cargar el patrimonio.
3. Cargar env vars en Vercel y definir la rama de producción.
4. (No urgente) Entregar la *secret key* de Supabase (`sb_secret_...`) para Fase 2.
5. (Seguridad, no urgente) Rotar `GOOGLE_CLIENT_SECRET` y contraseña de DB (pasaron por chat).

### Pendiente de Claude (próxima sesión — priorizado)
1. ~~Patrimonio – ABM y distribución~~ ✅ hecho en sesión 2 (formularios web, POST/PATCH/DELETE,
   distribución por cuenta, timeline por cuenta). Falta opcional: grid tipo AG Grid para edición masiva.
2. **Verificación visual con datos reales:** el usuario debe cargar `0003` y revisar el dashboard;
   ajustar gráficos/métricas según feedback.
3. **Despliegue en Vercel** (ver `claude/despliegue-vercel.md`): conectar repo, env vars, rama de producción.
4. **Extender la migración** a GASTOS, DPF y DEUDAS (hoy solo CONTEOS) + bandera `import_batch`.
3. **Módulo Gastos** (Fase 1): API + grid con filtros + dashboard categoría/mes, ingreso vs gasto.
4. **Módulo Inversiones DPF** (Fase 1): API + panel de indicadores + grid de depósitos.
5. **Módulo Deudas** (Fase 1): API + grid simple.
6. Toggle de tema claro/oscuro (el tema ya define ambas paletas).
7. Fase 2: voz (Gemini), recordatorios/correos, respaldos a Drive, scheduler externo.

### Notas técnicas para retomar
- Entorno de Claude (sandbox) **no llega a Supabase/Vercel** (solo GitHub/npm/pypi). Claude escribe y
  pushea; el usuario aplica SQL, migra y despliega desde su PC. Ver la sección de restricción arriba.
- Stack real: Next.js 15 (App Router) + Tailwind **v4** (CSS-first, sin `tailwind.config`) + shadcn/ui
  (`components.json`, iconLibrary phosphor) + `@supabase/ssr`. Fuente única de datos de patrimonio en
  `lib/queries/patrimonio.ts`. Cálculo en `lib/patrimonio.ts`. `npm run build` verde.
- Rutas API máquina (ingesta/respaldo/recordatorios/estado) ya excluidas del middleware; falta implementarlas.



### ⚠️ Restricción del entorno (importante)
La política de red de este entorno remoto **bloquea la salida hacia Supabase y Vercel** (el proxy
rechaza `api.supabase.com:443` y `*.supabase.co:443` por *organization policy*). Además el host
directo `db.<ref>.supabase.co` resuelve **solo IPv6** y el contenedor no tiene IPv6. Solo se permite
salida a **GitHub, npm y pypi**. Consecuencia:
- Claude **no puede** aplicar migraciones ni configurar Supabase/Vercel en vivo desde la sesión.
- Claude **sí puede**: escribir todo el código, instalar dependencias (npm), y pushear a GitHub.
- El usuario aplica el SQL (SQL Editor de Supabase) y setea las env vars en Vercel; Vercel despliega
  desde el push y la app **sí** llega a Supabase (red de Vercel, no la del sandbox).

Credenciales recibidas y guardadas en `.env.local` (ignorado por git): URL, anon/publishable key,
DB password, Google Client ID/Secret, project ref. Falta: `sb_secret_...` (server-side, no urgente).

### Hecho
- Análisis completo del Excel `My_Money_v5.0.xlsx` (5 hojas). Ver `claude/analisis-excel.md`.
- Documentación de planificación: `CLAUDE.md`, carpeta `claude/` (roadmap, modelo de datos,
  decisiones, todos por fase), `cosas_manuales.md`.
- Esquema SQL inicial con RLS: `supabase/migrations/0001_schema_inicial.sql`.
- Semillas de catálogos: `supabase/migrations/0002_seed_catalogos.sql`.
- Hallazgo clave: la columna `Debts` de CONTEOS se **suma** al patrimonio (activo por cobrar), no
  se resta como pasivo. Discrepa de la spec §7.2 → decisión abierta C1 en `decisiones.md`.

### Punto de retome (próximo paso)
1. ~~**Inversiones DPF**~~ ✅ hecho en sesión 5 (panel + registros/ABM + simulador). Falta aplicar
   `0006_datos_dpf.sql` en Supabase para ver los 5 DPF reales.
2. **Deudas** (grid simple sobre `debts`) — siguiente módulo por roadmap.
3. Fase 2 restante: voz (Gemini), recordatorios/correos (Nodemailer), respaldos a Drive.
4. (Opcional DPF) integrar DPF con patrimonio/cuentas cuando el usuario lo pida (hoy independiente).

### Notas para el usuario (operación)
- El job de patrimonio corre solo a las 00:30 (Bolivia). Para probar a mano: GitHub → Actions →
  "Patrimonio diario" → Run workflow.
- Si el redirect de login vuelve a fallar, revisar la allow-list de Supabase (Auth → URL Config).

### Decisiones (histórico)
- C1 confirmada: `Debts` de CONTEOS = activo por cobrar (se suma). Aplicada en `0003`.
- Participantes: descartados (se pidió quitarlos por completo).
- Un movimiento de gasto es independiente del patrimonio; solo impacta vía el job diario.
