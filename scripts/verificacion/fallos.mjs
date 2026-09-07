// Un fallo transitorio debe FALLAR, no devolver un número plausible pero falso.
// Una migración sin aplicar sí debe tolerarse: es el caso para el que se diseñó.
import { build } from "esbuild";
import { conectar } from "./supa-pg.mjs";
await build({ entryPoints: ["/home/user/jc_money/lib/patrimonio/estado.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/estado4.mjs", logLevel: "error",
  external: ["@supabase/supabase-js"], alias: { "@": "/home/user/jc_money" } });
const { calcularEstadoPatrimonio } = await import("/tmp/estado4.mjs");
const USER = "11111111-1111-1111-1111-111111111111";
const { pool, db } = await conectar();

const bueno = await calcularEstadoPatrimonio(db, USER, "2026-09-03");
console.log("total correcto:", bueno.totalBob, "\n");

function conError(tabla, error) {
  return { from: (t) => {
    if (t !== tabla) return db.from(t);
    const stub = new Proxy({}, { get: (_, k) =>
      k === "then" ? (res) => res({ data: null, error }) : () => stub });
    return stub;
  } };
}

async function intentar(nombre, cliente) {
  try {
    const e = await calcularEstadoPatrimonio(cliente, USER, "2026-09-03");
    return { ok: true, total: e.totalBob };
  } catch (err) { return { ok: false, msg: err.message }; }
}

const red = new Error("fetch failed: timeout");
const migracion = Object.assign(new Error('relation "debts" does not exist'), { code: "42P01" });

const casos = [
  ["fallo de red en 'accounts'", await intentar("", conError("accounts", red)), false],
  ["fallo de red en 'debts'", await intentar("", conError("debts", red)), false],
  ["fallo de red en 'dpf_deposits'", await intentar("", conError("dpf_deposits", red)), false],
  ["fallo de red en 'assets'", await intentar("", conError("assets", red)), false],
  ["migración pendiente en 'debts'", await intentar("", conError("debts", migracion)), true],
];

let f = 0;
for (const [nombre, r, deberiaSeguir] of casos) {
  const ok = deberiaSeguir ? r.ok : !r.ok;
  if (!ok) f++;
  const detalle = r.ok ? `devuelve ${r.total}` : `lanza: ${r.msg.slice(0, 60)}`;
  console.log(`${ok ? "OK   " : "FALLA"} ${nombre.padEnd(32)} → ${detalle}`);
}
console.log(f === 0
  ? "\nUn fallo real se propaga; una migración pendiente se tolera."
  : `\n${f} FALLOS`);
await pool.end();
process.exit(f ? 1 : 0);
