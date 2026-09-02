# Despliegue en Vercel (automatizado)

> Objetivo: que **cada push a la rama de producción despliegue solo**, sin comandos manuales.
> Plan **Hobby (gratis)**. La app corre en Vercel y desde ahí **sí** llega a Supabase.

## Idea general

Vercel se conecta a tu repo de GitHub. A partir de ahí:

- **Push a la rama de producción → deploy de producción** (automático).
- **Push a cualquier otra rama / PR → deploy de *preview*** con URL propia (automático).

No hace falta CLI ni build local. Solo se configura una vez.

---

## Paso 0 — Prerrequisitos

- [ ] Repo en GitHub con el código pusheado (`git push origin <rama>`).
- [ ] Proyecto de Supabase con el esquema (`0001`), semillas (`0002`) y datos (`0003`) aplicados.
- [ ] Tener a mano las variables de entorno (las mismas del `.env`, ver Paso 2).

## Paso 1 — Importar el proyecto en Vercel

1. Entra a <https://vercel.com> e inicia sesión **con GitHub**.
2. **Add New… → Project**.
3. Autoriza a Vercel a leer el repo `CamperoJose/jc_money` (o instala la Vercel GitHub App si te lo pide).
4. Selecciona el repo → **Import**.
5. Vercel detecta **Next.js** automáticamente. **No cambies** Build Command ni Output (los toma solos).
6. **Antes de dar Deploy**, expande **Environment Variables** y agrega las del Paso 2.

## Paso 2 — Variables de entorno en Vercel

En la pantalla de import (o luego en **Project → Settings → Environment Variables**).
Marca cada una para los entornos **Production**, **Preview** y **Development**.

**Necesarias para que la app funcione (Fase 1):**

| Variable | Valor | Notas |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` | **publishable**, no la secret |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` | secreta, solo server |
| `ALLOWED_EMAIL` | `jcampero124@gmail.com` | lista blanca (puede ser varios separados por coma) |

**Opcionales (Fase 2, agrégalas cuando toque):**
`API_BEARER_TOKEN`, `GEMINI_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`,
`GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`.

> ⚠️ **NO** agregues `DATABASE_URL`. Esa cadena es solo para el script de migración
> desde tu PC; la app usa el cliente de Supabase, no conexión directa a Postgres.

## Paso 3 — Elegir la rama de producción

**Project → Settings → Git → Production Branch.**

- Puedes usar la rama actual `claude/proyecto-google-login-status-yixjuh`, **o** (recomendado)
  mergear a `main` y poner `main` como rama de producción.
- Regla simple: lo que empujes a esa rama = lo que se publica.

## Paso 4 — Primer deploy

1. Dale **Deploy**. Vercel instala, buildea y publica.
2. Te da una URL tipo `https://jc-money.vercel.app` (o `https://jc-money-<hash>.vercel.app`).
3. Si el build falla por env var faltante, agrégala en Settings y **Redeploy**.

## Paso 5 — Ajustar el login (Supabase + Google) al dominio de Vercel

El OAuth de Google necesita conocer la URL pública. Con `localhost` funcionaba; ahora hay que
añadir el dominio de Vercel.

**En Supabase → Authentication → URL Configuration:**
- **Site URL:** `https://<tu-dominio>.vercel.app`
- **Redirect URLs:** agrega `https://<tu-dominio>.vercel.app/auth/callback`
  (deja también `http://localhost:3000/auth/callback` para desarrollo).

**En Google Cloud Console → APIs & Services → Credentials → tu OAuth Client:**
- **Authorized redirect URIs:** debe incluir la URL de callback de **Supabase**
  (`https://<ref>.supabase.co/auth/v1/callback`). Esa no cambia con Vercel, pero verifícala.

> El botón "Entrar con Google" usa `window.location.origin/auth/callback`, así que toma el dominio
> correcto solo. Lo único que hay que registrar es el dominio de Vercel en Supabase (Redirect URLs).

## Paso 6 — Verificar

1. Abre `https://<tu-dominio>.vercel.app` → debe redirigir a `/login`.
2. Entra con Google (tu correo de la lista blanca).
3. Revisa `/tracking/patrimonio` con tus 15 fotos.

---

## A partir de aquí: despliegue automático ✅

- **Producción:** `git push` a la rama de producción → deploy automático.
- **Previews:** cualquier PR o push a otra rama → URL de preview automática (útil para probar antes de mergear).
- **Rollback:** en **Deployments**, cualquier versión anterior → **Promote to Production** (un clic).

### Flujo recomendado
```bash
# desarrollas en una rama, abres PR (genera preview automática)
git push origin mi-rama
# al mergear a la rama de producción, Vercel publica solo
```

## Alternativa: Vercel CLI (si prefieres terminal)

No es necesaria (la integración con Git ya automatiza todo), pero si la quieres:

```bash
npm i -g vercel
vercel login
vercel link          # vincula la carpeta al proyecto de Vercel
vercel                # deploy de preview
vercel --prod         # deploy de producción
```
Las env vars se pueden gestionar con `vercel env add` o desde el dashboard.

## Problemas comunes

- **Build falla:** casi siempre es una env var faltante o `NEXT_PUBLIC_SUPABASE_ANON_KEY` con la
  secret en vez de la publishable. Corrige en Settings → Redeploy.
- **Login redirige mal / "redirect_uri_mismatch":** falta el dominio de Vercel en
  Supabase → Redirect URLs (Paso 5).
- **"Invalid API key" en el callback:** anon key equivocada (usa la publishable).
- **Datos vacíos:** faltó aplicar `0003` (o el esquema/semillas) en ese proyecto de Supabase.
