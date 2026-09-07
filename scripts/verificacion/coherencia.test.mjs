// Verifica que el dashboard y el cierre usan EL MISMO cálculo, y que el job
// solo persiste. Se comprueba sobre el código, no sobre suposiciones.
import { readFileSync } from "node:fs";
const job = readFileSync("/home/user/jc_money/lib/jobs/patrimonio-diario.ts", "utf8");
const page = readFileSync("/home/user/jc_money/app/tracking/patrimonio/page.tsx", "utf8");
const estado = readFileSync("/home/user/jc_money/lib/patrimonio/estado.ts", "utf8");

const pruebas = [
  ["el job llama al cálculo compartido", job.includes("calcularEstadoPatrimonio(admin, userId, targetDate)")],
  ["el dashboard llama al mismo cálculo", page.includes("calcularEstadoPatrimonio(supabase, user.id")],
  ["el job ya NO calcula derivadas por su cuenta", !job.includes("dpf_deposits")],
  ["el job ya NO consulta transacciones por su cuenta", !job.includes('from("transactions")')],
  ["el job ya NO consulta movimientos por su cuenta", !job.includes("sold_account_id")],
  ["el total sale de los saldos (invariante total = Σ saldos)", estado.includes("calcularTotalBob(balances, rate)")],
  ["el cálculo compartido no escribe nada", !/\.insert\(|\.update\(|\.delete\(/.test(estado)],
  ["el job sí persiste", job.includes(".insert(")],
  ["el dashboard tolera un fallo del cálculo en vivo", page.includes('resEstado.status === "fulfilled"')],
  ["disponibilidad y distribución también en vivo", page.includes("disponibilidadDe(estado)") && page.includes("distribucionMonedaDe(estado)")],
];
let fallos = 0;
for (const [nombre, ok] of pruebas) { if (!ok) fallos++; console.log(`${ok ? "OK   " : "FALLA"} ${nombre}`); }
console.log(fallos === 0 ? "\nUna sola copia de la lógica" : `\n${fallos} fallos`);
process.exit(fallos ? 1 : 0);
