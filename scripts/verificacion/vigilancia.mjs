// Verifica el job de vigilancia contra Postgres real: que detecte los días sin
// cierre, que avise UNA sola vez por hueco y que vuelva a avisar si aparecen
// días nuevos. La lógica de «no repetir» es justo la que falla en silencio.
import { build } from "esbuild";
import { conectar } from "./supa-pg.mjs";

// El mailer se sustituye por un espía: aquí no se manda correo de verdad.
const stub = "/tmp/mailer-stub.mjs";
await (await import("node:fs/promises")).writeFile(stub, `
// El bundle se lleva una COPIA de este módulo, así que importarlo por separado
// daría otra instancia con su propio array. El buzón vive en globalThis, que sí
// comparten el bundle y este script.
globalThis.__correos = globalThis.__correos || [];
export function leerConfigCorreo() { return { user: "x", pass: "y" }; }
export async function enviarCorreo(m) { globalThis.__correos.push(m); return { ok: true }; }
`);
await build({
  entryPoints: ["/home/user/jc_money/lib/jobs/vigilancia.ts"],
  bundle: true, format: "esm", platform: "node", outfile: "/tmp/vigilancia.mjs",
  logLevel: "error", external: ["@supabase/supabase-js"],
  alias: { "@": "/home/user/jc_money", "@/lib/mailer": stub },
});
const { ejecutarVigilancia } = await import("/tmp/vigilancia.mjs");
globalThis.__correos = globalThis.__correos || [];
const enviados = globalThis.__correos;

const USER = "11111111-1111-1111-1111-111111111111";
const { pool, db } = await conectar();

const pruebas = [];
const check = (n, ok, extra = "") => pruebas.push([n, ok, extra]);

async function sql(q, params = []) { return (await pool.query(q, params)).rows; }
async function limpiar() {
  await sql("delete from net_worth_snapshots where kind = 'auto'");
  await sql("delete from app_settings where key = 'aviso_cierre_no_corrio'");
  enviados.length = 0;
}
/** Historia previa de cierres: sin ella no hay «primera foto automática» y la
 *  vigilancia calla, que es justo lo que debe hacer antes de que el job exista. */
async function conHistoria() {
  for (const f of ["2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29",
                   "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"]) {
    await fotoAuto(f);
  }
}
async function fotoAuto(fecha) {
  await sql(
    `insert into net_worth_snapshots (user_id, snapshot_date, snapshot_at, exchange_rate, total_bob, kind)
     values ($1, $2, $2::date + time '23:59', 6.96, 63235.62, 'auto')`,
    [USER, fecha]
  );
}

// --- Todo al día: no debe avisar -------------------------------------------
await limpiar();
await conHistoria();
for (const f of ["2026-09-04", "2026-09-05", "2026-09-06"]) await fotoAuto(f);
let r = await ejecutarVigilancia(db, { targetDate: "2026-09-07" });
check("con los cierres al día no manda nada", r.ok && r.dias_faltantes.length === 0 && enviados.length === 0,
  JSON.stringify(r.dias_faltantes));

// --- Faltan dos días: avisa una sola vez ------------------------------------
await limpiar();
await conHistoria();
await fotoAuto("2026-09-04");
r = await ejecutarVigilancia(db, { targetDate: "2026-09-07" });
check("detecta los días sin cierre",
  r.dias_faltantes.join(",") === "2026-09-05,2026-09-06", JSON.stringify(r.dias_faltantes));
check("no cuenta HOY como faltante (su cierre corre mañana)",
  !r.dias_faltantes.includes("2026-09-07"));
check("manda el aviso", r.aviso_enviado === true && enviados.length === 1);
check("con los días en el asunto y el cuerpo",
  enviados[0].subject.includes("2 día(s)") && enviados[0].html.includes("05 de septiembre") &&
  enviados[0].html.includes("06 de septiembre"), enviados[0]?.subject);

// --- Segunda corrida el mismo día: NO debe repetir --------------------------
r = await ejecutarVigilancia(db, { targetDate: "2026-09-07" });
check("no repite el aviso por el mismo hueco", r.aviso_enviado === false && enviados.length === 1);

// --- Pasa un día más sin cierre: sí vuelve a avisar -------------------------
r = await ejecutarVigilancia(db, { targetDate: "2026-09-08" });
check("pero sí avisa si aparece un día nuevo", r.aviso_enviado === true && enviados.length === 2,
  `enviados=${enviados.length}`);

// --- Se recupera el cierre: se olvida, y un hueco futuro vuelve a avisar ----
for (const f of ["2026-09-05", "2026-09-06", "2026-09-07"]) await fotoAuto(f);
r = await ejecutarVigilancia(db, { targetDate: "2026-09-08" });
check("recuperados los cierres, deja de avisar",
  r.dias_faltantes.length === 0 && r.aviso_enviado === false && enviados.length === 2);
await sql("delete from net_worth_snapshots where kind = 'auto' and snapshot_date = '2026-09-07'");
r = await ejecutarVigilancia(db, { targetDate: "2026-09-08" });
check("y un hueco posterior vuelve a avisar (la memoria se limpió)",
  r.aviso_enviado === true && enviados.length === 3, `enviados=${enviados.length}`);

// --- Una foto MANUAL no cuenta como cierre del job -------------------------
await limpiar();
await conHistoria();
await fotoAuto("2026-09-04");
await sql(
  `insert into net_worth_snapshots (user_id, snapshot_date, snapshot_at, exchange_rate, total_bob, kind)
   values ($1, '2026-09-05', '2026-09-05 12:00', 6.96, 1, 'manual')`, [USER]
);
r = await ejecutarVigilancia(db, { targetDate: "2026-09-07" });
check("una foto manual no tapa la falta del cierre automático",
  r.dias_faltantes.includes("2026-09-05"), JSON.stringify(r.dias_faltantes));

// --- Sin ningún cierre previo: no es un hueco, es que el job no existía -----
await limpiar();
r = await ejecutarVigilancia(db, { targetDate: "2026-09-07" });
check("si el cierre nunca corrió, no denuncia diez días inventados",
  r.ok && r.dias_faltantes.length === 0 && r.aviso_enviado === false && enviados.length === 0,
  JSON.stringify(r.dias_faltantes));

// Deja la base como estaba.
await sql("delete from net_worth_snapshots where kind = 'auto'");
await sql("delete from net_worth_snapshots where kind = 'manual' and snapshot_date = '2026-09-05'");
await sql("delete from app_settings where key = 'aviso_cierre_no_corrio'");

let f = 0;
for (const [n, ok, extra] of pruebas) {
  if (!ok) f++;
  console.log(`${ok ? "OK   " : "FALLA"} ${n}${!ok && extra ? `  → ${extra}` : ""}`);
}
console.log(`\n${pruebas.length - f}/${pruebas.length}`);
await pool.end();
process.exit(f ? 1 : 0);
