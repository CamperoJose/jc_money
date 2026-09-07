import { build } from "esbuild";
await build({ entryPoints: ["/home/user/jc_money/lib/emails/plantillas.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/plantillas.mjs", logLevel: "error",
  alias: { "@": "/home/user/jc_money" } });
const { htmlPatrimonioDiario } = await import("/tmp/plantillas.mjs");

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
let f = 0;
console.log("");
for (const [n, ok] of pruebas) { if (!ok) f++; console.log(`${ok ? "OK   " : "FALLA"} ${n}`); }
import { writeFileSync } from "node:fs";
writeFileSync("/tmp/correo.html", conGastos.html);
process.exit(f ? 1 : 0);
