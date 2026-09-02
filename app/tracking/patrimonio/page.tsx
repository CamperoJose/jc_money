import Link from "next/link";
import {
  TrendUp,
  TrendDown,
  Trophy,
  ListBullets,
  Wallet,
  ChartLineUp,
  Equals,
  ArrowUpRight,
  ArrowDownRight,
  CalendarBlank,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { getResumen, type ResumenPatrimonio } from "@/lib/queries/patrimonio";
import { getResumenDpf } from "@/lib/queries/dpf";
import type { ResumenDpf } from "@/lib/dpf";
import { DpfResumenCard } from "@/components/dpf/dpf-resumen-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  EvolucionChart,
  VariacionChart,
  DistribucionCuentasChart,
  CrecimientoCuentasChart,
} from "@/components/patrimonio/dashboard-charts";
import {
  formatBob,
  formatUsd,
  formatBobCompact,
  formatUsdCompact,
  formatNumber,
  formatDate,
  formatPercent,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PatrimonioDashboard() {
  const supabase = await createClient();

  let resumen: ResumenPatrimonio | null = null;
  let errorMsg: string | null = null;
  try {
    resumen = await getResumen(supabase);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  // DPF: tolerante a que la tabla/migración aún no exista (no rompe el dashboard).
  let resumenDpf: ResumenDpf | null = null;
  try {
    resumenDpf = await getResumenDpf(supabase);
  } catch {
    resumenDpf = null;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patrimonio</h1>
          <p className="text-sm text-muted-foreground">
            Tu patrimonio neto, su evolución y en qué está distribuido.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/tracking/patrimonio/registros">
            <ListBullets weight="bold" className="size-4" />
            Ver registros
          </Link>
        </Button>
      </div>

      {errorMsg && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="font-medium text-destructive">No se pudieron leer los datos.</p>
            <p className="mt-1 text-muted-foreground">
              Verifica que aplicaste el esquema SQL en Supabase y las semillas. Detalle: {errorMsg}
            </p>
          </CardContent>
        </Card>
      )}

      {resumen &&
        (resumen.snapshots.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Todavía no hay fotos de patrimonio. Ve a{" "}
              <Link href="/tracking/patrimonio/registros" className="font-medium text-primary underline">
                Registros
              </Link>{" "}
              para crear la primera, o migra el Excel.
            </CardContent>
          </Card>
        ) : (
          <Contenido resumen={resumen} />
        ))}

      {resumenDpf && resumenDpf.totalHistorico > 0 && <DpfResumenCard resumen={resumenDpf} />}
    </div>
  );
}

