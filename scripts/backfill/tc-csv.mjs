#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Carga un CSV de tipos de cambio y genera el .sql para Supabase.
//
// Complementa a `tc-bcb.mjs`: cuando la serie ya está publicada en un CSV
// (el reporte histórico del BCB, o un agregador), esto es mucho más rápido que
// consultar el WS día por día.
//
// Uso:
//   node scripts/backfill/tc-csv.mjs --archivo tco.csv
//   node scripts/backfill/tc-csv.mjs --archivo ufv.csv --moneda 76 --columna valor
//
// Opciones:
//   --archivo RUTA    CSV de entrada (obligatoria).
//   --moneda N        Código BCB de moneda (12 USD venta por defecto).
//   --indicador N     Código de indicador (1 por defecto).
//   --columna NOMBRE  Columna del valor. Por defecto se detecta sola.
//   --fecha NOMBRE    Columna de la fecha. Por defecto se detecta sola.
//   --salida ARCHIVO  Dónde escribir el SQL.
//   --lote N          Filas por INSERT (500 por defecto).
//   --sep C           Separador. Por defecto se detecta (coma o punto y coma).
//
// Formatos que entiende sin ayuda:
//   - Fechas  YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY.
//   - Números con punto o con coma decimal, y con separador de miles.
//   - Cabeceras en español o inglés (fecha/date, venta/sell/valor/tco/tipo…).
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith("--")) continue;
    const k = a[i].slice(2);
    o[k] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : "true";
  }
  return o;
}
const o = args();
if (!o.archivo) {
  console.error("Falta --archivo RUTA.\nEjemplo: node scripts/backfill/tc-csv.mjs --archivo tco.csv");
  process.exit(1);
}

const MONEDA = Number(o.moneda ?? 12);
const INDICADOR = Number(o.indicador ?? 1);
const LOTE = Math.max(1, Number(o.lote ?? 500));
const SALIDA = resolve(RAIZ, o.salida ?? `tc-${MONEDA}.sql`);

const DESCRIPCIONES = {
  12: "EE.UU. – Dólar (venta)", 76: "Unidad de Fomento de Vivienda (UFV)",
  53: "Unión Europea – Euro", 69: "Bolivianos", 75: "MVDOL",
};
const desc = (DESCRIPCIONES[MONEDA] ?? `Moneda ${MONEDA}`).replace(/'/g, "''");

// --- Lectura ---------------------------------------------------------------
const crudo = readFileSync(resolve(process.cwd(), o.archivo), "utf8").replace(/^﻿/, "");
const lineas = crudo.split(/\r?\n/).filter((l) => l.trim() !== "");
if (lineas.length < 2) {
  console.error("El CSV no tiene ni cabecera ni datos.");
  process.exit(1);
}
// El separador se deduce de la cabecera: gana el que más veces aparece.
const SEP = o.sep ?? ((lineas[0].split(";").length > lineas[0].split(",").length) ? ";" : ",");

const partir = (linea) => {
  // Soporta campos entrecomillados con el separador dentro.
  const out = [];
  let actual = "", dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') { if (dentro && linea[i + 1] === '"') { actual += '"'; i++; } else dentro = !dentro; }
    else if (c === SEP && !dentro) { out.push(actual); actual = ""; }
    else actual += c;
  }
  out.push(actual);
  return out.map((x) => x.trim());
};

const cabecera = partir(lineas[0]).map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));

function elegirColumna(pedida, candidatas, queEs) {
  if (pedida) {
    const i = cabecera.indexOf(pedida.toLowerCase());
    if (i === -1) {
      console.error(`No hay una columna «${pedida}». Columnas: ${cabecera.join(", ")}`);
      process.exit(1);
    }
    return i;
  }
  for (const c of candidatas) {
    const i = cabecera.findIndex((h) => h === c);
    if (i !== -1) return i;
  }
  for (const c of candidatas) {
    const i = cabecera.findIndex((h) => h.includes(c));
    if (i !== -1) return i;
  }
  console.error(
    `No se pudo detectar la columna de ${queEs}. Columnas del archivo: ${cabecera.join(", ")}\n` +
    `Indicala con --${queEs === "la fecha" ? "fecha" : "columna"} NOMBRE.`
  );
  process.exit(1);
}

const iFecha = elegirColumna(o.fecha, ["fecha", "date", "dia", "day", "periodo"], "la fecha");
const iValor = elegirColumna(
  o.columna,
  // El orden importa: en un CSV con oficial y paralelo (official_sell y
  // blue_sell), lo que queremos es SIEMPRE el oficial.
  ["official_sell", "oficial_venta", "tco", "venta", "sell", "valor", "value",
   "tipo_de_cambio", "tipodecambio", "oficial", "official", "precio", "cierre"],
  "el valor"
);
console.log(`Columnas: fecha = «${cabecera[iFecha]}» · valor = «${cabecera[iValor]}» · separador «${SEP}»`);

