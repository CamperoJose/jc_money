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
import {
  calcularEstadoPatrimonio,
  disponibilidadDe,
  distribucionMonedaDe,
  type EstadoPatrimonio,
} from "@/lib/patrimonio/estado";
import { fechaBoliviaHoy } from "@/lib/datetime";
import { EstadoEnVivo } from "@/components/patrimonio/estado-en-vivo";
import { getResumen, type ResumenPatrimonio } from "@/lib/queries/patrimonio";
import { getResumenDpf } from "@/lib/queries/dpf";
import { getResumenDeudas } from "@/lib/queries/deudas";
import { getTransacciones } from "@/lib/queries/gastos";
import { analizarGastos, type AnalisisGastos } from "@/lib/analisis";
import { construirAgenda, resumirAgenda } from "@/lib/agenda";
import { Agenda } from "@/components/patrimonio/agenda";
import { RitmoDelMes, calcularRitmoMes } from "@/components/patrimonio/ritmo-mes";
import type { ResumenDpf } from "@/lib/dpf";
import { DpfResumenCard } from "@/components/dpf/dpf-resumen-card";
import { CategoryBar } from "@/components/tremor/category-bar";
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
  formatNumber,
  formatDate,
  formatPercent,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PatrimonioDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Las tres consultas en paralelo (menor tiempo de carga del dashboard).
  // `calcularEstadoPatrimonio` es el MISMO cálculo que hace el cierre de
  // medianoche, aplicado a hoy: así el número que ves ahora es exactamente el
  // que el job guardará esta noche.
  const hoy = fechaBoliviaHoy();
  const [resPatrimonio, resDpf, resEstado, resTxs, resDeudas] = await Promise.allSettled([
    getResumen(supabase),
    getResumenDpf(supabase),
    user ? calcularEstadoPatrimonio(supabase, user.id, hoy) : Promise.resolve(null),
    getTransacciones(supabase),
    getResumenDeudas(supabase),
  ]);

  let resumen: ResumenPatrimonio | null = null;
  let errorMsg: string | null = null;
  if (resPatrimonio.status === "fulfilled") {
    resumen = resPatrimonio.value;
  } else {
    errorMsg =
      resPatrimonio.reason instanceof Error ? resPatrimonio.reason.message : "Error al leer los datos.";
  }

  // DPF: tolerante a que la tabla/migración aún no exista (no rompe el dashboard).
  const resumenDpf: ResumenDpf | null = resDpf.status === "fulfilled" ? resDpf.value : null;
  // El estado en vivo es un extra: si falla, el dashboard sigue mostrando la
  // última foto como siempre.
  const estado: EstadoPatrimonio | null =
    resEstado.status === "fulfilled" ? resEstado.value : null;
  // Si el cálculo en vivo falla, se muestra la última foto — pero se dice, para
  // que nadie tome por actual una cifra que puede tener horas.
  const estadoFallo = resEstado.status === "rejected";

  // Gastos y deudas son extras del dashboard: si alguno falla, el patrimonio
  // —que es la razón de ser de esta pantalla— sale igual.
  const analisis: AnalisisGastos | null =
    resTxs.status === "fulfilled" ? analizarGastos(resTxs.value, hoy) : null;
  const deudas = resDeudas.status === "fulfilled" ? resDeudas.value.deudas : null;

  const eventos = construirAgenda(hoy, {
    dpfs: resumenDpf?.dpfs ?? null,
    deudas,
    recurrentes: analisis?.recurrentes ?? null,
  });
  const resumenEventos = resumirAgenda(eventos);
  const ritmo = analisis?.suficienteData
    ? calcularRitmoMes(analisis.porMes, analisis.hastaHoyPorMes, hoy)
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Patrimonio</h1>
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
          <Contenido resumen={resumen} estado={estado} estadoFallo={estadoFallo} />
        ))}

      {/* Lo que se viene y el ritmo del mes: no dependen de que haya fotos de
          patrimonio, así que van fuera del bloque de arriba. */}
      {ritmo && <RitmoDelMes r={ritmo} />}
      {eventos.length > 0 && <Agenda eventos={eventos} resumen={resumenEventos} />}

      {resumenDpf && resumenDpf.totalHistorico > 0 && <DpfResumenCard resumen={resumenDpf} />}
    </div>
  );
}

