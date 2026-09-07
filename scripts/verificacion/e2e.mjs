// Prueba de extremo a extremo contra un Postgres real: el cálculo en vivo del
// dashboard y el cierre del job deben coincidir exactamente.
import { build } from "esbuild";
import { conectar } from "./supa-pg.mjs";

await build({
  entryPoints: ["/home/user/jc_money/lib/patrimonio/estado.ts", "/home/user/jc_money/lib/jobs/patrimonio-diario.ts"],
  bundle: true, format: "esm", platform: "node", outdir: "/tmp/compilado", outExtension: { ".js": ".mjs" },
  logLevel: "error", external: ["@supabase/supabase-js"], alias: { "@": "/home/user/jc_money" },
});
const { calcularEstadoPatrimonio, disponibilidadDe, distribucionMonedaDe } = await import("/tmp/compilado/patrimonio/estado.mjs");
const { ejecutarPatrimonioDiario } = await import("/tmp/compilado/jobs/patrimonio-diario.mjs");

const USER = "11111111-1111-1111-1111-111111111111";
const { pool, db } = await conectar();
const r2 = (n) => Math.round(n * 100) / 100;

// La batería se deja el escenario como lo encontró: si no, la segunda corrida
// arranca con la foto auto y los datos que creó la primera, y falla sin que
// haya ningún problema real en el código.
async function reiniciarEscenario() {
  await pool.query("delete from net_worth_snapshots where kind = 'auto'");
  await pool.query("delete from transactions where txn_date <> '2026-09-03'");
  await pool.query("delete from dpf_deposits where principal = 5000");
  await pool.query(`update debts set paid_amount = 0, status = 'pendiente',
    collected_date = null, paid_account_id = null where counterparty = 'Deuda nueva del día'`);
}
await reiniciarEscenario();
const pruebas = [];
const check = (n, ok) => pruebas.push([n, ok]);

// ---------- 1. Estado en vivo ----------
const vivo = await calcularEstadoPatrimonio(db, USER, "2026-09-03");
const saldos = Object.fromEntries(vivo.balances.map((b) => [b.account.name, b.amount]));
const suma = r2(vivo.balances.reduce((a, b) =>
  a + (b.account.is_liability ? -1 : 1) * (b.account.currency === "BOB" ? b.amount : b.amount * vivo.rate), 0));

console.log("— Estado en vivo al 2026-09-03 —");
console.log("  base            :", vivo.base.snapshot_date, `(${vivo.base.kind})`, "total", vivo.baseTotalBob);
console.log("  neto del período:", vivo.netoBob, `(${vivo.cantidadMovimientosDia} movimientos)`);
console.log("  saldos          :", JSON.stringify(saldos));
console.log("  TOTAL           :", vivo.totalBob, "| Σ saldos:", suma);
console.log("  disponibilidad  :", disponibilidadDe(vivo), "| por moneda:", JSON.stringify(distribucionMonedaDe(vivo)));

check("la base es la foto manual del 3", String(vivo.base.snapshot_date).startsWith("2026-09-03") && vivo.base.kind === "manual");
check("cuenta los 3 gastos del día entero (decisión E4)", vivo.cantidadMovimientosDia === 3 && vivo.netoBob === -24);
check("Efectivo Bs refleja los gastos: 685,30 − 24 = 661,30", saldos["Efectivo Bs"] === 661.3);
check("Por Cobrar se recalcula de 1605 a 1745", saldos["Por Cobrar"] === 1745);
check("INVARIANTE total = Σ(saldos)", vivo.totalBob === suma);
check("el total sube 116 sobre la base (−24 gastos +140 derivadas)", r2(vivo.totalBob - vivo.baseTotalBob) === 116);

// ---------- 2. El job cierra el día ----------
const res = await ejecutarPatrimonioDiario(db, { targetDate: "2026-09-03" });
console.log("\n— Cierre del job —");
console.log(" ", JSON.stringify({ total: res.total_bob, neto: res.neto_dia_bob, base: res.base_date }));

check("el job guarda EXACTAMENTE lo que mostraba el dashboard", res.total_bob === vivo.totalBob);
check("y el mismo neto", res.neto_dia_bob === vivo.netoBob);

const { rows: guardados } = await pool.query(
  `select a.name, b.amount from net_worth_balances b
     join accounts a on a.id = b.account_id
    where b.snapshot_id = $1`, [res.snapshot_id]);