function Contenido({ resumen }: { resumen: ResumenPatrimonio }) {
  const {
    ultimo,
    variacionBob,
    variacionPct,
    variacionTotalBob,
    variacionTotalPct,
    maxBob,
    minBob,
    promedioBob,
    variacionPromedioBob,
    crecimientoMensualPct,
    diasDesdeUltima,
    mejorPeriodo,
    peorPeriodo,
    distribucionMoneda,
    distribucionCuentas,
    serieCuentas,
    disponibilidadRapida,
    disponibilidadPct,
  } = resumen;
  const sube = (variacionBob ?? 0) >= 0;
  const subeTotal = (variacionTotalBob ?? 0) >= 0;

  const totalMoneda = distribucionMoneda
    ? distribucionMoneda.BOB + distribucionMoneda.USD + distribucionMoneda.USDT
    : 0;

  return (
    <>
      {/* Hero + KPIs */}
      <section className="grid gap-4 lg:grid-cols-4">
        {/* Patrimonio neto (hero) */}
        <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent lg:col-span-2">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                Patrimonio neto
              </span>
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Wallet weight="fill" className="size-5" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-3xl font-bold text-primary tabular-nums sm:text-4xl">
                {formatBob(ultimo?.total_bob)}
              </div>
              <div className="mt-1 truncate text-sm text-muted-foreground tabular-nums">
                {formatUsd(ultimo?.total_usd)} · T/C {formatNumber(ultimo?.exchange_rate, 2)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <DeltaPill valor={variacionBob} pct={variacionPct} label="vs. anterior" />
              <span className="text-muted-foreground">al {formatDate(ultimo?.snapshot_date)}</span>
            </div>
          </CardContent>
        </Card>

        <Kpi
          label="Crecimiento total"
          valor={variacionTotalBob == null ? "—" : formatBobCompact(Math.abs(variacionTotalBob))}
          valorFull={variacionTotalBob == null ? undefined : formatBob(Math.abs(variacionTotalBob))}
          sub={variacionTotalPct == null ? "Desde la 1ª foto" : `${formatPercent(variacionTotalPct)} desde el inicio`}
          color={subeTotal ? "pos" : "neg"}
          icon={subeTotal ? TrendUp : TrendDown}
        />

        <Kpi
          label="Máximo histórico"
          valor={formatBobCompact(maxBob)}
          valorFull={formatBob(maxBob)}
          sub={`Mínimo ${formatBobCompact(minBob)}`}
          color="neutral"
          icon={Trophy}
        />
      </section>

      {/* Disponibilidad rápida (dinero líquido) */}
      {disponibilidadRapida != null && (
        <Card className="overflow-hidden border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Wallet weight="fill" className="size-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Disponibilidad rápida</div>
                <div className="text-xs text-muted-foreground">
                  Efectivo, banco y stablecoins (sin DPF, activos ni por cobrar)
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary tabular-nums">{formatBob(disponibilidadRapida)}</div>
              {disponibilidadPct != null && (
                <div className="text-xs text-muted-foreground tabular-nums">
                  {formatPercent(disponibilidadPct)} del patrimonio
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métricas de decisión */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Metric
          icon={ChartLineUp}
          label="Crecimiento mensual"
          valor={crecimientoMensualPct == null ? "—" : formatPercent(crecimientoMensualPct)}
          tone={crecimientoMensualPct != null && crecimientoMensualPct >= 0 ? "pos" : "neg"}
        />
        <Metric
          icon={Equals}
          label="Variación promedio"
          valor={variacionPromedioBob == null ? "—" : formatBobCompact(variacionPromedioBob)}
          tone={variacionPromedioBob != null && variacionPromedioBob >= 0 ? "pos" : "neg"}
        />
        <Metric
          icon={ArrowUpRight}
          label="Mejor período"
          valor={mejorPeriodo ? formatBobCompact(mejorPeriodo.monto) : "—"}
          hint={mejorPeriodo ? formatDate(mejorPeriodo.fecha) : undefined}
          tone="pos"
        />
        <Metric
          icon={ArrowDownRight}
          label="Peor período"
          valor={peorPeriodo ? formatBobCompact(peorPeriodo.monto) : "—"}
          hint={peorPeriodo ? formatDate(peorPeriodo.fecha) : undefined}
          tone={peorPeriodo && peorPeriodo.monto < 0 ? "neg" : "neutral"}
        />
        <Metric
          icon={Wallet}
          label="Promedio histórico"
          valor={formatBobCompact(promedioBob)}
          tone="neutral"
        />
        <Metric
          icon={CalendarBlank}
          label="Días desde última"
          valor={diasDesdeUltima == null ? "—" : `${diasDesdeUltima} d`}
          hint={`${resumen.snapshots.length} fotos`}
          tone={diasDesdeUltima != null && diasDesdeUltima > 30 ? "neg" : "neutral"}
        />
      </section>

      {/* Evolución */}
      <Card>
        <CardHeader>
          <CardTitle>Evolución del patrimonio</CardTitle>
          <CardDescription>Serie histórica del total. Cambia entre BOB y USD.</CardDescription>
        </CardHeader>
        <CardContent>
          <EvolucionChart serie={resumen.serie} />
        </CardContent>
      </Card>

      {/* Crecimiento por cuenta (timeline) */}
      <Card>
        <CardHeader>
          <CardTitle>Crecimiento por cuenta</CardTitle>
          <CardDescription>
            Valor en BOB de cada cuenta a lo largo del tiempo. Toca una cuenta en la leyenda para
            aislarla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CrecimientoCuentasChart cuentas={serieCuentas.cuentas} puntos={serieCuentas.puntos} />
        </CardContent>
      </Card>

      {/* Variación + Distribución por moneda */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Variación por período</CardTitle>
            <CardDescription>Cuánto cambió entre fotos consecutivas.</CardDescription>
          </CardHeader>
          <CardContent>
            <VariacionChart serie={resumen.serie} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución por moneda</CardTitle>
            <CardDescription>Valor en BOB de cada moneda (última foto).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {distribucionMoneda &&
              (["BOB", "USD", "USDT"] as const).map((m, i) => {
                const val = distribucionMoneda[m];
                const pct = totalMoneda ? val / totalMoneda : 0;
                return (
                  <div key={m}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{m}</span>
                      <span className="min-w-0 truncate tabular-nums">
                        {formatBob(val)}{" "}
                        <span className="text-muted-foreground">({formatNumber(pct * 100, 1)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(pct * 100, 0)}%`, background: `var(--color-chart-${i + 1})` }}
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>

      {/* Distribución por cuenta */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución por cuenta</CardTitle>
          <CardDescription>Dónde está tu patrimonio ahora mismo (última foto).</CardDescription>
        </CardHeader>
        <CardContent>
          <DistribucionCuentasChart cuentas={distribucionCuentas} />
        </CardContent>
      </Card>
    </>
  );
}

function DeltaPill({
  valor,
  pct,
  label,
}: {
  valor: number | null;
  pct: number | null;
  label: string;
}) {
  if (valor == null) return <span className="text-muted-foreground">Sin comparación</span>;
  const sube = valor >= 0;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tabular-nums " +
        (sube ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")
      }
    >
      {sube ? <ArrowUpRight weight="bold" className="size-3.5" /> : <ArrowDownRight weight="bold" className="size-3.5" />}
      {formatBobCompact(Math.abs(valor))}
      {pct != null && <span className="opacity-80">({formatPercent(pct)})</span>}
      <span className="font-normal opacity-70">{label}</span>
    </span>
  );
}

function Kpi({
  label,
  valor,
  valorFull,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  valor: string;
  valorFull?: string;
  sub: string;
  color: "pos" | "neg" | "neutral";
  icon: React.ComponentType<{ className?: string; weight?: "duotone" }>;
}) {
  const texto = color === "pos" ? "text-primary" : color === "neg" ? "text-destructive" : "text-foreground";
  const chip =
    color === "pos"
      ? "bg-primary/15 text-primary"
      : color === "neg"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          <span className={"flex size-8 shrink-0 items-center justify-center rounded-lg " + chip}>
            <Icon weight="duotone" className="size-4" />
          </span>
        </div>
        <CardTitle className={"truncate text-2xl tabular-nums " + texto} title={valorFull}>
          {valor}
        </CardTitle>
      </CardHeader>
      <CardContent className="truncate text-sm text-muted-foreground">{sub}</CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  valor,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; weight?: "duotone" }>;
  label: string;
  valor: string;
  hint?: string;
  tone: "pos" | "neg" | "neutral";
}) {
  const texto = tone === "pos" ? "text-primary" : tone === "neg" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon weight="duotone" className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={"mt-1 truncate text-lg font-semibold tabular-nums " + texto}>{valor}</div>
      {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