function Contenido({
  resumen,
  estado,
  estadoFallo,
}: {
  resumen: ResumenPatrimonio;
  estado: EstadoPatrimonio | null;
  estadoFallo: boolean;
}) {
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
  const subeTotal = (variacionTotalBob ?? 0) >= 0;

  // Disponibilidad y distribución también en vivo: si el bloque de arriba
  // muestra el patrimonio de ahora, estas tarjetas no pueden mostrar el de la
  // última foto — se leerían como una contradicción.
  const disponible = estado ? disponibilidadDe(estado) : disponibilidadRapida;
  const disponiblePct = estado
    ? estado.totalBob > 0
      ? disponibilidadDe(estado) / estado.totalBob
      : null
    : disponibilidadPct;
  const monedas = estado ? distribucionMonedaDe(estado) : distribucionMoneda;

  const totalMoneda = monedas ? monedas.BOB + monedas.USD + monedas.USDT : 0;

  // El máximo histórico sale de las fotos. Si el valor en vivo ya lo superó, la
  // tarjeta mostraría un "máximo" MENOR que la cifra grande de arriba, que se
  // lee como un error. Se incluye el valor de ahora en la comparación.
  const maxConHoy = estado && maxBob != null ? Math.max(maxBob, estado.totalBob) : maxBob;
  const recordHoy = estado != null && maxBob != null && estado.totalBob > maxBob;

  return (
    <>
      {/* Hero + KPIs */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Patrimonio neto (hero) */}
        <Card className="trama-rejilla resplandor lg:col-span-2">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                Patrimonio neto
              </span>
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary bg-gradient-to-br from-white/25 to-transparent text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15">
                <Wallet weight="fill" className="size-5" />
              </span>
            </div>
            <div className="min-w-0">
              {/* La cifra grande es el patrimonio AHORA: la última foto más todo
                  lo registrado después. Si el cálculo en vivo no está
                  disponible, se muestra la última foto, como antes. */}
              <div className="break-words text-[clamp(1.75rem,1.2rem+1.8vw,2.25rem)] font-bold leading-tight text-primary tabular-nums">
                {formatBob(estado ? estado.totalBob : ultimo?.total_bob)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground tabular-nums">
                {formatUsd(estado ? estado.totalUsd : ultimo?.total_usd)} · T/C{" "}
                {formatNumber(estado ? estado.rate : ultimo?.exchange_rate, 2)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* El delta compara contra la foto ANTERIOR a la base, no
                    contra el valor en vivo: la etiqueta lo dice para que no se
                    lea como la variación de la cifra grande. */}
                <DeltaPill valor={variacionBob} pct={variacionPct} label="entre las dos últimas fotos" />
                <span className="text-muted-foreground">
                  última foto: {formatDate(ultimo?.snapshot_date)}
                </span>
              </div>
              {estadoFallo && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  No se pudo calcular el valor de ahora. Se muestra la última foto, que puede
                  no incluir lo registrado hoy.
                </p>
              )}
              {estado && (
                <EstadoEnVivo
                  baseTotalBob={estado.baseTotalBob}
                  totalBob={estado.totalBob}
                  baseFecha={estado.base.snapshot_at}
                  baseTipo={estado.base.kind}
                  movimientos={estado.cantidadMovimientosDia}
                  ajusteDerivadas={estado.ajusteDerivadas}
                  ajusteMovimientos={estado.ajusteMovimientos}
                />
              )}
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
          valor={formatBobCompact(maxConHoy)}
          valorFull={formatBob(maxConHoy)}
          sub={recordHoy ? "¡Récord! Es tu valor de ahora" : `Mínimo ${formatBobCompact(minBob)}`}
          color={recordHoy ? "pos" : "neutral"}
          icon={Trophy}
        />
      </section>

      {/* Disponibilidad rápida (dinero líquido) */}
      {disponible != null && (
        <Card className="trama-diagonal">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary bg-gradient-to-br from-white/25 to-transparent text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15">
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
              <div className="break-words text-[clamp(1.375rem,1.05rem+1.1vw,1.75rem)] font-bold leading-tight text-primary tabular-nums">{formatBob(disponible)}</div>
              {disponiblePct != null && (
                <div className="text-xs text-muted-foreground tabular-nums">
                  {formatPercent(disponiblePct)} del patrimonio
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métricas de decisión */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
          <CardContent className="space-y-5">
            {monedas && (
              <>
                <CategoryBar
                  segmentos={(["BOB", "USD", "USDT"] as const).map((m, i) => ({
                    etiqueta: m,
                    valor: monedas[m],
                    color: `var(--color-chart-${i + 1})`,
                  }))}
                  formato="bob"
                />
                {/* Detalle con participación de cada moneda */}
                <div className="space-y-1.5 border-t pt-3">
                  {(["BOB", "USD", "USDT"] as const).map((m, i) => {
                    const val = monedas[m];
                    const pct = totalMoneda ? val / totalMoneda : 0;
                    return (
                      <div key={m} className="flex items-center gap-2 text-sm">
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ background: `var(--color-chart-${i + 1})` }}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{m}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {formatNumber(pct * 100, 1)}%
                        </span>
                        <span className="shrink-0 text-right font-semibold tabular-nums">
                          {formatBob(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
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
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-medium text-foreground">{label}</span>
          <span className={"flex size-8 shrink-0 items-center justify-center rounded-lg " + chip}>
            <Icon weight="duotone" className="size-4" />
          </span>
        </div>
        <div className={"mt-1 break-words text-[clamp(1.375rem,1.05rem+1.1vw,1.875rem)] font-semibold leading-tight tabular-nums " + texto} title={valorFull}>
          {valor}
        </div>
        <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{sub}</div>
      </CardContent>
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
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Icon weight="duotone" className="mt-px size-3.5 shrink-0" />
        <span className="line-clamp-2">{label}</span>
      </div>
      <div className={"mt-1 break-words text-lg font-semibold leading-tight tabular-nums " + texto} title={valor}>{valor}</div>
      {hint && <div className="line-clamp-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
