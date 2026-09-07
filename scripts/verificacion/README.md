# Verificación del cálculo de patrimonio

Arnés para comprobar, contra un **Postgres real**, que el cálculo en vivo del
dashboard y el cierre del job dan exactamente lo mismo.

> No es una suite de tests automatizados (decisión E6): es una herramienta de
> verificación puntual, que se ejecuta a mano cuando se toca
> `lib/patrimonio/estado.ts` o el job. No corre en CI ni en el build.

## Qué hay aquí

| Archivo | Para qué |
|---|---|
| `e2e.mjs` | Batería principal contra Postgres real (17 comprobaciones). |
| `perf.mjs` | Cuenta consultas y mide viajes encadenados, con latencia simulada. |
| `fallos.mjs` | Comprueba que un fallo real se propaga y una migración pendiente se tolera. |
| `vacio.mjs` | Comprueba que una foto sin saldos no se usa como base. |
| `sin-0015.mjs` | Comprueba que la app da el mismo resultado con la migración 0015 sin aplicar. |
| `coherencia.test.mjs` | Comprueba sobre el código que lectura y cierre no vuelvan a duplicarse. |
| `correo.mjs` | Renderiza los correos y verifica asunto y cuerpo. |
| `avisos.mjs` | Cuándo se manda y cuándo NO cada alerta (la parte que falla en silencio). |
| `vigilancia.mjs` | El job que avisa si el cierre diario no corrió, contra Postgres real. |
| `tendencias.mjs` | Banda de predicción, drawdown, aceleración, racha y meses. |
| `analisis.mjs` | Patrones de gasto, incluidos los falsos positivos que NO debe detectar. |
| `pronostico.mjs` | Los modelos de T/C sobre series sintéticas con respuesta conocida. |
| `supa-pg.mjs` | Adaptador mínimo de la API de supabase-js sobre Postgres. |

## Qué comprueba

Siembra el caso real del 3 de septiembre de 2026 (foto manual de las 09:06, tres
gastos en efectivo, deuda nueva del día) y verifica 22 propiedades, entre ellas:

- El neto cuenta el **día entero** cuando la base es manual (decisión E4).
- **`total = Σ(saldos)`**, la invariante que rompió el bug de la sesión 19.
- **El job persiste exactamente lo que mostraba el dashboard** — la razón de ser
  del módulo compartido.
- Un gasto nuevo se refleja **sin esperar al cierre**.
- Con base auto no se recuentan los gastos del día ya cerrado.
- El job es idempotente.
- **El ciclo completo de una deuda** (migración 0015): prestar descuenta de la
  cuenta de origen y sube «Por Cobrar»; cobrar ingresa en la cuenta destino. En
  ninguno de los dos pasos cambia el patrimonio total.
- **Las cuentas derivadas se evalúan a la fecha pedida, no a hoy**: cobrar una
  deuda el día 6 no puede cambiar el «Por Cobrar» del día 3, y un DPF abierto el
  día 5 no cuenta el día 3.

Cada bloque que modifica datos reinicia el escenario antes de empezar: sin eso,
un bloque hereda lo que sembró el anterior y produce diferencias que parecen
fallos del cálculo sin serlo.

La batería **se deja el escenario como lo encontró**: puede correrse las veces
que haga falta sin limpiar la base a mano.

## Cómo se ejecuta

Requiere `postgresql` y, en el directorio de trabajo, `npm i esbuild pg`.

```bash
# 1. Levantar un Postgres desechable (como usuario postgres, no root)
D=/tmp/pgtest && rm -rf $D && mkdir -p $D && chown postgres $D
su postgres -c "initdb -D $D/data -U postgres -A trust"
su postgres -c "pg_ctl -D $D/data -l $D/log -o '-p 5433 -k $D' start"

# 2. Esquema y datos del caso
psql -h $D -p 5433 -U postgres -c "create database mymoney"
psql -h $D -p 5433 -U postgres -d mymoney -f esquema.sql
psql -h $D -p 5433 -U postgres -d mymoney -f datos.sql

# 3. Ejecutar
node e2e.mjs
```

`supa-pg.mjs` es un adaptador mínimo que implementa la parte de la API de
supabase-js que usa el cálculo, contra Postgres directo. Así se ejecuta el
código real de la app —no una reimplementación— sin depender de Supabase, al
que este entorno no tiene acceso.
