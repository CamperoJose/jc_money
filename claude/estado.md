# Estado del proyecto (bitácora de retome)

> Actualiza este archivo al cerrar cada bloque de trabajo, para retomar sin recontextualizar.

## Última actualización: 2026-09-01 (sesión 2 — auth + rediseño Patrimonio)

### Fase actual: 1 (Tracking) — módulo Patrimonio funcional con ABM y dashboard

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
