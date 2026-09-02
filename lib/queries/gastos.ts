import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Category, TransactionUI, Currency } from "@/lib/types";

/** Categorías filtradas por tipo (gasto | ingreso | inversion). */
export async function getCategorias(
  supabase: SupabaseClient,
  kind?: "gasto" | "ingreso" | "inversion"
): Promise<Category[]> {
  let q = supabase
    .from("categories")
    .select("id, name, kind, parent_id, active")
    .order("name", { ascending: true });
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Category[];
}

function montoBob(amount: number, currency: Currency, rate: number | null): number {
  if (currency === "BOB") return Math.round(amount * 100) / 100;
  const r = rate && rate > 0 ? rate : 1;
  return Math.round(amount * r * 100) / 100;
}

/** Transacciones con catálogos resueltos, más recientes primero. */
export async function getTransacciones(
  supabase: SupabaseClient
): Promise<TransactionUI[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, occurred_at, txn_date, type, amount, currency, exchange_rate, account_id, category_id, description, tags, source, accounts(id, name, type, currency, is_liability, active), categories(id, name, kind, parent_id, active)"
    )
    .order("occurred_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((t: Record<string, unknown>) => {
    const amount = Number(t.amount);
    const currency = t.currency as Currency;
    const rate = t.exchange_rate != null ? Number(t.exchange_rate) : null;
    return {
      id: t.id as string,
      occurred_at: t.occurred_at as string,
      txn_date: t.txn_date as string,
      type: t.type as TransactionUI["type"],
      amount,
      currency,
      exchange_rate: rate,
      account_id: (t.account_id as string) ?? null,
      category_id: (t.category_id as string) ?? null,
      description: (t.description as string) ?? null,
      tags: (t.tags as string[]) ?? [],
      source: t.source as TransactionUI["source"],
      account: (t.accounts as Account) ?? null,
      category: (t.categories as Category) ?? null,
      amount_bob: montoBob(amount, currency, rate),
    };
  });
}

export interface ResumenGastos {
  transacciones: TransactionUI[];
  totalMesBob: number;
  totalMesAnteriorBob: number;
  variacionMesPct: number | null;
  conteoMes: number;
  promedioDiarioBob: number;
  porCategoria: { nombre: string; montoBob: number; pct: number }[];
  porMes: { periodo: string; gastoBob: number; ingresoBob: number }[];
  topGastos: TransactionUI[];
}

/** Resumen para el dashboard de gastos (mes actual en zona Bolivia). */
export async function getResumenGastos(
  supabase: SupabaseClient
): Promise<ResumenGastos> {
  const transacciones = await getTransacciones(supabase);
  const gastos = transacciones.filter((t) => t.type === "gasto");

  // Periodo YYYY-MM en base a txn_date (ya es fecha local Bolivia).
  const periodoDe = (t: TransactionUI) => (t.txn_date || t.occurred_at).slice(0, 7);
  const hoyPeriodo = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);

  const mesPeriodos = [...new Set(gastos.map(periodoDe))].sort();
  const idxMesAnterior = (() => {
    const [y, m] = hoyPeriodo.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();

  const delMes = gastos.filter((t) => periodoDe(t) === hoyPeriodo);
  const totalMesBob = redondea(delMes.reduce((a, t) => a + t.amount_bob, 0));
  const totalMesAnteriorBob = redondea(
    gastos.filter((t) => periodoDe(t) === idxMesAnterior).reduce((a, t) => a + t.amount_bob, 0)
  );
  const variacionMesPct =
    totalMesAnteriorBob > 0 ? (totalMesBob - totalMesAnteriorBob) / totalMesAnteriorBob : null;

  const diaActual = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz", day: "2-digit" }).format(new Date())
  );
  const promedioDiarioBob = diaActual > 0 ? redondea(totalMesBob / diaActual) : 0;

  // Gasto por categoría (mes actual).
  const catMap = new Map<string, number>();
  for (const t of delMes) {
    const nombre = t.category?.name ?? "Sin categoría";
    catMap.set(nombre, (catMap.get(nombre) ?? 0) + t.amount_bob);
  }
  const porCategoria = [...catMap.entries()]
    .map(([nombre, montoBob]) => ({ nombre, montoBob: redondea(montoBob), pct: totalMesBob ? montoBob / totalMesBob : 0 }))
    .sort((a, b) => b.montoBob - a.montoBob);

  // Serie por mes (gasto vs ingreso), últimos 12 periodos con datos.
  const periodosTodos = [...new Set(transacciones.map(periodoDe))].sort();
  const ultimos = periodosTodos.slice(-12);
  const porMes = ultimos.map((periodo) => {
    const delP = transacciones.filter((t) => periodoDe(t) === periodo);
    return {
      periodo,
      gastoBob: redondea(delP.filter((t) => t.type === "gasto").reduce((a, t) => a + t.amount_bob, 0)),
      ingresoBob: redondea(delP.filter((t) => t.type === "ingreso").reduce((a, t) => a + t.amount_bob, 0)),
    };
  });

  const topGastos = [...delMes].sort((a, b) => b.amount_bob - a.amount_bob).slice(0, 5);

  return {
    transacciones,
    totalMesBob,
    totalMesAnteriorBob,
    variacionMesPct,
    conteoMes: delMes.length,
    promedioDiarioBob,
    porCategoria,
    porMes,
    topGastos,
  };
}

function redondea(n: number): number {
  return Math.round(n * 100) / 100;
}
