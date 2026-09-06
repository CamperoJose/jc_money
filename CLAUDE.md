# CLAUDE.md — MyMoney Web (jc_money)

> Este archivo es la **fuente de verdad para cualquier sesión de Claude** que trabaje en este
> repositorio. Léelo completo antes de escribir código. La documentación detallada vive en la
> carpeta [`claude/`](./claude/).

Idioma del proyecto: **Español** (interfaz, categorías, mensajes, correos, commits y docs).

---

## 1. Qué es esto

Aplicación web personal de **gestión de finanzas e inversiones** para un solo usuario. Migra una
planilla de Excel (`My_Money_v5.0.xlsx`, 5 hojas) a una base de datos real y la expone en un
apartado llamado **Tracking**. Es un proyecto **de costo cero**: todo corre en planes gratuitos.

La especificación maestra original está en [`docs/especificacion.md`](./docs/especificacion.md).
Este `CLAUDE.md` y la carpeta `claude/` la resumen y la operativizan; ante conflicto, la spec manda
salvo que aquí se anote explícitamente una corrección validada (ver `claude/decisiones.md`).

## 2. Estado actual del proyecto

**Todo el Tracking está en producción** (`jc-money.vercel.app`, rama por defecto y única: `main`).
Ver siempre [`claude/estado.md`](./claude/estado.md) para la bitácora y el punto exacto de retome.

Módulos desplegados:

- **Patrimonio**: dashboard, matriz estilo Excel, ABM de fotos, **diff por cuenta** entre fotos,
  tendencias con proyección y tipo de cambio (BCB).
- **Gastos**: registro (fecha/hora Bolivia GMT-4, cuenta, categoría, monto/moneda), dashboard,
  movimientos con filtros y **Presupuestos** con avance mensual.
- **Inversiones DPF**: panel de monitoreo, registros con ABM y simulador de laddering.
- **Activos** (bienes vendibles) y **Deudas por cobrar**, ambos con cuenta destino al vender/cobrar.
- **Asistente IA**: registro por **voz** (Vertex AI, audio directo), asíncrono, con correo-recibo y
  pestaña de auditoría; e ingesta por token para el **Atajo / botón de acción de iOS**.
- **Configuración → Parámetros**: ABM de categorías.
- **Job diario de patrimonio** (`/api/jobs/patrimonio-diario` + GitHub Actions 00:30 Bolivia).
- Migraciones `0001`–`0014` aplicadas en Supabase.

⚠️ El despliegue a producción en Vercel es **manual** ("Promote to Production"): un push a `main`
crea el deployment pero no lo publica.

Lo que **NO** existe y **no se hará** (decisiones del usuario, ver `claude/decisiones.md`):
deudas propias / pasivos (E2), respaldos a Google Drive (E3) y tests automatizados (E6).

Pendiente real, por prioridad: recordatorios por correo, `api/estado` y alertas de presupuesto.

## 3. Stack (decidido, no reabrir sin pedido explícito del usuario)

| Capa | Tecnología |
|------|-----------|
| Front + back | Next.js (App Router, React) — un solo proyecto |
| Hosting | Vercel (Hobby, gratuito, serverless) |
| Base de datos | Supabase (Postgres) + Auth + Storage |
| Auth | Supabase Auth con Google, restringido al correo del usuario |
| Diseño | shadcn/ui sobre Tailwind CSS |
| Tema | Paleta y tipografía de la plantilla Tremor de `referencia/` (azul oscuro + Geist). **Se cambia editando los tokens de `app/globals.css`, nunca colores en los componentes.** Ver decisión E1. |
| Iconos | Phosphor Icons (pesos Fill y Duotone) |
| Grid Excel (PC) | AG Grid Community (MIT) |
| Dashboards | Tremor o Recharts |
| IA de voz | Gemini Flash (audio → JSON) |
| Correos | Nodemailer + SMTP Gmail (app password) |
| Scheduler | GitHub Actions (schedule) o cron-job.org — **no** el cron de Vercel |
| Respaldos | Google Drive API con service account (SQL + CSV) |

## 4. Principios innegociables

1. **Costo cero.** Único gasto tolerado (si es necesario): API de Gemini, que tiene capa gratuita.
   Si algo empuja a un plan de pago, **detente y consulta al usuario**.
