// Cuenta las consultas y mide el tiempo del cálculo, con latencia simulada de
// red (Supabase está a decenas de ms, no a 0,2 ms como un Postgres local).
import { build } from "esbuild";
import { conectar } from "./supa-pg.mjs";
await build({ entryPoints: ["/home/user/jc_money/lib/patrimonio/estado.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/estado3.mjs", logLevel: "error",
  external: ["@supabase/supabase-js"], alias: { "@": "/home/user/jc_money" } });
const { calcularEstadoPatrimonio } = await import("/tmp/estado3.mjs");
const USER = "11111111-1111-1111-1111-111111111111";
const { pool, db } = await conectar();

const LATENCIA = 40; // ms por viaje, típico de Supabase desde Vercel
let consultas = 0;
const original = pool.query.bind(pool);
pool.query = async (...a) => { consultas++; await new Promise((r) => setTimeout(r, LATENCIA)); return original(...a); };

const t0 = Date.now();
await calcularEstadoPatrimonio(db, USER, "2026-09-03");
const ms = Date.now() - t0;
console.log(`consultas: ${consultas}`);
console.log(`tiempo con ${LATENCIA} ms de latencia por viaje: ${ms} ms`);
console.log(`viajes encadenados (profundidad): ~${Math.round(ms / LATENCIA)}`);
await pool.end();
