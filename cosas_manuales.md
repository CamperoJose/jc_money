# Cosas manuales (que gestionas TÚ)

Estas tareas requieren tu cuenta / tarjeta / decisiones y **no las puede hacer Claude**. Casi todo
es de **costo cero**. Marca `[x]` cuando termines y pásame las credenciales por un medio seguro
(nunca las subas al repo; van en `.env.local`, que está ignorado por git).

Orden sugerido: **1 → 2 → 3 → 4** desbloquean el arranque (Fase 0/1). El resto es para Fase 2/3.

---

## 1. Supabase (base de datos + auth) — GRATIS · PRIORITARIO
- [ ] Crear cuenta en https://supabase.com y un **proyecto nuevo** (elige región cercana, ej. São Paulo).
- [ ] Guarda estos datos (Project Settings → API):
  - `Project URL`
  - `anon public key`
  - `service_role key` ⚠️ secreta, solo se usa del lado servidor.
- [ ] Guarda la contraseña de la base de datos (Project Settings → Database) por si uso la CLI.
- [ ] Pásame las 3 primeras. Yo aplico el esquema (`supabase/migrations/`) y verifico el RLS.

## 2. Google OAuth (login con Google) — GRATIS · PRIORITARIO
- [ ] En https://console.cloud.google.com crea un proyecto (o usa uno existente).
- [ ] "APIs y servicios" → "Pantalla de consentimiento OAuth": tipo **Externo**, agrégate como
      usuario de prueba con tu correo (jcampero124@gmail.com).
- [ ] "Credenciales" → "Crear credenciales" → **ID de cliente OAuth** → tipo **Aplicación web**.
- [ ] En "URIs de redireccionamiento autorizados" agrega la que te dé Supabase
      (Authentication → Providers → Google) — típicamente `https://<tu-proyecto>.supabase.co/auth/v1/callback`.
      Más adelante añadimos también la de Vercel y `http://localhost:3000`.
- [ ] Copia `Client ID` y `Client Secret` y pégalos en Supabase (Auth → Providers → Google) **y** pásamelos.

## 3. Tema visual con tweakcn — GRATIS · PRIORITARIO (bloquea el diseño)
- [ ] Entra a https://tweakcn.com/editor/theme.
- [ ] Diseña un tema **oscuro** tipo "centro de mando financiero", con **un único acento dorado**
      reservado para lo importante (patrimonio neto, estados activos). Ajusta colores, radios y tipografía.
- [ ] **Exporta** el tema (botón de exportar → variables CSS) y pásame ese bloque completo.
      Sin esto **no estilizo** ninguna pantalla (la spec prohíbe inventar una paleta o dejar la de shadcn).

## 4. GitHub — GRATIS
- [ ] El repo ya existe: https://github.com/CamperoJose/jc_money. Confirma que puedo pushear a la
      rama `claude/jc-money-setup-dzuiql` (ya tengo permiso concedido por ti).
- [ ] (Más adelante) Secrets para el scheduler (ver punto 8).

## 5. Vercel (hosting) — GRATIS (plan Hobby)
- [ ] Crear cuenta en https://vercel.com e **importar** el repo `CamperoJose/jc_money`.
- [ ] En Project Settings → Environment Variables, cargar todas las variables (te paso la lista
      cuando tengamos el `.env.local.example`): claves de Supabase, token Bearer, etc.
- [ ] Nota: el cron de Vercel Hobby solo permite 1 ejecución diaria → usamos scheduler externo (punto 8).

## 6. Gemini API (voz → JSON) — capa gratuita permanente · Fase 2
- [ ] En https://aistudio.google.com/app/apikey genera una **API key** de Gemini.
- [ ] Pásamela para configurar la ingesta por voz. Es el único gasto potencial del proyecto, pero
      la capa gratuita alcanza de sobra para uso personal.

## 7. Gmail App Password (envío de correos) — GRATIS · Fase 2
- [ ] Activa la **verificación en 2 pasos** en tu cuenta Google.
- [ ] Crea una **contraseña de aplicación** en https://myaccount.google.com/apppasswords.
- [ ] Pásame esa contraseña (16 caracteres) para Nodemailer + SMTP de Gmail.

## 8. Scheduler externo (recordatorios/respaldos) — GRATIS · Fase 2
- [ ] Opción A: **GitHub Actions** (cron en el repo) — no requiere cuenta extra.
- [ ] Opción B: crear cuenta en https://cron-job.org y programar llamadas a las rutas.
- [ ] En cualquiera, cargar el **token Bearer** de la API como secret. Yo genero el token y te digo dónde ponerlo.

## 8b. Job de patrimonio diario (autocálculo 00:30 Bolivia) — GRATIS · Fase 2
Ya está el endpoint `POST /api/jobs/patrimonio-diario` (protegido con `API_BEARER_TOKEN`) y el
workflow `.github/workflows/patrimonio-diario.yml` (corre 04:30 UTC = 00:30 Bolivia). Falta:
- [ ] Aplicar migraciones **0004** y **0005** en Supabase (0004 primero y confirmar, luego 0005).
- [ ] En Vercel, setear `SUPABASE_SERVICE_ROLE_KEY` (la `sb_secret_...`, server-side) y
      `API_BEARER_TOKEN` (yo genero el token).
- [ ] En GitHub → Settings → Secrets and variables → Actions, crear:
      - `APP_URL` = la URL de producción (ej. `https://jc-money.vercel.app`).
      - `API_BEARER_TOKEN` = el mismo token que en Vercel.
- [ ] (Opcional) Probarlo a mano: pestaña **Actions → Patrimonio diario → Run workflow**
      (permite indicar una fecha `YYYY-MM-DD` para recalcular/backfill un día puntual).

## 9. Google Drive (respaldos) — GRATIS · Fase 2
- [ ] En Google Cloud crea un **service account** y habilita la **Google Drive API**.
- [ ] Descarga el JSON de credenciales del service account y pásamelo (va en variable de entorno, no al repo).
- [ ] Crea en tu Drive una carpeta para respaldos y **compártela** con el correo del service account.
- [ ] Confirma política de retención (propuesta: 30 respaldos diarios + 12 mensuales).

---

## Decisiones que necesito que confirmes (no bloquean el arranque, pero afectan el modelado)
- [ ] **`Debts` en la hoja CONTEOS**: ¿es dinero **por cobrar** (activo)? Los números del Excel dicen
      que sí (se suma al total). La spec decía "restar deudas". Confírmame para modelarlo bien.
- [ ] **Fechas raras en CONTEOS** (ej. 2026-02-02, 2026-12-08, 2026-01-09): ¿algún typo mes/día?
- [ ] **DEUDAS**: la única fila tiene "Estado=380" — ¿380 es el monto de "pollo copacaban"?
- [ ] Categorías de gasto/ingreso iniciales (te propongo un set y lo ajustas).
- [ ] Anticipación de recordatorios de DPF, frecuencia del correo de estado.

> Nunca pegues claves reales en este archivo ni en ningún archivo versionado. Pásamelas por chat
> y yo las coloco en `.env.local` (ignorado por git) y en Vercel/Supabase según corresponda.