2. **Un solo usuario**, pero con auth real y **Row Level Security en todas las tablas** desde el inicio.
3. **API primero.** La web consume la API interna; nada accede a la base por atajos.
4. **La base de datos existe desde el inicio.** El primer commit funcional ya persiste en DB.
5. **Fidelidad con mejora.** Tracking replica la lógica del Excel, mejorada (grid en PC, tarjetas/dashboards en celular).
6. **Español en todo.**

## 5. Prioridad del usuario

> "Lo que primero me interesa es gestión de patrimonio."

Confirmado también por el análisis de datos: **CONTEOS (patrimonio) es la hoja con más datos reales**
(~15 fotos). Por eso el orden de construcción de Tracking arranca por **Patrimonio**, luego Gastos,
luego Inversiones DPF, y al final Deudas. Ver `claude/roadmap.md`.

## 6. Cómo trabajar en este repo

- **Rama de trabajo: SIEMPRE `main`, y SOLO `main`. NUNCA crear ramas nuevas** (ni de feature, ni de
  Claude, ni temporales). El repo tiene UNA sola rama, `main`, que es la default y la que despliega
  Vercel. Se desarrolla, commitea y pushea directo a `main`. Confirmado por el usuario (sesión 12):
  no crear más ramas bajo ninguna circunstancia.
- **Antes de codear una fase**, lee su archivo de TODOs en `claude/todos/`.
- **Al terminar un bloque de trabajo**, actualiza `claude/estado.md` y marca los TODOs cerrados.
- **Commits** en español, claros y descriptivos.
- **Nunca hardcodees colores** en un componente: usa los tokens del tema (`bg-card`, `text-muted-foreground`,
  `var(--color-chart-1)`…). Para cambiar el aspecto se editan los tokens en `app/globals.css`, y así
  el cambio alcanza a toda la app sin tocar clases. La única excepción es `PALETA_CATEGORICA` en
  `lib/charts.ts`, que necesita tonos distinguibles entre sí para series múltiples.
- **`npm run lint` debe quedar limpio.** Hay ESLint configurado (`eslint.config.mjs`) y corre dentro
  de `npm run build`. `any` es error, no aviso.
- **Este proyecto NO lleva tests automatizados** (decisión E6): no agregues Vitest/Jest/Playwright ni
  los propongas. La red de seguridad es `lint` + `tsc --noEmit` + `build` verde + revisar el diff.
- **Texturas y vidrio**: `app/globals.css` define un sistema de superficies (`.superficie`,
  `.trama-*`, `.resplandor`, `.canal`, `.relleno-brillo`, `.vidrio*`). Reúsalo en vez de inventar
  degradados sueltos. El vidrio solo va donde algo se desplaza por detrás.
- **Toda pantalla nueva necesita su versión móvil.** Las tablas viven detrás de `hidden lg:block`;
  si solo tocas la tabla, desde el celular no se ve nada (pasó en la sesión 19).
- **Datos sensibles / cuentas externas**: nunca los pongas en el repo. Van en `.env.local` (no versionado)
  y el usuario los gestiona según `cosas_manuales.md`.

## 7. Índice de la carpeta `claude/`

| Archivo | Contenido |
|---------|-----------|
| `claude/roadmap.md` | Ruta completa por fases, con la ruta recomendada de arranque |
| `claude/todos/` | **Todos los TODOs**, organizados por fase |
| `claude/modelo-datos.md` | Esquema de datos detallado (tablas, campos, RLS, reglas de cálculo) |
| `claude/analisis-excel.md` | Qué hay realmente en el Excel (volúmenes, datos sucios, hallazgos) |
| `claude/decisiones.md` | Decisiones confirmadas + correcciones a la spec |
| `claude/estado.md` | Bitácora de estado / punto de retome |

## 8. Reglas de dinero (resumen — detalle en `claude/modelo-datos.md`)

- Moneda base: **BOB (Boliviano)**. Soportadas: BOB, USD, USDT. Mostrar patrimonio en BOB y USD.
- **Patrimonio de una foto** (validado contra el Excel real):
  `total_bob = Σ(cuentas BOB) + T/C · Σ(saldos USD+USDT) + DPF_congelado + Debts`
  `total_usd = total_bob / T/C`
  ⚠️ **Ojo:** en el Excel la columna `Debts` de CONTEOS se **SUMA** (es un por-cobrar/activo),
  no se resta. Esto contradice la sección 7.2 de la spec. Ver decisión abierta en `claude/decisiones.md`.
- **RC-IVA:** en Bolivia se retiene 13% sobre rendimientos financieros → ganancia líquida ≈ bruta · 0.87.
  El usuario ingresa los valores; es solo validación, no cálculo forzado.