const persistidos = Object.fromEntries(guardados.map((g) => [g.name, Number(g.amount)]));
check("los saldos persistidos coinciden con los mostrados", JSON.stringify(persistidos) === JSON.stringify(saldos));

// ---------- 3. Idempotencia ----------
const rep = await ejecutarPatrimonioDiario(db, { targetDate: "2026-09-03" });
check("ejecutar el job dos veces no duplica la foto", rep.skipped === true);

// ---------- 4. Un gasto nuevo se refleja al instante ----------
await pool.query(
  `insert into transactions (user_id,txn_date,type,amount,account_id)
   values ($1,'2026-09-04','gasto',50,'a0000000-0000-0000-0000-000000000001')`, [USER]);
const vivo2 = await calcularEstadoPatrimonio(db, USER, "2026-09-04");
console.log("\n— Tras registrar un gasto de 50 el día 4 —");
console.log("  base:", String(vivo2.base.snapshot_date).slice(0, 10), `(${vivo2.base.kind})`, "| TOTAL:", vivo2.totalBob);
check("la base pasa a ser la foto auto recién creada", vivo2.base.kind === "auto");
check("el gasto se refleja SIN esperar al cierre", r2(vivo.totalBob - vivo2.totalBob) === 50);
check("no se recuentan los gastos del día 3 (base auto → día siguiente)", vivo2.netoBob === -50);

// ---------- 5. Las derivadas se evalúan A LA FECHA, no a hoy ----------
// Se cobra la deuda de 140 el día 6. Recalcular el día 3 no debe verse afectado
// por algo ocurrido tres días después.
await pool.query(`update debts set paid_amount=140, status='pagado', collected_date='2026-09-06',
  paid_account_id='a0000000-0000-0000-0000-000000000002' where counterparty='Deuda nueva del día'`);
const vivo3 = await calcularEstadoPatrimonio(db, USER, "2026-09-03");
const porCobrar3 = vivo3.balances.find((b) => b.account.name === "Por Cobrar").amount;
const vivo6 = await calcularEstadoPatrimonio(db, USER, "2026-09-06");
const porCobrar6 = vivo6.balances.find((b) => b.account.name === "Por Cobrar").amount;
console.log("\n— Cobro de la deuda el día 6 —");
console.log("  Por Cobrar al día 3:", porCobrar3, "| al día 6:", porCobrar6);
check("recalcular un día pasado NO se contamina con el estado de hoy", porCobrar3 === 1745);
check("y el día del cobro sí lo refleja", porCobrar6 === 1605);
await pool.query(`update debts set paid_amount=0, status='pendiente', collected_date=null,
  paid_account_id=null where counterparty='Deuda nueva del día'`);

// ---------- 6. Un DPF que aún no existía no cuenta ----------
await pool.query(`alter table dpf_deposits add column if not exists start_date date`);
await pool.query(`alter table dpf_deposits add column if not exists end_date date`);
await pool.query(`alter table dpf_deposits add column if not exists paid_at date`);
await pool.query(`insert into dpf_deposits (user_id,principal,status,start_date) values ($1,5000,'activo','2026-09-05')`, [USER]);
const vivoDpf3 = await calcularEstadoPatrimonio(db, USER, "2026-09-03");
const dpf3 = vivoDpf3.balances.find((b) => b.account.name === "DPF Congelado").amount;
const vivoDpf6 = await calcularEstadoPatrimonio(db, USER, "2026-09-06");
const dpf6 = vivoDpf6.balances.find((b) => b.account.name === "DPF Congelado").amount;
console.log("\n— DPF abierto el día 5 —");
console.log("  DPF al día 3:", dpf3, "| al día 6:", dpf6);
check("un DPF que aún no existía no cuenta en una fecha anterior", dpf3 === 39000);
check("y sí cuenta desde que empieza", dpf6 === 44000);

console.log("");
let f = 0;
for (const [n, ok] of pruebas) { if (!ok) f++; console.log(`${ok ? "OK   " : "FALLA"} ${n}`); }
console.log(f === 0 ? `\n${pruebas.length}/${pruebas.length} correctas` : `\n${f} FALLOS`);
await reiniciarEscenario();
await pool.end();
process.exit(f ? 1 : 0);