// --- Normalización ---------------------------------------------------------
function aISO(s) {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
function aNumero(s) {
  let t = s.trim().replace(/[^\d.,-]/g, "");
  if (t === "") return null;
  const ultimaComa = t.lastIndexOf(",");
  const ultimoPunto = t.lastIndexOf(".");
  // El separador decimal es el ÚLTIMO que aparece; el otro es de miles.
  if (ultimaComa > ultimoPunto) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const porFecha = new Map();
let descartadas = 0;
const ejemplos = [];
for (let i = 1; i < lineas.length; i++) {
  const campos = partir(lineas[i]);
  const fecha = aISO(campos[iFecha] ?? "");
  const valor = aNumero(campos[iValor] ?? "");
  if (!fecha || valor == null || valor <= 0) {
    descartadas++;
    if (ejemplos.length < 3) ejemplos.push(`línea ${i + 1}: ${lineas[i].slice(0, 70)}`);
    continue;
  }
  // Si una fecha se repite, gana la última: los CSV suelen traer correcciones
  // al final, y una fila vieja no debe pisar a la corregida.
  porFecha.set(fecha, valor);
}

if (porFecha.size === 0) {
  console.error("No se pudo leer ninguna fila válida. Revisá --fecha y --columna.");
  if (ejemplos.length) console.error("Ejemplos descartados:\n  " + ejemplos.join("\n  "));
  process.exit(1);
}
if (descartadas > 0) {
  console.log(`Descartadas ${descartadas} línea(s) sin fecha o sin valor legible.`);
  if (ejemplos.length) console.log("  " + ejemplos.join("\n  "));
}

const filas = [...porFecha.entries()].sort(([a], [b]) => a.localeCompare(b));
const valores = filas.map(([, v]) => v);
let cambios = 0, saltoMax = 0, fechaSalto = null;
for (let i = 1; i < filas.length; i++) {
  if (Math.abs(valores[i] - valores[i - 1]) > 1e-9) cambios++;
  const salto = Math.abs(valores[i] / valores[i - 1] - 1);
  if (salto > saltoMax) { saltoMax = salto; fechaSalto = filas[i][0]; }
}
console.log(
  `\nResumen\n` +
  `  registros    : ${filas.length}\n` +
  `  rango        : ${filas[0][0]} → ${filas.at(-1)[0]}\n` +
  `  mín / máx    : ${Math.min(...valores)} / ${Math.max(...valores)}\n` +
  `  días que cambió: ${cambios} de ${filas.length - 1} (${((cambios / Math.max(1, filas.length - 1)) * 100).toFixed(2)}%)\n` +
  (saltoMax > 0.08
    ? `  ⚠️  salto máximo de ${(saltoMax * 100).toFixed(1)}% el ${fechaSalto} — parece un cambio de régimen.\n` +
      `      El módulo de pronóstico lo detecta solo y modela únicamente desde ahí.\n`
    : "")
);

// --- SQL -------------------------------------------------------------------
const tuplas = filas.map(([f, v]) => `('${f}', ${INDICADOR}, ${MONEDA}, '${desc}', ${v}, 'bcb')`);
const lotes = [];
for (let i = 0; i < tuplas.length; i += LOTE) lotes.push(tuplas.slice(i, i + LOTE));

const sql = `-- ============================================================
-- Histórico de tipo de cambio importado desde ${o.archivo}
-- Moneda ${MONEDA} (${DESCRIPCIONES[MONEDA] ?? MONEDA}) · indicador ${INDICADOR}
-- Rango ${filas[0][0]} → ${filas.at(-1)[0]} · ${filas.length} registros
--
-- IDEMPOTENTE: se apoya en la restricción unique de la migración 0008
-- (user_id, rate_date, cod_indicador, cod_moneda), así que se puede ejecutar
-- las veces que haga falta sin duplicar nada.
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

select cod_moneda, count(*) as registros, min(rate_date) as desde, max(rate_date) as hasta,
       min(valor) as minimo, max(valor) as maximo
from exchange_rates
where cod_moneda = ${MONEDA} and cod_indicador = ${INDICADOR}
group by cod_moneda;
`;

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, sql, "utf8");
console.log(`SQL escrito en ${SALIDA} (${(sql.length / 1024).toFixed(0)} KB, ${lotes.length} lote(s)).`);
console.log("Pegalo en Supabase → SQL Editor. Es idempotente.");
