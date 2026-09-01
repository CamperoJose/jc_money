# Desarrollo local en tu PC

Cómo correr, probar y desplegar MyMoney desde tu máquina. Tu PC **sí** llega a
Supabase/Vercel (el sandbox de Claude no), así que las migraciones y las pruebas en
vivo las corres tú aquí. Claude escribe y pushea el código; tú lo traes y lo ejecutas.

## Requisitos
- **Node.js 20 o 22** (recomendado 22) y **npm**. Verifica: `node -v`.
- **git**.
- (Para la migración del Excel) **Python 3.10+**.

## 1. Traer el código
```bash
git clone https://github.com/CamperoJose/jc_money.git
cd jc_money
git checkout claude/jc-money-setup-dzuiql
```
Cada vez que Claude pushee, actualizas con:
```bash
git pull origin claude/jc-money-setup-dzuiql
```

## 2. Crear `.env.local`
Este archivo **no está en git** (tiene secretos). Créalo en la raíz copiando la
plantilla y rellenando los valores (Claude te pasa los valores por el chat):
```bash
cp .env.local.example .env.local
# luego edítalo y pega tus valores reales
```
Necesitas como mínimo: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ALLOWED_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `DATABASE_URL`.

## 3. Instalar y correr la app
```bash
npm install
npm run dev
```
Abre http://localhost:3000 → te redirige a **/login** → "Entrar con Google".
Solo el correo de `ALLOWED_EMAIL` puede entrar.

> Para que el login local funcione, en Google Cloud (Credenciales → tu OAuth client)
> deben estar como **orígenes autorizados** `http://localhost:3000` y como **URI de
> redirección** la de Supabase (`https://<ref>.supabase.co/auth/v1/callback`).

## 4. Aplicar el esquema a Supabase (una vez)
Elige una vía:

**A. SQL Editor (la más simple).** En Supabase → SQL Editor → New query, pega y corre:
1. `supabase/migrations/0001_schema_inicial.sql` (tablas + RLS).
2. Inicia sesión en la app una vez (crea tu usuario en `auth.users`).
3. `supabase/migrations/0002_seed_catalogos.sql` (cuentas y categorías).

**B. Supabase CLI.**
```bash
npm i -g supabase        # o brew install supabase/tap/supabase
supabase login
supabase link --project-ref llnyhydbntmdauyuqstd
# aplica el SQL (puedes pegar en el editor, o usar db push si adaptas los nombres a timestamp)
```

## 5. Migrar los datos del Excel (patrimonio)
Después de aplicar 0001 + 0002 y de haber entrado una vez a la app:
```bash
pip install -r scripts/migracion/requirements.txt
# Dry-run: muestra qué haría, NO escribe
python scripts/migracion/importar_excel.py --excel ruta/a/My_Money_v5.0.xlsx
# Cargar de verdad
python scripts/migracion/importar_excel.py --excel ruta/a/My_Money_v5.0.xlsx --commit
```
Usa `DATABASE_URL` de tu `.env.local`. Si la conexión directa falla (host solo-IPv6),
pon en `DATABASE_URL` la cadena del **Session pooler** (IPv4) que da Supabase en
Project Settings → Database → Connection string.

## 6. Desplegar (Vercel)
Ya conectaste el repo en Vercel. Para que despliegue:
1. En Vercel → Project → **Settings → Environment Variables**, carga las mismas
   variables del `.env.local` (menos las que sean solo para migración local).
2. Configura el **Production Branch** (Settings → Git). Hoy tu código está en
   `claude/jc-money-setup-dzuiql`; cuando lo mergees a `main`, Vercel desplegará `main`.
3. En Google Cloud, agrega la URL de Vercel como origen y redirección autorizados.

## Flujo de trabajo recomendado
- Claude desarrolla y **pushea** a `claude/jc-money-setup-dzuiql`.
- Tú haces `git pull`, corres `npm run dev`, pruebas, aplicas migraciones y despliegas.
- Los secretos viven en tu `.env.local` (local) y en Vercel (producción), nunca en git.
