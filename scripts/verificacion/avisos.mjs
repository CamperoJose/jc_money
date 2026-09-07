// Verifica cuándo se manda (y cuándo NO) cada correo de alerta. Es la lógica
// que falla en silencio: o llega el mismo correo a diario hasta que se deja de
// leer, o no llega nunca y nadie se entera.
import { build } from "esbuild";
await build({ entryPoints: ["/home/user/jc_money/lib/jobs/avisos.ts"], bundle: true,
  format: "esm", platform: "node", outfile: "/tmp/avisos.mjs", logLevel: "error",
  external: ["@supabase/supabase-js"], alias: { "@": "/home/user/jc_money" } });
const { nivelDeEstado, decidirAvisoPresupuesto, decidirAvisoDeudas } = await import("/tmp/avisos.mjs");

const pruebas = [];
const check = (n, ok, extra = "") => pruebas.push([n, ok, extra]);

// --- Niveles ---------------------------------------------------------------
check("«ok» no genera aviso", nivelDeEstado("ok") === 0);
check("«alerta» es el nivel 85", nivelDeEstado("alerta") === 85);
check("«excedido» es el nivel 100", nivelDeEstado("excedido") === 100);
check("un estado desconocido no dispara nada", nivelDeEstado("sin_presupuesto") === 0);

// --- Presupuesto -----------------------------------------------------------
const fila = (id, nivel) => ({ categoryId: id, nivel, dato: id });

let d = decidirAvisoPresupuesto([fila("a", 85), fila("b", 0)], {});
check("avisa la primera vez que se cruza el 85%",
  d.nuevas.join() === "a" && d.marcas.a === 85, JSON.stringify(d));
check("y no avisa de una categoría que va bien", !("b" in d.marcas));

d = decidirAvisoPresupuesto([fila("a", 85)], { a: 85 });
check("al día siguiente, seguir en el 85% NO vuelve a avisar", d.nuevas.length === 0);

d = decidirAvisoPresupuesto([fila("a", 100)], { a: 85 });
check("pero pasar del 100% sí avisa otra vez",
  d.nuevas.join() === "a" && d.marcas.a === 100);

d = decidirAvisoPresupuesto([fila("a", 100)], { a: 100 });
check("y ya excedida no se repite", d.nuevas.length === 0);

d = decidirAvisoPresupuesto([fila("a", 85)], { a: 100 });
check("bajar de excedida a alerta tampoco reabre el aviso",
  d.nuevas.length === 0 && d.marcas.a === 100, JSON.stringify(d.marcas));

d = decidirAvisoPresupuesto([fila("a", 100), fila("b", 85), fila("c", 0)], { a: 85 });
check("en una misma corrida junta todas las que cruzaron algo",
  d.nuevas.sort().join() === "a,b", JSON.stringify(d.nuevas));

d = decidirAvisoPresupuesto([fila("a", 85)], { a: 85, z: 100 });
check("conserva las marcas de categorías que hoy no aparecen",
  d.marcas.z === 100 && d.marcas.a === 85, JSON.stringify(d.marcas));

d = decidirAvisoPresupuesto([fila("a", 85)], { a: "basura", b: 7 });
check("una marca corrupta se ignora y se vuelve a avisar",
  d.nuevas.join() === "a" && !("b" in d.marcas), JSON.stringify(d));

// --- Deudas vencidas -------------------------------------------------------
check("sin deudas vencidas no se manda nada",
  decidirAvisoDeudas([], null, "2026-09-07") === false);
check("la primera vez sí se avisa",
  decidirAvisoDeudas(["d1"], null, "2026-09-07") === true);
check("al día siguiente, las mismas deudas NO se repiten",
  decidirAvisoDeudas(["d1"], { fecha: "2026-09-07", ids: ["d1"] }, "2026-09-08") === false);
check("a los 6 días todavía no",
  decidirAvisoDeudas(["d1"], { fecha: "2026-09-07", ids: ["d1"] }, "2026-09-13") === false);
check("a los 7 sí, como recordatorio semanal",
  decidirAvisoDeudas(["d1"], { fecha: "2026-09-07", ids: ["d1"] }, "2026-09-14") === true);
check("una deuda vencida NUEVA avisa el mismo día",
  decidirAvisoDeudas(["d1", "d2"], { fecha: "2026-09-07", ids: ["d1"] }, "2026-09-08") === true);
check("cobrar una de dos no dispara un aviso por las que quedan",
  decidirAvisoDeudas(["d1"], { fecha: "2026-09-07", ids: ["d1", "d2"] }, "2026-09-08") === false);

let f = 0;
for (const [n, ok, extra] of pruebas) {
  if (!ok) f++;
  console.log(`${ok ? "OK   " : "FALLA"} ${n}${!ok && extra ? `  → ${extra}` : ""}`);
}
console.log(`\n${pruebas.length - f}/${pruebas.length}`);
process.exit(f ? 1 : 0);
