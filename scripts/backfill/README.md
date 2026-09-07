# Backfill del histórico de T/C del BCB

`tc-bcb.mjs` consulta el Servicio Web de Indicadores del BCB día por día y
genera un `.sql` idempotente para pegar en Supabase. Reutiliza **el mismo
cliente que usa el job diario en producción** (`lib/bcb.ts`): si el job
funciona, esto también.

## Uso

```bash
# Dólar (venta) desde 2005 — el histórico completo del régimen actual y el previo
node --experimental-strip-types scripts/backfill/tc-bcb.mjs --desde 2005-01-01

# UFV, que sí se mueve todos los días
node --experimental-strip-types scripts/backfill/tc-bcb.mjs --desde 2015-01-01 --moneda 76

# Euro
node --experimental-strip-types scripts/backfill/tc-bcb.mjs --desde 2015-01-01 --moneda 53
```

Hace falta **Node 22.6 o superior** (por `--experimental-strip-types`).

| Opción | Por defecto | Qué hace |
|--------|-------------|----------|
| `--desde` | *(obligatoria)* | Primera fecha, `YYYY-MM-DD` |
| `--hasta` | hoy en Bolivia | Última fecha |
| `--moneda` | `12` | Código BCB: 12 USD venta, 76 UFV, 53 EUR, 75 MVDOL |
| `--indicador` | `1` | 1 = tipo de cambio |
| `--salida` | `tc-<moneda>.sql` | Archivo de salida |
| `--pausa` | `250` ms | Espera entre consultas |
| `--reanudar` | — | Reaprovecha el caché de una corrida anterior |
| `--lote` | `500` | Filas por sentencia `INSERT` |

## Cuánto tarda

Una consulta cada 250 ms, de a una: **unos 25 minutos por cada 10 años** de
historia. El BCB es un servicio público pequeño; no bajes la pausa de 100 ms.

Si se corta, volvé a lanzarlo con `--reanudar`: el caché (`.cache-tc-<moneda>.json`)
guarda cada respuesta y no se repite ninguna consulta.

## Qué esperar del dólar oficial

El T/C oficial USD/BOB está **anclado en 6,96 desde noviembre de 2011**. Cargar
ese tramo te da historial real y verificable, pero el pronóstico va a seguir
diciendo «régimen anclado» — que es la lectura correcta, no un fallo. El script
te lo avisa al terminar, con la proporción de días en que la serie cambió.

Si querés una serie que se mueva, la **UFV (moneda 76)** cambia todos los días:
es la unidad indexada a la inflación, y ahí el módulo de pronóstico sí tiene algo
que modelar.

## Cargarlo

El SQL generado:

- inserta para **todos los usuarios** de la app (que es uno);
- se apoya en la restricción `unique (user_id, rate_date, cod_indicador, cod_moneda)`
  de la migración `0008`, con `on conflict do nothing`, así que **se puede
  ejecutar las veces que haga falta sin duplicar nada**;
- termina con un `select` que te dice cuántos registros quedaron y en qué rango.

Pegalo en **Supabase → SQL Editor** y ejecutalo.

## Nota sobre `BCB_ENDPOINT_OVERRIDE`

El script acepta esa variable de entorno para redirigir las consultas a un
servidor de prueba. Existe solo para poder verificar el script de punta a punta
sin llamar al BCB de verdad; en uso normal no se define.
