import { build } from "esbuild";
await build({ entryPoints: ["/home/user/jc_money/lib/emails/plantillas.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/plantillas.mjs", logLevel: "error",
  alias: { "@": "/home/user/jc_money" } });
const { htmlPatrimonioDiario, htmlReporteMensual, htmlAlertaPresupuesto,
        htmlDeudasVencidas, htmlCierreNoCorrio } = await import("/tmp/plantillas.mjs");

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

// ---- Alertas nuevas ----
// Ojo: es-BO separa "Bs" del número con un espacio DURO (U+00A0), así que las
// comparaciones se hacen contra el mismo formateador, no contra texto a mano.
const enBs = (n) => new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB",
  minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const presu = htmlAlertaPresupuesto([
  { categoria: "Alimentación", planeado: 1500, gastado: 1725, pct: 1.15, nivel: "excedido" },
  { categoria: "Transporte", planeado: 400, gastado: 350, pct: 0.875, nivel: "alerta" },
], "2026-09");
const deudas = htmlDeudasVencidas([
  { quien: "Marco", monto: 1200, vence: "2026-08-20", dias: 18, motivo: "préstamo" },
  { quien: "Ana", monto: 545, vence: "2026-09-01", dias: 6, motivo: null },
]);
const cierre = htmlCierreNoCorrio(["2026-09-05", "2026-09-06"], "2026-09-04");

console.log("asunto presupuesto:", presu.subject);
console.log("asunto deudas     :", deudas.subject);
console.log("asunto vigilancia :", cierre.subject);

pruebas.push(
  ["la alerta de presupuesto dice cuánto te pasaste",
    presu.html.includes("te pasaste") && presu.html.includes(enBs(225)) && presu.html.includes("115,0%")],
  ["y también lo que queda en la que solo está en alerta",
    presu.html.includes("te quedan") && presu.html.includes(enBs(50))],
  ["la barra del excedido no se pasa del 100% del ancho",
    !presu.html.includes('width="115%"') && presu.html.includes('width="100%"')],
  ["el correo de deudas suma el total y lo pone en el asunto",
    deudas.subject.includes(enBs(1745)) && deudas.html.includes(enBs(1745))],
  ["cada deuda muestra los días de atraso",
    deudas.html.includes("18 día(s) de atraso") && deudas.html.includes("6 día(s) de atraso")],
  ["una deuda sin motivo no imprime un separador suelto",
    deudas.html.includes("<strong>Ana</strong></div>")],
  ["la vigilancia lista los días que faltan y la última foto",
    cierre.html.includes("05 de septiembre") && cierre.html.includes("06 de septiembre") &&
    cierre.html.includes("04 de septiembre") && cierre.subject.includes("2 día(s)")],
);

let f = 0;
console.log("");
for (const [n, ok] of pruebas) { if (!ok) f++; console.log(`${ok ? "OK   " : "FALLA"} ${n}`); }
import { writeFileSync } from "node:fs";
writeFileSync("/tmp/correo.html", conGastos.html);
process.exit(f ? 1 : 0);
