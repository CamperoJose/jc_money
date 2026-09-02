import Link from "next/link";
import { TrendUp, TrendDown, Trophy, ListBullets, Wallet } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { getResumen, type ResumenPatrimonio } from "@/lib/queries/patrimonio";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  EvolucionChart,
  VariacionChart,
  DistribucionCuentasChart,
} from "@/components/patrimonio/dashboard-charts";
import { formatBob, formatUsd, formatNumber, formatDate, formatPercent } from "@/lib/format";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Patrimonio</h1>
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
    distribucionMoneda,
    distribucionCuentas,
  } = resumen;
  const sube = (variacionBob ?? 0) >= 0;
  const subeTotal = (variacionTotalBob ?? 0) >= 0;

  const totalMoneda = distribucionMoneda
    ? distribucionMoneda.BOB + distribucionMoneda.USD + distribucionMoneda.USDT
    : 0;

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-primary/0 sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardDescription className="font-medium text-primary/80">Patrimonio neto</CardDescription>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Wallet weight="fill" className="size-4" />
              </span>
            </div>
            <CardTitle className="text-3xl text-primary tabular-nums">{formatBob(ultimo?.total_bob)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {formatUsd(ultimo?.total_usd)} · al {formatDate(ultimo?.snapshot_date)}
          </CardContent>
        </Card>

        <Kpi
          label="Variación vs. anterior"
          valor={variacionBob == null ? "—" : formatBob(Math.abs(variacionBob))}
          sub={variacionPct == null ? "Sin comparación" : formatPercent(variacionPct)}
          color={sube ? "pos" : "neg"}
          icon={sube ? TrendUp : TrendDown}
        />

        <Kpi
          label="Crecimiento total"
          valor={variacionTotalBob == null ? "—" : formatBob(Math.abs(variacionTotalBob))}
          sub={
            variacionTotalPct == null
              ? "Desde la 1ª foto"
              : `${formatPercent(variacionTotalPct)} desde el inicio`
          }
          color={subeTotal ? "pos" : "neg"}
          icon={subeTotal ? TrendUp : TrendDown}
        />

        <Kpi
          label="Máximo histórico"
          valor={formatBob(maxBob)}
          sub={`${resumen.snapshots.length} fotos · T/C ${formatNumber(ultimo?.exchange_rate, 2)}`}
          color="neutral"
          icon={Trophy}
        />
      </div>

      {/* Evolución */}
      <Card>
        <CardHeader>
          <CardTitle>Evolución del patrimonio</CardTitle>
          <CardDescription>Serie histórica. Cambia entre BOB y USD.</CardDescription>
        </CardHeader>
        <CardContent>
          <EvolucionChart serie={resumen.serie} />
        </CardContent>
      </Card>

      {/* Variación + Distribución moneda */}
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
          <CardContent className="space-y-3">
            {distribucionMoneda &&
              (["BOB", "USD", "USDT"] as const).map((m, i) => {
                const val = distribucionMoneda[m];
                const pct = totalMoneda ? val / totalMoneda : 0;
                return (
                  <div key={m}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{m}</span>
                      <span className="tabular-nums">
                        {formatBob(val)}{" "}
                        <span className="text-muted-foreground">({formatNumber(pct * 100, 1)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(pct * 100, 0)}%`,
                          background: `var(--color-chart-${i + 1})`,
                        }}
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

function Kpi({
  label,
  valor,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  valor: string;
  sub: string;
  color: "pos" | "neg" | "neutral";
  icon: React.ComponentType<{ className?: string; weight?: "duotone" }>;
}) {
  const texto =
    color === "pos" ? "text-primary" : color === "neg" ? "text-destructive" : "text-foreground";
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
          <span className={"flex size-8 items-center justify-center rounded-lg " + chip}>
            <Icon weight="duotone" className="size-4" />
          </span>
        </div>
        <CardTitle className={"text-2xl tabular-nums " + texto}>{valor}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{sub}</CardContent>
    </Card>
  );
}
