// Verifica el módulo de pronóstico contra series SINTÉTICAS, donde la respuesta
// se conoce de antemano. Es la única forma de saber si el modelo está bien: con
// datos reales, cualquier salida «parece» razonable.
import { build } from "esbuild";
await build({ entryPoints: ["/home/user/jc_money/lib/pronostico/index.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/pron.mjs", logLevel: "error",
  alias: { "@": "/home/user/jc_money" } });
const { pronosticarTipoCambio } = await import("/tmp/pron.mjs");
await build({ entryPoints: ["/home/user/jc_money/lib/pronostico/modelos.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/mod.mjs", logLevel: "error",
  alias: { "@": "/home/user/jc_money" } });
const M = await import("/tmp/mod.mjs");
const M2 = await import("/tmp/pron.mjs");

const pruebas = [];
const check = (n, ok, extra = "") => pruebas.push([n, ok, extra]);
const cerca = (a, b, tol) => a != null && Number.isFinite(a) && Math.abs(a - b) <= tol;

// Generador reproducible: sin semilla fija, un fallo no se puede repetir.
function rng(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function normal(r) {
  // Box-Muller.
  const u1 = Math.max(1e-12, r()), u2 = r();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function fechas(n, desde = "2025-01-01") {
  const out = [];
  const d = new Date(`${desde}T12:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(new Date(d.getTime() + i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}
const aSerie = (vals, desde) => fechas(vals.length, desde).map((f, i) => ({ fecha: f, valor: vals[i] }));

// ===========================================================================
// 1. Álgebra y piezas base
// ===========================================================================
check("multiplicar polinomios: (1−B)(1−B) = 1 −2B +B²",
  JSON.stringify(M.diferenciar([1, 2, 4, 7], 2)) === JSON.stringify([1, 1]),
  JSON.stringify(M.diferenciar([1, 2, 4, 7], 2)));

// ψ de un AR(1): ψⱼ = φʲ
const psi = M.pesosPsi([0.6], [], 5);
check("los pesos ψ de un AR(1) son φʲ",
  psi.every((v, j) => cerca(v, 0.6 ** j, 1e-9)), JSON.stringify(psi));
// ψ de una caminata (φ=1): todos 1
check("los de una caminata son todos 1",
  M.pesosPsi([1], [], 5).every((v) => cerca(v, 1, 1e-9)));

check("z(0,975) ≈ 1,96", cerca(M.zNormal(0.975), 1.959964, 1e-4), M.zNormal(0.975));
check("z(0,5) = 0", cerca(M.zNormal(0.5), 0, 1e-9));

// ===========================================================================
// 2. Serie anclada (el caso del T/C oficial boliviano)
// ===========================================================================
const anclado = pronosticarTipoCambio(aSerie(new Array(200).fill(6.96)));
check("una serie constante se reconoce como anclada", anclado.regimen === "anclado");
check("y NO se le ajusta ningún modelo",
  anclado.competencia.length === 0 && anclado.ganador === null);
check("el «pronóstico» es la constante, sin banda inventada",
  anclado.puntos.every((p) => p.valor === 6.96 && p.inferior === 6.96 && p.superior === 6.96));
check("lo explica en vez de callarlo",
  anclado.diagnosticos.some((d) => d.id === "anclado") &&
  anclado.diagnosticos.some((d) => d.id === "riesgo-real"));

// Ancla con un salto suelto: sigue siendo ancla (1 cambio en 200 días).
const casiAnclado = new Array(200).fill(6.96);
for (let i = 150; i < 200; i++) casiAnclado[i] = 6.97;
const ca = pronosticarTipoCambio(aSerie(casiAnclado));
check("un único salto en 200 días no la convierte en serie móvil",
  ca.regimen === "anclado", `${ca.diasConCambio} cambios`);

// ===========================================================================
// 3. Caminata aleatoria: NADIE debe ganarle
// ===========================================================================
{
  const r = rng(12345);
  const y = [7.0];
  for (let i = 1; i < 300; i++) y.push(y[i - 1] + 0.01 * normal(r));
  const res = pronosticarTipoCambio(aSerie(y));
  check("una caminata se clasifica como serie móvil", res.regimen === "movil");
  check("y gana la caminata aleatoria (o nadie la mejora un 5%)",
    res.ganador.id === "rw", `ganó ${res.ganador?.id} con mejora ${res.ganador?.mejoraVsCaminata}`);
  check("lo dice explícitamente como diagnóstico",
    res.diagnosticos.some((d) => d.id === "gana-caminata"));
  check("el pronóstico central es casi plano (deriva ≈ 0)",
    cerca((res.puntos.at(-1).valor - res.ultimo) / res.ultimo, 0, 0.02),
    `${res.ultimo} → ${res.puntos.at(-1).valor}`);
  check("el intervalo se abre con el horizonte",
    (res.puntos.at(-1).superior - res.puntos.at(-1).inferior) >
    (res.puntos[0].superior - res.puntos[0].inferior) * 3);
  check("y siempre contiene al valor central",
    res.puntos.every((p) => p.inferior <= p.valor && p.valor <= p.superior));
}

// ===========================================================================
// 4. AR(1) fuerte con reversión: AHÍ un modelo SÍ debe ganar
// ===========================================================================
{
  const r = rng(777);
  const mu = 7.0, phi = 0.55;
  const y = [mu];
  for (let i = 1; i < 400; i++) y.push(mu + phi * (y[i - 1] - mu) + 0.02 * normal(r));
  const res = pronosticarTipoCambio(aSerie(y));
  check("en una serie con reversión a la media, un modelo le gana a la caminata",
    res.ganador.id !== "rw", `ganó ${res.ganador?.id}`);
  check("y la mejora es sustancial, no decimales",
    res.ganador.mejoraVsCaminata > 0.15, `${res.ganador?.mejoraVsCaminata}`);
  check("el pronóstico revierte hacia la media, no se queda en el último valor",
    Math.abs(res.puntos.at(-1).valor - mu) < Math.abs(res.ultimo - mu) + 0.02,
    `último ${res.ultimo.toFixed(3)} → ${res.puntos.at(-1).valor.toFixed(3)} (μ=${mu})`);
  check("lo reporta como que hay estructura aprovechable",
    res.diagnosticos.some((d) => d.id === "gana-modelo"));
}

// ===========================================================================
// 5. Cobertura del intervalo: la prueba que de verdad importa
// ===========================================================================
{
  // Sobre 200 caminatas independientes, ¿cuántas veces el real a 7 días cae
  // dentro de la banda del 95%? Debería rondar el 95%.
  let dentro = 0, total = 0;
  for (let sim = 0; sim < 200; sim++) {
    const r = rng(1000 + sim);
    const y = [7.0];
    for (let i = 1; i < 160; i++) y.push(y[i - 1] + 0.01 * normal(r));
    const entren = y.slice(0, 150);
    const m = M.caminataConDeriva(entren);
    const p = m.pronosticar(7, 1.96);
    const real = y[150 + 6];
    total++;
    if (real >= p.inferior[6] && real <= p.superior[6]) dentro++;
  }
  const cobertura = dentro / total;
  check("la banda del 95% cubre ~95% de los casos reales",
    cobertura >= 0.9 && cobertura <= 0.99, `cobertura ${(cobertura * 100).toFixed(1)}%`);
}

// ===========================================================================
// 6. Robustez y casos límite
// ===========================================================================
check("con menos de 30 registros no pronostica y lo explica",
  (() => { const r = pronosticarTipoCambio(aSerie(new Array(20).fill(0).map((_, i) => 7 + i * 0.01)));
    return !r.suficienteData && r.motivo?.includes("30"); })());

check("ignora valores inválidos en vez de propagar NaN",
  (() => {
    const r = rng(5);
    const y = [];
    for (let i = 0; i < 120; i++) y.push(7 + 0.05 * normal(r));
    const s = aSerie(y);
    s[10].valor = NaN; s[20].valor = -1; s[30].valor = 0;
    const res = pronosticarTipoCambio(s);
    return res.puntos.every((p) => Number.isFinite(p.valor) && Number.isFinite(p.inferior));
  })());

check("una serie con un salto brutal no produce pronósticos explosivos",
  (() => {
    const y = [];
    for (let i = 0; i < 150; i++) y.push(i < 100 ? 7 : 14);
    const res = pronosticarTipoCambio(aSerie(y));
    return res.puntos.every((p) => Number.isFinite(p.valor) && p.valor > 0 && p.valor < 100);
  })(), "");

check("las fechas del pronóstico continúan a la serie, sin huecos ni saltos",
  (() => {
    const r = rng(9);
    const y = [7]; for (let i = 1; i < 120; i++) y.push(y[i - 1] + 0.01 * normal(r));
    const res = pronosticarTipoCambio(aSerie(y, "2026-01-01"), { horizonteDias: 30 });
    if (res.puntos.length !== 30) return false;
    const dia = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
    if (dia(res.hasta, res.puntos[0].fecha) !== 1) return false;
    return res.puntos.every((p, i) => i === 0 || dia(res.puntos[i - 1].fecha, p.fecha) === 1);
  })());

check("todos los modelos comparados reportan sus métricas",
  (() => {
    const r = rng(31);
    const y = [7]; for (let i = 1; i < 300; i++) y.push(y[i - 1] + 0.01 * normal(r));
    const res = pronosticarTipoCambio(aSerie(y));
    return res.competencia.length >= 3 &&
      res.competencia.every((m) => Number.isFinite(m.mae) && Number.isFinite(m.rmse) &&
        Number.isFinite(m.mape) && m.evaluaciones > 0);
  })());

check("la tabla viene ordenada por error, de mejor a peor",
  (() => {
    const r = rng(41);
    const y = [7]; for (let i = 1; i < 300; i++) y.push(y[i - 1] + 0.01 * normal(r));
    const c = pronosticarTipoCambio(aSerie(y)).competencia;
    return c.every((m, i) => i === 0 || c[i - 1].mae <= m.mae);
  })());

// ===========================================================================
// 7. Capa de decisión
// ===========================================================================
check("Φ(0) = 0,5 y Φ(1,96) ≈ 0,975",
  cerca(M2.phiNormal(0), 0.5, 1e-6) && cerca(M2.phiNormal(1.96), 0.975, 1e-3),
  `${M2.phiNormal(0)} / ${M2.phiNormal(1.96)}`);

{
  const r = rng(2024);
  const y = [7]; for (let i = 1; i < 300; i++) y.push(y[i - 1] + 0.01 * normal(r));
  const res = pronosticarTipoCambio(aSerie(y), { horizonteDias: 90 });
  check("hay una lectura por cada horizonte pedido",
    res.horizontes.map((h) => h.dias).join() === "7,15,30,60,90",
    res.horizontes.map((h) => h.dias).join());
  // Ojo: una caminata FINITA siempre estima alguna deriva, así que exigir que
  // la probabilidad ronde el 50% sería exigirle al código algo falso. Lo que sí
  // debe cumplirse es la relación: P(subir) > ½ exactamente cuando el pronóstico
  // está por encima de hoy, y con el valor que da la normal.
  check("la probabilidad de subir es coherente con el pronóstico y su σ",
    res.horizontes.every((h) => {
      const sigma = (h.superior - h.inferior) / (2 * 1.959964);
      const esperada = M2.phiNormal((h.valor - res.ultimo) / sigma);
      return Math.abs(h.probabilidadSubir - esperada) < 0.02 &&
        (h.valor > res.ultimo) === (h.probabilidadSubir > 0.5);
    }),
    res.horizontes.map((h) => h.probabilidadSubir.toFixed(2)).join(" "));
  check("y una deriva que es ruido NO se presenta como dirección",
    res.horizontes.filter((h) => h.dias <= 30).every((h) => !h.direccionSignificativa),
    res.horizontes.map((h) => `${h.dias}d:${h.direccionSignificativa}`).join(" "));
  check("el efecto en 1.000 USD es coherente con el cambio esperado",
    res.horizontes.every((h) => cerca(h.efectoEn1000Usd, (h.valor - res.ultimo) * 1000, 1e-6)));
  check("la incertidumbre crece con el horizonte",
    res.horizontes.at(-1).superior - res.horizontes.at(-1).inferior >
    res.horizontes[0].superior - res.horizontes[0].inferior);
}

{
  // Con una tendencia clara, la probabilidad de subir tiene que ser alta.
  const r = rng(555);
  const y = []; for (let i = 0; i < 300; i++) y.push(7 + 0.004 * i + 0.008 * normal(r));
  const res = pronosticarTipoCambio(aSerie(y), { horizonteDias: 30 });
  check("con tendencia al alza, la probabilidad de subir es alta",
    res.horizontes.at(-1).probabilidadSubir > 0.9,
    res.horizontes.map((h) => `${h.dias}d:${h.probabilidadSubir.toFixed(2)}`).join(" "));
  check("y el efecto en 1.000 USD es claramente positivo",
    res.horizontes.at(-1).efectoEn1000Usd > 50, `${res.horizontes.at(-1)?.efectoEn1000Usd}`);
  check("con tendencia real, la dirección SÍ se marca como significativa",
    res.horizontes.every((h) => h.direccionSignificativa),
    res.horizontes.map((h) => `${h.dias}d:${h.direccionSignificativa}`).join(" "));
}

check("una serie anclada no produce lecturas de decisión",
  anclado.horizontes.length === 0);

// ===========================================================================
// 8. Ningún modelo explosivo llega a la tabla
//    (esto se vio en pantalla: ARIMA(2,1,2) entraba con un MAE de 3·10²⁴)
// ===========================================================================
{
  const r = rng(4242);
  const y = [2.4];
  for (let i = 1; i < 300; i++) y.push(y[i - 1] * (1 + 0.0004 + 0.0025 * normal(r)));
  const res = pronosticarTipoCambio(aSerie(y));
  const rango = Math.max(...y) - Math.min(...y);
  check("ningún modelo entra en la comparación con errores absurdos",
    res.competencia.every((m) => m.mae < rango * 5 && m.rmse < rango * 5),
    res.competencia.filter((m) => m.mae >= rango * 5).map((m) => `${m.nombre}:${m.mae.toExponential(1)}`).join(" "));
  check("las mejoras frente a la caminata son porcentajes creíbles",
    res.competencia.every((m) => m.mejoraVsCaminata == null ||
      (m.mejoraVsCaminata > -5 && m.mejoraVsCaminata < 1)),
    res.competencia.map((m) => (m.mejoraVsCaminata ?? 0).toFixed(2)).join(" "));
  check("y el pronóstico se queda dentro de un rango plausible",
    res.puntos.every((q) => q.valor > Math.min(...y) / 2 && q.valor < Math.max(...y) * 2));
}

// ===========================================================================
// 9. El titular y la tabla no pueden contradecirse
//    (en pantalla se leía «no distinguible del ruido» arriba y un «75% de que
//     suba» en negrita abajo, para el MISMO horizonte)
// ===========================================================================
for (const [nombre, semilla, gen] of [
  ["caminata", 4242, (r) => { const y = [2.4]; for (let i = 1; i < 300; i++) y.push(y[i-1]*(1+0.0004+0.0025*normal(r))); return y; }],
  ["tendencia", 555, (r) => { const y = []; for (let i = 0; i < 300; i++) y.push(7 + 0.004*i + 0.008*normal(r)); return y; }],
  ["ruido puro", 8080, (r) => { const y = []; for (let i = 0; i < 300; i++) y.push(7 + 0.05*normal(r)); return y; }],
]) {
  const res = pronosticarTipoCambio(aSerie(gen(rng(semilla))), { horizonteDias: 30 });
  const ultimoH = res.horizontes.at(-1);
  const titularDiceRuido = res.narrativa.includes("no se distingue") ||
    res.narrativa.includes("no ve un movimiento distinguible");
  check(`titular y tabla coinciden (${nombre})`,
    titularDiceRuido === !ultimoH.direccionSignificativa,
    `titular="${titularDiceRuido ? "ruido" : "señal"}" tabla=${ultimoH.direccionSignificativa ? "señal" : "ruido"}`);
}

// ===========================================================================
// 10. La ventana de modelado se acota (rendimiento y régimen)
// ===========================================================================
{
  const r = rng(606);
  const y = [6.9];
  for (let i = 1; i < 3000; i++) y.push(y[i - 1] * (1 + 0.0004 * normal(r)));
  const t0 = performance.now();
  const res = pronosticarTipoCambio(aSerie(y, "2018-01-01"));
  const ms = performance.now() - t0;
  check("con 3.000 registros solo se modelan los más recientes",
    res.n <= 750 && res.nDisponibles === 3000, `n=${res.n} de ${res.nDisponibles}`);
  check("y el pronóstico arranca al día siguiente del ÚLTIMO dato, no del recorte",
    res.hasta === aSerie(y, "2018-01-01").at(-1).fecha, `${res.hasta}`);
  check("el cálculo entero se resuelve en menos de un segundo",
    ms < 1000, `${ms.toFixed(0)} ms`);
}

let f = 0;
for (const [n, ok, extra] of pruebas) {
  if (!ok) f++;
  console.log(`${ok ? "OK   " : "FALLA"} ${n}${!ok && extra ? `  → ${extra}` : ""}`);
}
console.log(`\n${pruebas.length - f}/${pruebas.length}`);
process.exit(f ? 1 : 0);
