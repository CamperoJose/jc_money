import { build } from "esbuild";
await build({ entryPoints: ["/home/user/jc_money/lib/emails/plantillas.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/plantillas.mjs", logLevel: "error",
  alias: { "@": "/home/user/jc_money" } });
const { htmlPatrimonioDiario, htmlReporteMensual } = await import("/tmp/plantillas.mjs");

const base = { fecha: "2026-09-03", totalBob: 65645.57, totalUsd: 5328.37, tc: 12.32,
  deltaBob: 116, deltaPct: 0.0018, disponibilidad: 13353.57, porCobrar: 1745, activos: 11571,
  dpf: { capital: 39000, gananciaLiquida: 2100, proxima: null } };

const conGastos = htmlPatrimonioDiario({ ...base, dia: { gastos: 24, ingresos: 0, neto: -24, cantidad: 3,
  porCategoria: [{ nombre: "Alimentación", monto: 18 }, { nombre: "Transporte", monto: 6 }] } });
const sinGastos = htmlPatrimonioDiario({ ...base, dia: { gastos: 0, ingresos: 0, neto: 0, cantidad: 0, porCategoria: [] } });
const sinDatos  = htmlPatrimonioDiario({ ...base, dia: null });

console.log("asunto con gastos :", conGastos.subject);
console.log("asunto sin gastos :", sinGastos.subject);
console.log("texto plano       :", conGastos.text);

const pruebas = [
  ["el asunto incluye lo gastado", conGastos.subject.includes("gastaste") && conGastos.subject.includes("24")],
  ["el asunto NO lo incluye si no hubo gastos", !sinGastos.subject.includes("gastaste")],
  ["el cuerpo lista las categorías", conGastos.html.includes("Alimentación") && conGastos.html.includes("Transporte")],
  ["muestra el número de movimientos", conGastos.html.includes("3 movimientos")],
  ["un día sin movimientos se celebra, no se deja en blanco", sinGastos.html.includes("Sin movimientos")],
  ["si el resumen falla, el correo sale igual", sinDatos.html.includes("Patrimonio neto") && !sinDatos.subject.includes("gastaste")],
  ["el texto plano incluye el gasto", conGastos.text.includes("Gastado")],
];
// ---- Reporte mensual ----
const mensualBase = { period: "2026-08", presupuestoPlaneado: 0, presupuestoGastado: 0,
  presupuestoExcedidas: 0, dpfCobrados: 0, gananciaDpfMes: 0 };
// El caso que llegó al correo real: un mes sin nada registrado.
const mesVacio = htmlReporteMensual({ ...mensualBase, gastoMes: 0, ingresoMes: 0, movimientos: 0,
  topCategorias: [], patrimonioFin: 63235.4, deltaPatrimonioBob: null, deltaPatrimonioPct: null });
const mesConDatos = htmlReporteMensual({ ...mensualBase, gastoMes: 4820.5, ingresoMes: 9000,
  movimientos: 37, topCategorias: [{ nombre: "Alimentación", monto: 2100 }],
  patrimonioFin: 63235.4, deltaPatrimonioBob: 1200, deltaPatrimonioPct: 0.019 });
// Sin ninguna foto en el rango no se puede comparar ni dar el cierre.
const mesSinFotos = htmlReporteMensual({ ...mensualBase, gastoMes: 100, ingresoMes: 0, movimientos: 2,
  topCategorias: [{ nombre: "Otros", monto: 100 }], patrimonioFin: null,
  deltaPatrimonioBob: null, deltaPatrimonioPct: null });

console.log("asunto mensual    :", mesVacio.subject);

pruebas.push(
  ["el mensual se anuncia como cierre, no como el mes en curso",
    mesVacio.subject.includes("Cierre de") && mesVacio.subject.includes("agosto")],
  ["un mes sin movimientos lo dice, no muestra un tablero de ceros",
    mesVacio.html.includes("No se registró ningún movimiento") && !mesVacio.html.includes("Gasto del mes")],
  ["la tarjeta de patrimonio trae su valor (antes salía vacía)",
    mesVacio.html.includes("63.235,40") && mesConDatos.html.includes("63.235,40")],
  ["sin foto en el rango, el patrimonio es «—» y no 0,00",
    mesSinFotos.html.includes("Patrimonio al cierre") && !mesSinFotos.html.includes("Bs 0,00")],
  ["sin comparación no se pinta una flecha de 0,00",
    !mesVacio.html.includes("▲") && mesSinFotos.html.includes("Sin comparación")],
  ["un mes con datos sí trae el tablero completo",
    mesConDatos.html.includes("Gasto del mes") && mesConDatos.html.includes("37 movimiento(s)") &&
    mesConDatos.html.includes("Alimentación") && mesConDatos.html.includes("▲")],
  ["no quedan restos verdes del tema anterior",
    !mesConDatos.html.includes("#d1fae5") && !conGastos.html.includes("#d1fae5")],
);

let f = 0;
console.log("");
for (const [n, ok] of pruebas) { if (!ok) f++; console.log(`${ok ? "OK   " : "FALLA"} ${n}`); }
import { writeFileSync } from "node:fs";
writeFileSync("/tmp/correo.html", conGastos.html);
process.exit(f ? 1 : 0);
