// Verifica lib/tendencias.ts con series construidas a mano, donde la respuesta
// se conoce de antemano. No es una suite de tests (decisión E6): es la
// herramienta con la que se revisó este módulo, y queda para volver a correrla.
import { build } from "esbuild";
await build({ entryPoints: ["/home/user/jc_money/lib/tendencias.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/tendencias.mjs", logLevel: "error",
  alias: { "@": "/home/user/jc_money" } });
const { analizarTendencia } = await import("/tmp/tendencias.mjs");

const pruebas = [];
const check = (n, ok, extra = "") => pruebas.push([n, ok, extra]);
const cerca = (a, b, tol = 0.51) => a != null && Math.abs(a - b) <= tol;

// --- Serie perfectamente lineal: +100 Bs/día durante 100 días ---
const lineal = [];
for (let i = 0; i <= 100; i += 10) {
  const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  lineal.push({ fecha: d, bob: 10000 + 100 * i });
}
const L = analizarTendencia(lineal);
check("una recta perfecta da R² = 1", L.r2 === 1, `R²=${L.r2}`);
check("y el ritmo diario exacto", cerca(L.ritmoDiario, 100, 0.01), `${L.ritmoDiario}`);
check("ritmo mensual = diario · 30,44", cerca(L.ritmoMensual, 100 * 30.4375, 0.01));
check("sin residuos, la banda es de ancho cero",
  L.puntos.filter((p) => p.banda).every((p) => cerca(p.banda[1] - p.banda[0], 0, 0.01)));
check("estando en el pico, el drawdown es 0", L.drawdown.monto === 0 && L.drawdown.pct === 0);
check("y lo dice como hallazgo", L.hallazgos.some((h) => h.id === "maximo" && h.tono === "bueno"));

// --- Serie con caída: sube y luego se desploma ---
const caida = [
  { fecha: "2026-01-01", bob: 50000 },
  { fecha: "2026-02-01", bob: 60000 },
  { fecha: "2026-03-01", bob: 70000 },  // máximo
  { fecha: "2026-04-01", bob: 65000 },
  { fecha: "2026-05-01", bob: 58000 },
  { fecha: "2026-06-01", bob: 56000 },
];
const C = analizarTendencia(caida);
check("encuentra el máximo histórico", C.maximo.valor === 70000 && C.maximo.fecha === "2026-03-01");
check("mide el drawdown contra ese máximo", C.drawdown.monto === 14000 && cerca(C.drawdown.pct, 0.2, 0.001),
  `${C.drawdown.monto} / ${C.drawdown.pct}`);
check("cuenta la racha a la baja (abr, may, jun)",
  C.racha?.direccion === "baja" && C.racha.meses === 3, JSON.stringify(C.racha));
check("mejor mes = febrero (+10.000)", C.mejorMes?.period === "2026-02" && C.mejorMes.cambio === 10000);
check("peor mes = mayo (−7.000)", C.peorMes?.period === "2026-05" && C.peorMes.cambio === -7000);
check("detecta que se está frenando", C.aceleracion.direccion === "desacelerando",
  JSON.stringify(C.aceleracion));
check("avisa del drawdown con tono malo",
  C.hallazgos.some((h) => h.id === "drawdown" && h.tono === "malo"));
check("y NO dice que estás en tu máximo", !C.hallazgos.some((h) => h.id === "maximo"));

// --- Los meses encadenan aunque las fotos sean irregulares ---
const irregular = [
  { fecha: "2026-01-03", bob: 10000 },
  { fecha: "2026-01-28", bob: 12000 }, // el cierre de enero es este
  { fecha: "2026-02-14", bob: 15000 },
];
const I = analizarTendencia(irregular);
check("el cambio mensual usa la última foto del mes anterior",
  I.porMes.length === 1 && I.porMes[0].period === "2026-02" && I.porMes[0].cambio === 3000,
  JSON.stringify(I.porMes));

// --- Serie ruidosa: la banda debe abrirse y el ajuste ser bajo ---
const ruidosa = [
  { fecha: "2026-01-01", bob: 40000 },
  { fecha: "2026-02-01", bob: 55000 },
  { fecha: "2026-03-01", bob: 42000 },
  { fecha: "2026-04-01", bob: 61000 },
  { fecha: "2026-05-01", bob: 45000 },
  { fecha: "2026-06-01", bob: 63000 },
];
const R = analizarTendencia(ruidosa);
const bandas = R.puntos.filter((p) => p.banda);
check("con ruido, la banda tiene ancho real", bandas[0].banda[1] - bandas[0].banda[0] > 5000);
// Ojo: comparar los anchos con un simple ">" no sirve — con una banda de ancho
// constante el ruido de coma flotante hacía pasar la comprobación. Se exige un
// ensanchamiento real, que es la propiedad del intervalo de predicción.
const ancho = (p) => p.banda[1] - p.banda[0];
check("y se ensancha con el horizonte (al menos 1,5× a 24 meses)",
  ancho(bandas[bandas.length - 1]) > ancho(bandas[0]) * 1.5,
  `${ancho(bandas[0]).toFixed(0)} → ${ancho(bandas[bandas.length - 1]).toFixed(0)}`);
check("el piso de la banda nunca es negativo", bandas.every((p) => p.banda[0] >= 0));
check("avisa de que no sigue una recta", R.hallazgos.some((h) => h.id === "ajuste-bajo"));
check("la banda contiene siempre a la proyección",
  bandas.every((p) => p.proyeccion >= p.banda[0] && p.proyeccion <= p.banda[1]));

// --- Casos límite ---
const U = analizarTendencia([{ fecha: "2026-01-01", bob: 100 }]);
check("con una sola foto no proyecta nada", !U.suficienteData && U.hallazgos.length === 0);
const D = analizarTendencia([{ fecha: "2026-01-01", bob: 100 }, { fecha: "2026-02-01", bob: 200 }]);
check("con dos fotos proyecta pero sin banda (0 grados de libertad)",
  D.suficienteData && D.errorEstandar === null && D.puntos.every((p) => p.banda === null));
check("la banda arranca en la última foto, no un mes después",
  R.puntos.filter((p) => p.real != null && p.banda != null).length === 1 &&
  R.puntos.find((p) => p.banda != null).fecha === R.hasta,
  R.puntos.find((p) => p.banda != null)?.fecha);
check("y en el resto del histórico no hay banda",
  R.puntos.filter((p) => p.real != null).slice(0, -1).every((p) => p.banda === null));
check("y avisa de que son pocos datos", D.hallazgos.some((h) => h.id === "pocas-fotos"));
const Z = analizarTendencia([{ fecha: "2026-01-01", bob: 0 }, { fecha: "2026-02-01", bob: 0 }]);
check("una serie en cero no rompe ni produce NaN",
  Number.isFinite(Z.ritmoMensual) && !Number.isNaN(Z.drawdown.pct));

let f = 0;
for (const [n, ok, extra] of pruebas) {
  if (!ok) f++;
  console.log(`${ok ? "OK   " : "FALLA"} ${n}${!ok && extra ? `  → ${extra}` : ""}`);
}
console.log(`\n${pruebas.length - f}/${pruebas.length}`);
process.exit(f ? 1 : 0);
