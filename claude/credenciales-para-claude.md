# Credenciales para que Claude opere (deploys y configuraciones)

Guía de **qué credenciales darme, cómo sacarlas y con qué permisos**, para que yo pueda aplicar
migraciones, configurar servicios y desplegar sin depender de pasos manuales tuyos en cada iteración.

## Reglas de seguridad (importantes)
- **Nunca** pongas credenciales reales en el repo ni en este archivo. Me las pasas **por el chat**.
- Yo las coloco en `.env.local` (ignorado por git) o en el panel del servicio; **no las imprimo de
  vuelta ni las commiteo**.
- Usa siempre **mínimo privilegio** y **expiración** (30–90 días). Puedes **revocarlas** al terminar.
- Distinguimos dos tipos:
  - **Tokens de gestión** (me los das a mí, para configurar/desplegar): GitHub, Supabase, Vercel.
  - **Secretos de ejecución** (los pegas tú en Vercel/Supabase, no pasan por mí): Google OAuth
    secret, Gemini, Gmail, Drive.

---

## 🔴 Mínimo para desbloquear TODO ahora mismo

1. **Acceso GitHub** (para que yo pushee). Elige una:
   - **A (recomendada, sin token):** instala la GitHub App de Claude en el repo →
     https://github.com/apps/claude/installations/select_target → selecciona `CamperoJose/jc_money`
     y concede **Contents: Read and write** (y **Pull requests: R/W** si quiero abrir PRs).
   - **B (token):** crea un **Fine-grained PAT** (ver §1) y me lo pasas.
2. **Supabase** (para aplicar migraciones y configurar): access token + project ref + DB password (§2).
3. **Vercel** (para desplegar). Elige una:
   - **A (recomendada):** conecta el repo en el panel de Vercel → deploy automático en cada push
     (no me hace falta token).
   - **B (token):** me das un `VERCEL_TOKEN` y despliego por CLI (§3).

Con eso puedo: pushear código, crear el esquema en Supabase, y que la app se despliegue.

---

## 1. GitHub — push de código

**Opción A (recomendada): GitHub App de Claude.** No hay token que gestionar. Instálala en el repo
(link arriba). Es lo más limpio y revocable.

**Opción B: Fine-grained Personal Access Token.**
- Sacar en: https://github.com/settings/tokens?type=beta → *Generate new token*.
- **Resource owner:** tu usuario. **Repository access:** *Only select repositories* → `jc_money`.
- **Permissions:** *Contents* → **Read and write**; *Metadata* → Read (automático);
  *Pull requests* → Read and write (opcional, si quiero abrir PRs).
- **Expiration:** 30–90 días.
- Me pasas el token (`github_pat_...`). Lo uso como credencial de `git push`.

## 2. Supabase — migraciones y configuración

Necesito 3 cosas:

1. **Access token de Supabase** (para el CLI / Management API):
   - Sacar en: https://supabase.com/dashboard/account/tokens → *Generate new token*.
   - ⚠️ Es un token **a nivel de cuenta** (no se puede limitar a un solo proyecto). Por eso conviene
     **revocarlo cuando termine** la configuración pesada. Me lo pasas como `SUPABASE_ACCESS_TOKEN`.
2. **Project ref:** el subdominio de tu Project URL. Si la URL es
   `https://abcxyz123.supabase.co`, el ref es `abcxyz123`.
3. **Database password:** Project Settings → Database → *Database password* (si no la recuerdas,
   *Reset database password*). La uso para `supabase db push` / cadena de conexión.

Con esto aplico `supabase/migrations/0001_*.sql` y `0002_*.sql` y verifico el RLS. Si la red del
contenedor no deja conexión directa a Postgres (5432), aplico el SQL vía Management API o el pooler.

**Claves de ejecución de la app** (van a `.env.local` y a Vercel; me las pasas o las pones tú en
Vercel): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
(esta última secreta, solo server-side). Están en Project Settings → API.

## 3. Vercel — deploy

**Opción A (recomendada): conectar el repo.**
- En https://vercel.com/new importas `CamperoJose/jc_money`.
- Cargas las variables de entorno (te doy la lista final = `.env.local.example`).
- A partir de ahí, **cada push despliega solo**. No me hace falta token.

**Opción B: token para desplegar por CLI.**
- Sacar en: https://vercel.com/account/tokens → *Create Token* (dale scope a tu cuenta/equipo y
  expiración). Me lo pasas como `VERCEL_TOKEN`.
- También necesito `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` (aparecen en `.vercel/project.json` tras
  el primer `vercel link`, o en Project Settings). Con eso corro `vercel --prod`.

## 4. Google OAuth — login (secreto de ejecución)

Tú creas las credenciales; yo configuro Supabase con ellas (o las pegas tú en Supabase Auth).
- Google Cloud → *APIs y servicios* → *Credenciales* → **ID de cliente OAuth** (tipo *Aplicación web*).
- *Pantalla de consentimiento*: Externo, agrégate como usuario de prueba (jcampero124@gmail.com).
- *URIs de redirección autorizados:* la que da Supabase (Auth → Providers → Google), típicamente
  `https://<ref>.supabase.co/auth/v1/callback`; luego añadimos la de Vercel y `http://localhost:3000`.
- Me pasas `Client ID` y `Client Secret`. Con el access token de Supabase (§2) puedo activar el
  proveedor Google vía Management API, o los pegas tú en el panel.

## 5. Fase 2 (más adelante, no urgente)
- **Gemini:** API key en https://aistudio.google.com/app/apikey → `GEMINI_API_KEY`.
- **Gmail:** activa 2FA y crea *app password* en https://myaccount.google.com/apppasswords →
  `GMAIL_APP_PASSWORD`.
- **Google Drive (respaldos):** service account + Drive API habilitada; me pasas el JSON del service
  account y compartes la carpeta de destino con su correo.

---

## Qué podré hacer con cada credencial

| Credencial | Me permite |
|-----------|-----------|
| GitHub App / PAT | Pushear código, abrir PRs |
| Supabase access token + ref + db password | Aplicar migraciones, verificar RLS, configurar Auth |
| Vercel (conexión de repo o token) | Desplegar la app |
| Google OAuth Client ID/Secret | Configurar el login con Google |
| (Fase 2) Gemini / Gmail / Drive | Voz, correos, respaldos |

## Límite honesto de mi entorno
Corro en un contenedor **efímero**: los tokens que me pasas viven solo durante la sesión. Por eso los
**secretos de ejecución** deben quedar guardados en **Vercel/Supabase** (no solo en mi sesión), y a mí
me alcanzan los **tokens de gestión** para configurar y desplegar. Si una sesión nueva necesita volver
a operar, me vuelves a pasar los tokens de gestión (o dejamos configurado el deploy automático de
Vercel, que ya no me necesita).
