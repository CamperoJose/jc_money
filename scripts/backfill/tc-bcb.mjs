#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Backfill del histórico de tipo de cambio del BCB.
//
// Consulta el Servicio Web de Indicadores del BCB día por día y genera un .sql
// listo para pegar en Supabase. Reutiliza EL MISMO cliente que usa el job
// diario en producción (`lib/bcb.ts`), así que si el job funciona, esto también.
//
// Uso:
//   node scripts/backfill/tc-bcb.mjs --desde 2005-01-01 --moneda 12
//   node scripts/backfill/tc-bcb.mjs --desde 2020-01-01 --moneda 76 --salida ufv.sql
//
// Opciones:
//   --desde YYYY-MM-DD   Primera fecha a consultar (obligatoria).
//   --hasta YYYY-MM-DD   Última fecha. Por defecto, hoy en Bolivia.
//   --moneda N           Código BCB de moneda. 12 = USD venta (por defecto),
//                        76 = UFV, 53 = EUR, 75 = MVDOL.
//   --indicador N        Código de indicador. 1 = tipo de cambio (por defecto).
//   --salida ARCHIVO     Dónde escribir el SQL. Por defecto tc-<moneda>.sql.
//   --pausa MS           Espera entre consultas, en ms (por defecto 250).
//   --reanudar           Reaprovecha el caché de una corrida anterior.
//   --lote N             Filas por sentencia INSERT (por defecto 500).
//
// Sobre el ritmo: el BCB es un servicio público pequeño. La pausa por defecto
// (250 ms, una consulta a la vez) tarda ~1 h por cada 15 años de historia. No la
// bajes de 100 ms: no hay prisa y no queremos castigar su servidor.
// ---------------------------------------------------------------------------

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// El cliente del BCB está en TypeScript, pero es puro y sin imports del alias
// «@», así que Node lo puede cargar quitando los tipos. Si tu Node no soporta
// --experimental-strip-types (hace falta 22.6+), el script lo dice y para.
let bcb;
try {
  bcb = await import(resolve(RAIZ, "lib/bcb.ts"));
} catch (e) {
  console.error(
    "No se pudo cargar lib/bcb.ts.\n" +
      "Ejecutá el script así:  node --experimental-strip-types scripts/backfill/tc-bcb.mjs …\n" +
      "(hace falta Node 22.6 o superior)\n\nDetalle: " + e.message
  );
  process.exit(1);
}
const { obtenerTipoCambioBCB, descripcionMoneda, BCB_ERRORES } = bcb;

// --- Argumentos ------------------------------------------------------------
function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith("--")) continue;
    const k = a[i].slice(2);
    const v = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : "true";
    o[k] = v;
  }
  return o;
}
const o = args();

function hoyBolivia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

const DESDE = o.desde;
const HASTA = o.hasta ?? hoyBolivia();
const MONEDA = Number(o.moneda ?? 12);
const INDICADOR = Number(o.indicador ?? 1);
const PAUSA = Math.max(100, Number(o.pausa ?? 250));
const LOTE = Math.max(1, Number(o.lote ?? 500));
const SALIDA = resolve(RAIZ, o.salida ?? `tc-${MONEDA}.sql`);
const CACHE = resolve(RAIZ, `.cache-tc-${MONEDA}.json`);

if (!DESDE || !/^\d{4}-\d{2}-\d{2}$/.test(DESDE) || !/^\d{4}-\d{2}-\d{2}$/.test(HASTA)) {
  console.error("Falta --desde YYYY-MM-DD (y --hasta debe tener el mismo formato).");
  console.error("Ejemplo: node --experimental-strip-types scripts/backfill/tc-bcb.mjs --desde 2005-01-01");
  process.exit(1);
}
if (DESDE > HASTA) {
  console.error(`--desde (${DESDE}) es posterior a --hasta (${HASTA}).`);
  process.exit(1);
}

