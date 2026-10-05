// Verificación manual de las tendencias y aperturas con datos conocidos.
// Sin framework, sin CI y sin acceso a cuentas reales. Ejecutar explícitamente:
//   node scripts/verificacion/tendencias.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const ts = require("typescript");
require.extensions[".ts"] = (mod, file) => mod._compile(ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
}).outputText, file);
const { analizarTendencia } = require("../../lib/tendencias.ts");
const { proyectarPatrimonio, aplicarEscenario, resumirFlujos } = require("../../lib/proyeccion-patrimonio.ts");
const { normalizarFotos, proximasAperturas, sumarDias, diasEntre } = require("../../lib/tendencias-fechas.ts");
const { leerTodasLasFilas } = require("../../lib/queries/paginas.ts");
let revisados = 0;
let fallos = 0;
function check(nombre, ok) { revisados++; if (!ok) fallos++; console.log(`${ok ? "OK" : "FALLA"} ${nombre}`); }
const cerca = (a, b) => Math.abs(a - b) < 0.02;
const base = (fecha, bob) => ({ fecha, bob, disponible: 20000, exposicion: 1000, rate: 10, enVivo: true });
function diario(desde, hasta, fn) {
  return Array.from({ length: diasEntre(desde, hasta) + 1 }, (_, i) => ({ fecha: sumarDias(desde, i), bob: fn(i) }));
}
const lineal = diario("2025-01-01", "2026-09-29", (i) => 50000 + i * 100);
const hoy = "2026-09-30";
const saldo = 50000 + diasEntre("2025-01-01", hoy) * 100;
const p = proyectarPatrimonio({ hoy, serie: lineal, base: base(hoy, saldo) });
check("doce aperturas consecutivas, todas el día 1", p.aperturas.length === 12 && p.aperturas.every((a) => a.fecha.endsWith("-01")));
check("primera apertura desde HOY, no desde una foto antigua", p.aperturas[0].fecha === "2026-10-01");
check("apertura equivale al cierre anterior; no agrega movimientos del día 1", p.aperturas[0].dias === 0 && p.aperturas[0].patrimonio === saldo);
check("noviembre conserva los 31 días reales de octubre", p.aperturas[1].dias === 31 && p.aperturas[1].patrimonio === saldo + 3100);
check("backtest elige tendencia frente a saldo constante", p.modelo.validado && p.modelo.id !== "constante" && p.validacion.find((v) => v.id === p.modelo.id).mae < 0.01);
check("comparación justa: igual número de cierres por modelo", new Set(p.validacion.map((v) => v.evaluaciones)).size === 1);
check("todos los valores y rangos son finitos", p.aperturas.every((a) => Number.isFinite(a.patrimonio) && (!a.rango || a.rango.every(Number.isFinite))));
check("fechas lejanas se marcan extrapolación", p.aperturas.at(-1).extrapolacion);
check("diciembre avanza al año siguiente", proximasAperturas("2026-12-31")[0] === "2027-01-01");
check("febrero bisiesto termina el 29", sumarDias("2028-03-01", -1) === "2028-02-29");
check("febrero no bisiesto termina el 28", sumarDias("2027-03-01", -1) === "2027-02-28");
check("si hoy es día 1 se proyecta el MES SIGUIENTE", proximasAperturas("2026-10-01")[0] === "2026-11-01");
const limpia = normalizarFotos([{ fecha: "2026-02-02", bob: 20 }, { fecha: "2026-02-01", bob: 10 }, { fecha: "2026-02-02", bob: 30 }, { fecha: "2026-02-30", bob: 9 }, { fecha: "2026-02-03", bob: NaN }, { fecha: "2027-01-01", bob: 100 }], "2026-09-30");
check("ordena, consolida duplicados y excluye fechas inválidas y futuras", limpia.length === 2 && limpia[0].bob === 10 && limpia[1].bob === 30);
const corta = proyectarPatrimonio({ hoy, serie: [{ fecha: hoy, bob: 500 }], base: base(hoy, 500) });
check("un solo registro conserva el saldo y no finge validación", corta.modelo.id === "constante" && !corta.modelo.validado && corta.aperturas.every((a) => a.rango === null));
const vacia = proyectarPatrimonio({ hoy, serie: [] });
check("sin base no inventa patrimonio ni aperturas", vacia.base === null && vacia.aperturas.length === 0);
const cero = proyectarPatrimonio({ hoy, serie: diario("2026-01-01", "2026-09-29", () => 0), base: base(hoy, 0) });
check("serie constante y cero no generan NaN", cero.modelo.id === "constante" && cero.aperturas.every((a) => a.patrimonio === 0));
const negativa = proyectarPatrimonio({ hoy, serie: diario("2026-01-01", "2026-09-29", (i) => -10000 - 100 * i), base: base(hoy, -37200) });
check("patrimonio negativo no se recorta a cero", negativa.aperturas.every((a) => a.patrimonio < 0));
const vieja = proyectarPatrimonio({ hoy, serie: [{ fecha: "2026-06-30", bob: 1000 }] });
check("la base antigua avisa y mantiene fechas futuras desde hoy", vieja.diasSinActualizar === 92 && vieja.aperturas[0].fecha === "2026-10-01");
const hist = analizarTendencia([...lineal, { fecha: hoy, bob: saldo }], { hoy });
check("regresión descriptiva conserva pendiente exacta", cerca(hist.ritmoDiario, 100) && hist.r2 === 1);
const fotos44 = Array.from({ length: 44 }, (_, i) => ({ fecha: sumarDias("2026-08-01", i), bob: 50000 + i }));
const fotos45 = Array.from({ length: 45 }, (_, i) => ({ fecha: sumarDias("2026-08-01", i), bob: 50000 + i }));
const resumen44 = analizarTendencia(fotos44, { hoy });
const resumen45 = analizarTendencia(fotos45, { hoy });
check("44 snapshots no habilitan hallazgos de patrones", !resumen44.suficienteParaPatrones && resumen44.n === 44 && resumen44.suficienteData);
check("45 snapshots habilitan hallazgos de patrones", resumen45.suficienteParaPatrones && resumen45.n === 45);
check("mes actual sigue parcial aunque hoy sea fin de mes", hist.porMes.at(-1).parcial);
const hueco = analizarTendencia([{ fecha: "2026-01-31", bob: 1000 }, { fecha: "2026-03-31", bob: 3000 }, { fecha: "2026-04-30", bob: 4000 }], { hoy: "2026-05-01" });
check("salto enero-marzo no se etiqueta cambio de marzo", !hueco.porMes.some((m) => m.period === "2026-03"));
const cierres = analizarTendencia([{ fecha: "2026-01-31", bob: 1000 }, { fecha: "2026-02-28", bob: 2000 }, { fecha: "2026-03-31", bob: 3000 }, { fecha: "2026-04-30", bob: 2000 }, { fecha: "2026-05-31", bob: 1500 }, { fecha: "2026-06-30", bob: 500 }], { hoy: "2026-07-01" });
check("racha exige meses consecutivos con cierres completos", cierres.racha?.meses === 3 && cierres.racha.direccion === "baja");
check("caída desde máximo se mantiene", cierres.drawdown.monto === 2500);
const roto = analizarTendencia([{ fecha: "2026-01-31", bob: 1000 }, { fecha: "2026-02-28", bob: 2000 }, { fecha: "2026-04-30", bob: 3000 }, { fecha: "2026-05-31", bob: 4000 }], { hoy: "2026-06-01" });
check("meses faltantes rompen la racha", roto.racha?.meses === 1);
function txn(fecha, type, monto, currency = "BOB", rate = null) { return { txn_date: fecha, type, amount: monto, amount_bob: monto, currency, exchange_rate: rate }; }
const txs = [txn("2026-06-01", "ingreso", 10000), txn("2026-06-15", "gasto", 2000), txn("2026-07-01", "ingreso", 12000), txn("2026-07-15", "gasto", 3000), txn("2026-08-01", "ingreso", 12000), txn("2026-08-15", "gasto", 5000), txn("2026-09-02", "gasto", 99000)];
const flujos = resumirFlujos(txs, hoy);
check("flujos usan meses cerrados y excluyen el mes actual", flujos.meses.length === 3 && cerca(flujos.netoMensual, 8000));
const foto = (fecha, saldo) => ({ snapshot_date: fecha, snapshot_at: `${fecha}T23:00:00Z`, exchange_rate: 10, balances: [{ account_id: "cuenta", amount: saldo, account: { currency: "BOB", is_liability: false } }] });
const fotosMensuales = [foto("2026-05-31", 10000), foto("2026-06-30", 11000), foto("2026-07-31", 12000), foto("2026-08-31", 13000)];
const conSnapshots = resumirFlujos(txs, hoy, fotosMensuales);
check("variación neta usa diferencias de saldos por cuenta en snapshots", cerca(conSnapshots.variacionSaldoSnapshots, 1000));
check("ingreso estimado combina variación de saldo y gasto de los mismos meses", cerca(conSnapshots.ingresoEstimadoSnapshots, 10000/3 + 1000) && cerca(conSnapshots.gastoReferenciaSnapshots, 10000/3));
const invalidos = resumirFlujos([...txs, txn("2026-08-20", "gasto", 100, "USD"), txn("2026-10-01", "ingreso", 1000)], hoy);
check("cotización faltante excluye todo ese mes de referencia", invalidos.omitidas === 1 && !invalidos.meses.includes("2026-08"));
check("transacción futura no contamina histórico", invalidos.futuras === 1 && invalidos.ingresoMensual === 11000);
const iniciada = resumirFlujos(txs.map((t, i) => i === 0 ? { ...t, txn_date: "2026-06-05" } : t), hoy);
check("primer mes iniciado a mitad no cuenta como completo", !iniciada.meses.includes("2026-06"));
const calendario = { dpfs: [{ status: "activo", start_date: "2026-01-01", end_date: "2026-10-15", principal: 8000 }], deudas: [{ status: "pendiente", debt_date: "2026-01-01", due_date: "2026-10-20", outstanding: 3000 }] };
const conFlujos = proyectarPatrimonio({ hoy, serie: lineal, base: base(hoy, saldo), transacciones: txs, ...calendario });
check("DPF y cobro quedan en el periodo correcto", conFlujos.aperturas[1].capitalDpf === 8000 && conFlujos.aperturas[1].porCobrar === 3000 && conFlujos.aperturas[0].capitalDpf === 0);
check("capital previsto no duplica el patrimonio", conFlujos.aperturas[1].patrimonio === p.aperturas[1].patrimonio);
check("disponibilidad por flujos no suma capital previsto", cerca(conFlujos.aperturas[1].disponiblePorFlujos, 20000 + 8000 * 31 / 30.4375));
const eventoDia1 = proyectarPatrimonio({ hoy, serie: lineal, base: base(hoy, saldo), dpfs: [{ ...calendario.dpfs[0], end_date: "2026-11-01" }] });
check("vencimiento del día 1 pertenece al siguiente periodo", eventoDia1.aperturas[1].capitalDpf === 0 && eventoDia1.aperturas[2].capitalDpf === 8000);
const atrasado = proyectarPatrimonio({ hoy, serie: lineal, base: base(hoy, saldo), dpfs: [{ ...calendario.dpfs[0], end_date: "2026-09-29" }] });
check("vencimiento atrasado no se inventa como cobro futuro", atrasado.aperturas.every((a) => a.capitalDpf === 0));
const escenario = aplicarEscenario(conFlujos, 500, 10);
check("shock de cotización se aplica una vez sobre exposición neta", cerca(escenario[0].patrimonio - conFlujos.aperturas[0].patrimonio, 1000));
check("ahorro adicional usa días reales", cerca(escenario[1].patrimonio - conFlujos.aperturas[1].patrimonio, 1000 + 500 * 31 / 30.4375));
check("escenario no altera el objeto base", conFlujos.aperturas[0].patrimonio === saldo);
check("shock cambiario no se finge como efectivo disponible", escenario[0].disponiblePorFlujos === conFlujos.aperturas[0].disponiblePorFlujos);
const sinVivo = proyectarPatrimonio({ hoy, serie: lineal, base: { ...base("2026-09-29", saldo), enVivo: false }, transacciones: txs });
check("base desactualizada no extrapola flujos como actuales", sinVivo.aperturas.every((a) => a.disponiblePorFlujos === null));
// Alterar solo el último punto no debe cambiar los errores de cortes anteriores.
const cambioFinal = proyectarPatrimonio({ hoy, serie: [...lineal.slice(0, -1), { ...lineal.at(-1), bob: 999999 }] });
check("backtest no utiliza registros posteriores al cierre evaluado", JSON.stringify(cambioFinal.validacion) === JSON.stringify(p.validacion));
const paginas = await leerTodasLasFilas(async (desde, hasta) => ({ data: Array.from({ length: Math.max(0, Math.min(100, 1250 - desde, hasta - desde + 1)) }, (_, i) => i + desde), error: null }));
check("lector recupera más de 1000 filas incluso si el servidor limita páginas", paginas.length === 1250 && paginas.at(-1) === 1249);
console.log(`\n${revisados - fallos}/${revisados} verificaciones correctas`);
process.exitCode = fallos ? 1 : 0;
