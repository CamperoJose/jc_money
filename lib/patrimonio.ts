import type { Account, NetWorthBalance, Currency } from "@/lib/types";

/**
 * Regla de cálculo del patrimonio de una foto (fiel al Excel, validada contra
 * los datos reales — ver claude/modelo-datos.md y claude/decisiones.md C1):
 *
 *   total_bob = Σ(cuentas BOB no pasivas)
 *             + T/C · Σ(cuentas USD/USDT no pasivas)
 *             − Σ(cuentas is_liability = true, convertidas a BOB)
 *
 * Las cuentas `por_cobrar` (columna "Debts") y `DPF Congelado` son activos en
 * BOB → suman. No hay pasivos en las fotos históricas, pero la regla los resta
 * si aparecen (p.ej. Tarjeta Mercantil).
 *
 * total_usd = total_bob / T/C
 */

type BalanceConCuenta = Pick<NetWorthBalance, "amount"> & {
  account: Pick<Account, "currency" | "is_liability">;
};

function aBob(amount: number, currency: Currency, exchangeRate: number): number {
  return currency === "BOB" ? amount : amount * exchangeRate;
}

export function calcularTotalBob(
  balances: BalanceConCuenta[],
  exchangeRate: number
): number {
  let total = 0;
  for (const b of balances) {
    const enBob = aBob(b.amount, b.account.currency, exchangeRate);
    total += b.account.is_liability ? -enBob : enBob;
  }
  return redondear(total);
}

export function calcularTotalUsd(totalBob: number, exchangeRate: number): number {
  if (!exchangeRate) return 0;
  return redondear(totalBob / exchangeRate);
}

export function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Distribución del patrimonio por moneda (en BOB) para el dashboard. */
export function distribucionPorMoneda(
  balances: BalanceConCuenta[],
  exchangeRate: number
): Record<Currency, number> {
  const acc: Record<Currency, number> = { BOB: 0, USD: 0, USDT: 0 };
  for (const b of balances) {
    if (b.account.is_liability) continue;
    acc[b.account.currency] += aBob(b.amount, b.account.currency, exchangeRate);
  }
  (Object.keys(acc) as Currency[]).forEach((k) => (acc[k] = redondear(acc[k])));
  return acc;
}