// --- Fechas ----------------------------------------------------------------
function* rangoFechas(desde, hasta) {
  const d = new Date(`${desde}T12:00:00Z`);
  const fin = new Date(`${hasta}T12:00:00Z`);
  while (d <= fin) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Caché: una corrida interrumpida no debe empezar de cero ---------------
let cache = {};
if (o.reanudar && existsSync(CACHE)) {
  try {
    cache = JSON.parse(readFileSync(CACHE, "utf8"));
    console.log(`Reanudando: ${Object.keys(cache).length} fechas ya consultadas.`);
  } catch {
    console.log("El caché estaba corrupto; se empieza de cero.");
  }
}
function guardarCache() {
  writeFileSync(CACHE, JSON.stringify(cache));
}

// El endpoint del BCB está fijo en lib/bcb.ts (así debe ser en producción).
// Para poder probar este script de punta a punta sin llamar al BCB de verdad,
// se permite redirigirlo con una variable de entorno. NO se usa en la vida real.
const ENDPOINT_PRUEBA = process.env.BCB_ENDPOINT_OVERRIDE;
const fetchBcb = ENDPOINT_PRUEBA
  ? (url, init) => fetch(ENDPOINT_PRUEBA, init)
  : fetch;

// --- Consulta con reintentos ----------------------------------------------
/**
 * Devuelve { valor } si hay dato, { vacio: true } si el BCB dice que no existe
 * valor para esa fecha (código 2001: normal en feriados y fines de semana según
 * la moneda), o lanza si el fallo es de red o de configuración.
 */
async function consultarFecha(fechaISO) {
  const MAX = 4;
  for (let intento = 1; intento <= MAX; intento++) {
    try {
      const r = await obtenerTipoCambioBCB(fetchBcb, {
        codIndicador: INDICADOR,
        codMoneda: MONEDA,
        fechaISO,
      });
      return { valor: r.valor, desc: r.desIndicador };
    } catch (e) {
      const msg = String(e.message ?? e);
      // 2001 = «No existe valor para los parámetros». No es un fallo: es que
      // ese día no hay publicación. Se registra y se sigue.
      if (msg.includes("2001")) return { vacio: true };
      // 1002/1003/1004 son errores de configuración: reintentar no arregla nada.
      if (/100[234]/.test(msg)) throw new Error(`Configuración inválida: ${msg}`);
      if (intento === MAX) throw e;
      const espera = PAUSA * 2 ** intento;
      process.stderr.write(`\n  ${fechaISO}: ${msg.slice(0, 90)} — reintento ${intento}/${MAX - 1} en ${espera} ms\n`);
      await dormir(espera);
    }
  }
}

// --- Bucle principal -------------------------------------------------------
const fechas = [...rangoFechas(DESDE, HASTA)];
console.log(
  `Backfill T/C del BCB\n` +
  `  moneda    : ${MONEDA} (${descripcionMoneda(MONEDA)})\n` +
  `  indicador : ${INDICADOR}\n` +
  `  rango     : ${DESDE} → ${HASTA}  (${fechas.length} días)\n` +
  `  pausa     : ${PAUSA} ms  →  ~${Math.round((fechas.length * PAUSA) / 60000)} min\n` +
  `  salida    : ${SALIDA}\n`
);

let consultadas = 0, conDato = 0, vacias = 0;
const t0 = Date.now();
for (const f of fechas) {
  if (f in cache) continue;
  const r = await consultarFecha(f);
  cache[f] = r.vacio ? null : r.valor;
  consultadas++;
  if (r.vacio) vacias++; else conDato++;
  if (consultadas % 25 === 0) {
    guardarCache();
    const hechas = Object.keys(cache).length;
    const pct = ((hechas / fechas.length) * 100).toFixed(1);
    const restan = Math.round(((fechas.length - hechas) * (Date.now() - t0)) / consultadas / 60000);
    process.stdout.write(`\r  ${hechas}/${fechas.length} (${pct}%) · con dato ${conDato} · sin dato ${vacias} · faltan ~${restan} min   `);
  }
  await dormir(PAUSA);
}
guardarCache();
console.log(`\n\nListo. ${Object.values(cache).filter((v) => v != null).length} fechas con valor.\n`);

// --- Resumen de lo traído: sirve para saber si vale la pena --------------
const conValor = Object.entries(cache)
  .filter(([, v]) => v != null)
  .sort(([a], [b]) => a.localeCompare(b));
if (conValor.length === 0) {
  console.error("No se obtuvo ningún valor. Revisá el código de moneda y la conectividad.");
  process.exit(1);
}
let cambios = 0;
for (let i = 1; i < conValor.length; i++) {
  if (Math.abs(conValor[i][1] - conValor[i - 1][1]) > 1e-9) cambios++;
}
const valores = conValor.map(([, v]) => v);
console.log(
  `Resumen de la serie\n` +
  `  primer valor : ${conValor[0][1]} el ${conValor[0][0]}\n` +
  `  último valor : ${conValor.at(-1)[1]} el ${conValor.at(-1)[0]}\n` +
  `  mínimo/máximo: ${Math.min(...valores)} / ${Math.max(...valores)}\n` +
  `  días que cambió: ${cambios} de ${conValor.length - 1} ` +
  `(${((cambios / Math.max(1, conValor.length - 1)) * 100).toFixed(2)}%)\n`
);
if (cambios / Math.max(1, conValor.length - 1) < 0.02) {
  console.log(
    "  ⚠️  Esta serie está prácticamente ANCLADA. Cargarla te da historial real,\n" +
    "      pero el pronóstico va a seguir diciendo «régimen anclado», que es lo\n" +
    "      correcto. Si querés una serie que se mueva, probá --moneda 76 (UFV).\n"
  );
}

// --- SQL -------------------------------------------------------------------
const desc = descripcionMoneda(MONEDA).replace(/'/g, "''");
const filas = conValor.map(([f, v]) => `('${f}', ${INDICADOR}, ${MONEDA}, '${desc}', ${v}, 'bcb')`);

const lotes = [];
for (let i = 0; i < filas.length; i += LOTE) lotes.push(filas.slice(i, i + LOTE));

const sql = `-- ============================================================
-- Histórico de tipo de cambio del BCB
-- Moneda ${MONEDA} (${descripcionMoneda(MONEDA)}) · indicador ${INDICADOR}
-- Rango ${conValor[0][0]} → ${conValor.at(-1)[0]} · ${conValor.length} registros
-- Generado por scripts/backfill/tc-bcb.mjs el ${hoyBolivia()}
--
-- Datos obtenidos del Servicio Web de Indicadores del BCB, uno por día.
-- Los días sin publicación (feriados, según la moneda) simplemente no están.
--
-- IDEMPOTENTE: se apoya en la restricción unique (user_id, rate_date,
-- cod_indicador, cod_moneda) de la migración 0008, así que se puede ejecutar
-- las veces que haga falta sin duplicar nada.
--
-- Se inserta para TODOS los usuarios de la app (que es uno solo).
-- ============================================================

begin;

${lotes
  .map(
    (lote, i) => `-- lote ${i + 1}/${lotes.length}
insert into exchange_rates (user_id, rate_date, cod_indicador, cod_moneda, moneda_desc, valor, source)
select u.id, d.rate_date::date, d.cod_indicador::int, d.cod_moneda::int,
       d.moneda_desc::text, d.valor::numeric, d.source::text
from auth.users u
cross join (values
${lote.join(",\n")}
) as d(rate_date, cod_indicador, cod_moneda, moneda_desc, valor, source)
on conflict (user_id, rate_date, cod_indicador, cod_moneda) do nothing;`
  )
  .join("\n\n")}

commit;

-- Comprobación: cuántos registros quedaron y en qué rango.
select cod_moneda,
       count(*)          as registros,
       min(rate_date)     as desde,
       max(rate_date)     as hasta,
       min(valor)         as minimo,
       max(valor)         as maximo
from exchange_rates
where cod_moneda = ${MONEDA} and cod_indicador = ${INDICADOR}
group by cod_moneda;
`;

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, sql, "utf8");
console.log(`SQL escrito en ${SALIDA} (${(sql.length / 1024).toFixed(0)} KB, ${lotes.length} lote(s)).`);
console.log(`Pegalo en Supabase → SQL Editor y ejecutalo. Es idempotente.`);
