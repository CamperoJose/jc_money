// La app debe funcionar con la migración 0015 SIN aplicar, que es el estado
// actual en producción: la columna `source_account_id` todavía no existe.
import { build } from "esbuild";
import { conectar } from "./supa-pg.mjs";
await build({ entryPoints: ["/home/user/jc_money/lib/patrimonio/estado.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/estado6.mjs", logLevel: "error",
  external: ["@supabase/supabase-js"], alias: { "@": "/home/user/jc_money" } });
const { calcularEstadoPatrimonio } = await import("/tmp/estado6.mjs");
const USER = "11111111-1111-1111-1111-111111111111";
const { pool, db } = await conectar();

const conColumna = await calcularEstadoPatrimonio(db, USER, "2026-09-03");
await pool.query("alter table debts drop column source_account_id");
let sinColumna, error = null;
try { sinColumna = await calcularEstadoPatrimonio(db, USER, "2026-09-03"); }
catch (e) { error = e; }
await pool.query("alter table debts add column source_account_id uuid references accounts(id)");

console.log("con la columna :", conColumna.totalBob);
console.log("sin la columna :", error ? `LANZA: ${error.message}` : sinColumna.totalBob);
const ok = !error && sinColumna.totalBob === conColumna.totalBob;
console.log(ok
  ? "\nOK: la app funciona igual sin la migración 0015 aplicada"
  : "\nFALLA: la app se rompe si 0015 no está aplicada");
await pool.end();
process.exit(ok ? 0 : 1);
