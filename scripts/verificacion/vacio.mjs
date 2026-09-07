import { build } from "esbuild";
import { conectar } from "./supa-pg.mjs";
await build({ entryPoints: ["/home/user/jc_money/lib/patrimonio/estado.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/estado5.mjs", logLevel: "error",
  external: ["@supabase/supabase-js"], alias: { "@": "/home/user/jc_money" } });
const { calcularEstadoPatrimonio } = await import("/tmp/estado5.mjs");
const USER = "11111111-1111-1111-1111-111111111111";
const { pool, db } = await conectar();
// Una foto posterior SIN saldos (fila huérfana: pudo quedar de un insert a medias).
await pool.query(`insert into net_worth_snapshots (id,user_id,snapshot_date,snapshot_at,kind,exchange_rate)
  values ('60000000-0000-0000-0000-000000000009',$1,'2026-09-04','2026-09-04T20:00:00Z','manual',12.32)`, [USER]);
try {
  const e = await calcularEstadoPatrimonio(db, USER, "2026-09-04");
  console.log("devuelve un total de:", e.totalBob, "con", e.balances.length, "saldos");
  console.log(e.totalBob === 0 ? "PROBLEMA: patrimonio 0 sin avisar" : "");
} catch (err) { console.log("lanza:", err.message); }
await pool.query(`delete from net_worth_snapshots where id='60000000-0000-0000-0000-000000000009'`);
await pool.end();
