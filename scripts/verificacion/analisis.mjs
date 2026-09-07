// Verifica lib/analisis.ts con transacciones inventadas donde el patrón que
// debe encontrar (o NO encontrar) se conoce de antemano.
import { build } from "esbuild";
await build({ entryPoints: ["/home/user/jc_money/lib/analisis.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/analisis.mjs", logLevel: "error",
  alias: { "@": "/home/user/jc_money" } });
const { analizarGastos } = await import("/tmp/analisis.mjs");

const pruebas = [];
const check = (n, ok, extra = "") => pruebas.push([n, ok, extra]);

let seq = 0;
const tx = (fecha, monto, categoria, descripcion = null, type = "gasto") => ({
  id: `t${seq++}`, txn_date: fecha, occurred_at: `${fecha}T12:00:00Z`, type,
  amount: monto, amount_bob: monto, currency: "BOB", exchange_rate: null,
  account_id: null, category_id: categoria, description: descripcion, tags: [],
  source: "manual", account: null,
  category: categoria ? { id: categoria, name: categoria, kind: "gasto", parent_id: null, active: true } : null,
});
const sumarDias = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// --- Muestra pequeña: no se inventa nada ---------------------------------
const chico = analizarGastos([tx("2026-09-01", 50, "Otros")], "2026-09-07");
check("con pocos movimientos no analiza nada",
  !chico.suficienteData && chico.hallazgos.length === 0 && chico.recurrentes.length === 0);

// --- Recurrente real: Netflix, 60 Bs cada 30 días, 5 veces ----------------
const conRecurrente = [];
for (let i = 0; i < 5; i++) conRecurrente.push(tx(sumarDias("2026-05-05", i * 30), 60, "Ocio", "Netflix"));
// Ruido de fondo para pasar el mínimo de movimientos.
for (let i = 0; i < 12; i++) conRecurrente.push(tx(sumarDias("2026-05-01", i * 7), 20 + i, "Alimentación", `feria ${i}`));
const REC = analizarGastos(conRecurrente, "2026-09-07");
const netflix = REC.recurrentes.find((r) => r.descripcion === "Netflix");
check("detecta un gasto recurrente mensual", !!netflix, JSON.stringify(REC.recurrentes.map(r=>r.descripcion)));
check("con su cadencia y monto típico", netflix?.cadaDias === 30 && netflix?.montoTipico === 60,
  JSON.stringify(netflix));
check("y estima la próxima vez", netflix?.proximaEstimada === sumarDias(netflix?.ultima ?? "", 30));
check("las compras sueltas de feria NO se marcan recurrentes",
  !REC.recurrentes.some((r) => r.descripcion.startsWith("feria")));

// --- Falsos positivos que NO deben pasar ---------------------------------
// (a) dos apariciones no alcanzan
const dos = [tx("2026-08-01", 100, "Ocio", "Gimnasio"), tx("2026-09-01", 100, "Ocio", "Gimnasio")];
for (let i = 0; i < 10; i++) dos.push(tx(sumarDias("2026-08-02", i * 3), 30, "Alimentación", `x${i}`));
check("dos apariciones no bastan para llamarlo recurrente",
  !analizarGastos(dos, "2026-09-07").recurrentes.some((r) => r.descripcion === "Gimnasio"));
// (b) mismo nombre pero montos dispares
const dispar = [];
for (const [i, m] of [200, 20, 350].entries()) dispar.push(tx(sumarDias("2026-06-01", i * 30), m, "Ocio", "Salida"));
for (let i = 0; i < 10; i++) dispar.push(tx(sumarDias("2026-06-02", i * 5), 25, "Alimentación", `y${i}`));
check("montos muy distintos no son un recurrente",
  !analizarGastos(dispar, "2026-09-07").recurrentes.some((r) => r.descripcion === "Salida"));
// (c) mismo nombre pero cadencia irregular
const irregular = [];
for (const d of [0, 7, 60]) irregular.push(tx(sumarDias("2026-06-01", d), 80, "Ocio", "Cine"));
for (let i = 0; i < 10; i++) irregular.push(tx(sumarDias("2026-06-02", i * 5), 25, "Alimentación", `z${i}`));
check("una cadencia irregular tampoco",
  !analizarGastos(irregular, "2026-09-07").recurrentes.some((r) => r.descripcion === "Cine"));

// --- Día de la semana: viernes caros -------------------------------------
const semana = [];
for (let i = 0; i < 8; i++) {
  semana.push(tx(sumarDias("2026-07-03", i * 7), 400, "Ocio", `viernes ${i}`)); // 2026-07-03 es viernes
  semana.push(tx(sumarDias("2026-07-06", i * 7), 30, "Alimentación", `lunes ${i}`));
}
const S = analizarGastos(semana, "2026-08-28");
check("identifica el día de la semana más caro", S.diaMasCaro?.nombre === "viernes",
  JSON.stringify(S.porDiaSemana.map(d => [d.nombre, d.promedio])));
check("y lo reporta como hallazgo", S.hallazgos.some((h) => h.id === "dia-caro"));
const viernes = S.porDiaSemana.find((d) => d.nombre === "viernes");
check("el promedio por día divide por cuántos viernes hubo, no por movimientos",
  // 8 viernes con 400 Bs, pero 9 viernes en el rango → 3200/9 = 355,56.
  // Si dividiera por movimientos daría 400: por eso el número importa.
  viernes.total === 3200 && viernes.movimientos === 8 && viernes.promedio === 355.56,
  JSON.stringify(viernes));

// --- Categorías en alza y tasa de ahorro ---------------------------------
const alza = [];
for (const mes of ["2026-06", "2026-07", "2026-08"]) {
  alza.push(tx(`${mes}-10`, 1000, "Alimentación", "mercado"));
  alza.push(tx(`${mes}-15`, 500, "Transporte", "gasolina"));
  alza.push(tx(`${mes}-05`, 8000, null, "sueldo", "ingreso"));
}
// Relleno para superar el mínimo de movimientos sin tocar las dos categorías
// que se están midiendo.
for (let i = 0; i < 6; i++) alza.push(tx(sumarDias("2026-06-20", i * 12), 60, "Servicios", `serv ${i}`));
alza.push(tx("2026-09-03", 2500, "Alimentación", "mercado grande"));
alza.push(tx("2026-09-04", 480, "Transporte", "gasolina"));
alza.push(tx("2026-09-02", 8000, null, "sueldo", "ingreso"));
const A = analizarGastos(alza, "2026-09-07");
const ali = A.categoriasEnAlza.find((c) => c.categoria === "Alimentación");
check("detecta la categoría que subió", !!ali && ali.pct === 1.5,
  JSON.stringify(A.categoriasEnAlza));
check("y NO marca en alza la que quedó igual",
  !A.categoriasEnAlza.some((c) => c.categoria === "Transporte"));
const junio = A.porMes.find((m) => m.period === "2026-06");
check("calcula la tasa de ahorro por mes",
  junio.gasto === 1560 && junio.ingreso === 8000 && junio.tasaAhorro === 0.805,
  JSON.stringify(junio));
check("y avisa si el ahorro es bueno", A.hallazgos.some((h) => h.id === "ahorro" && h.tono === "bueno"));

// --- Ruido de categorías minúsculas --------------------------------------
const minucia = [];
for (const mes of ["2026-06", "2026-07", "2026-08"]) {
  minucia.push(tx(`${mes}-10`, 5, "Propinas", "propina"));
  minucia.push(tx(`${mes}-11`, 900, "Alimentación", "mercado"));
  minucia.push(tx(`${mes}-12`, 200, "Transporte", "taxi"));
  minucia.push(tx(`${mes}-13`, 150, "Servicios", "luz"));
}
minucia.push(tx("2026-09-01", 40, "Propinas", "propina")); // +700%, pero son 40 Bs
const M = analizarGastos(minucia, "2026-09-07");
check("una categoría minúscula no encabeza las alzas por un +700%",
  !M.categoriasEnAlza.some((c) => c.categoria === "Propinas"),
  JSON.stringify(M.categoriasEnAlza));

// --- Concentración y días sin gastar -------------------------------------
check("mide la concentración en las 3 categorías mayores",
  M.concentracion != null && M.concentracion.categorias.length === 3 &&
  M.concentracion.top3Pct > 0.9 && M.concentracion.top3Pct <= 1);
check("cuenta los días sin gastar de los últimos 30",
  // Ventana 2026-08-09 … 2026-09-07: hay gasto el 10, 11, 12 y 13 de agosto y
  // el 1 de septiembre → 5 días con gasto, 25 sin.
  M.diasSinGastar === 25, `${M.diasSinGastar}`);

// --- Robustez ------------------------------------------------------------
const sucio = [];
for (let i = 0; i < 12; i++) sucio.push(tx(sumarDias("2026-08-01", i), 10, null, null));
const X = analizarGastos(sucio, "2026-09-07");
check("sin categoría ni descripción no rompe",
  X.suficienteData && X.concentracion.categorias[0] === "Sin categoría" && X.recurrentes.length === 0);
check("sin ingresos, la tasa de ahorro es null y no 0", X.tasaAhorroPromedio === null);

let f = 0;
for (const [n, ok, extra] of pruebas) {
  if (!ok) f++;
  console.log(`${ok ? "OK   " : "FALLA"} ${n}${!ok && extra ? `  → ${extra}` : ""}`);
}
console.log(`\n${pruebas.length - f}/${pruebas.length}`);
process.exit(f ? 1 : 0);
