# Estado del proyecto (bitácora de retome)

> Actualiza este archivo al cerrar cada bloque de trabajo, para retomar sin recontextualizar.

## Última actualización: 2026-09-02 (sesión 5 — unificación de ramas en `main`)

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
