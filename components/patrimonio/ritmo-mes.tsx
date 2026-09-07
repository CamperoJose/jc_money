import { TrendUp, TrendDown } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatBob, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MesGasto } from "@/lib/analisis";

export interface RitmoMes {
  period: string;
  gastado: number;
  /** Lo que llevabas a esta misma altura, promediando meses previos. */
  esperado: number | null;
  /** Cierre estimado del mes, extrapolando el ritmo actual. */
  proyectado: number;
  /** Promedio de cierre de los meses previos completos. */
  promedioPrevio: number | null;
  diaDelMes: number;
  diasDelMes: number;
}

export function RitmoDelMes({ r }: { r: RitmoMes }) {
  const avance = r.diaDelMes / r.diasDelMes;
  const vsEsperado = r.esperado != null && r.esperado > 0 ? r.gastado / r.esperado - 1 : null;
  const sobre = vsEsperado != null && vsEsperado > 0.1;
  const bajo = vsEsperado != null && vsEsperado < -0.1;
  // Techo de la barra: lo más alto entre lo que cerrarías a este ritmo y lo que
  // sueles cerrar, para que ambas referencias entren siempre.
  const escala = Math.max(r.proyectado, r.promedioPrevio ?? 0, r.gastado, 1);

  return (
    <Card className="trama-diagonal">
      <CardHeader>
        <CardTitle>Ritmo de gasto del mes</CardTitle>
        <CardDescription>
          Día {r.diaDelMes} de {r.diasDelMes} · comparado con lo que llevabas a esta altura en los
          meses previos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Llevás gastado
            </div>
            <div className="text-3xl font-bold tabular-nums">{formatBob(r.gastado)}</div>
          </div>
          {vsEsperado != null && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold",
                sobre
                  ? "bg-destructive/10 text-destructive"
                  : bajo
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {sobre ? (
                <TrendUp weight="bold" className="size-4" />
              ) : bajo ? (
                <TrendDown weight="bold" className="size-4" />
              ) : null}
              {vsEsperado >= 0 ? "+" : ""}
              {formatPercent(vsEsperado, 0)}
              <span className="font-normal">vs. lo habitual</span>
            </div>
          )}
        </div>

        {/* Barra. Ojo con la trampa: `gastado / proyectado` SIEMPRE da el
            mismo porcentaje que el avance del mes (proyectado = gastado/día ·
            días), así que una barra así se ve idéntica gastes lo que gastes y
            no informa de nada. La escala es el techo real —lo que cerrarías a
            este ritmo, o lo que sueles cerrar—, el relleno sólido es lo que ya
            gastaste y el tramo claro lo que falta hasta el cierre estimado. */}
        <div>
          <div
            className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Llevás ${formatBob(r.gastado)} de un cierre estimado en ${formatBob(r.proyectado)}${r.promedioPrevio != null ? `; tus meses previos cerraron en ${formatBob(r.promedioPrevio)}` : ""}.`}
          >
            {/* Lo que falta hasta el cierre estimado. */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full opacity-30",
                sobre ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${pct(r.proyectado, escala)}%` }}
            />
            {/* Lo ya gastado. */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                sobre ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${pct(r.gastado, escala)}%` }}
            />
            {/* Dónde suelen cerrar tus meses. */}
            {r.promedioPrevio != null && r.promedioPrevio > 0 && (
              <div
                className="absolute top-0 h-full w-0.5 bg-foreground/70"
                style={{ left: `${pct(r.promedioPrevio, escala)}%` }}
                aria-hidden
              />
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>El mes va por el {Math.round(avance * 100)}%</span>
            <span>
              Cierre estimado: <strong className="tabular-nums">{formatBob(r.proyectado)}</strong>
              {r.promedioPrevio != null && r.promedioPrevio > 0 && (
                <> · tu habitual: <strong className="tabular-nums">{formatBob(r.promedioPrevio)}</strong></>
              )}
            </span>
          </div>
        </div>

        {r.promedioPrevio != null && (
          <p className="text-xs text-muted-foreground">
            Tus meses previos cerraron en{" "}
            <strong className="tabular-nums">{formatBob(r.promedioPrevio)}</strong> de promedio.
            {r.proyectado > r.promedioPrevio * 1.1
              ? " A este ritmo, este mes se pasa."
              : r.proyectado < r.promedioPrevio * 0.9
                ? " A este ritmo, este mes cierra por debajo."
                : " Vas en línea con lo habitual."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Porcentaje acotado a 0..100, para anchos de barra. */
function pct(valor: number, escala: number): number {
  return Math.max(0, Math.min(100, (valor / escala) * 100));
}

/**
 * Arma el ritmo del mes a partir del análisis mensual. Se compara la misma
 * ventana de días (1..hoy) contra los mismos días de los meses previos, no
 * contra el mes completo: al día 5 cualquier otra cosa da un «−90%» falso.
 */
export function calcularRitmoMes(
  porMes: MesGasto[],
  hastaHoyPorMes: { period: string; gasto: number }[],
  hoy: string
): RitmoMes | null {
  const period = hoy.slice(0, 7);
  const diaDelMes = Number(hoy.slice(8, 10));
  const diasDelMes = new Date(
    Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), 0)
  ).getUTCDate();
  const actual = porMes.find((m) => m.period === period);
  if (!actual) return null;

  const previos = porMes.filter((m) => m.period < period).slice(-3);
  const hastaHoy = new Map(hastaHoyPorMes.map((m) => [m.period, m.gasto]));
  const hastaHoyPrevios = previos
    .map((m) => hastaHoy.get(m.period))
    .filter((v): v is number => v != null);
  const esperado = hastaHoyPrevios.length >= 2
    ? Math.round((hastaHoyPrevios.reduce((a, b) => a + b, 0) / hastaHoyPrevios.length) * 100) / 100
    : null;
  const promedioPrevio = previos.length >= 2
    ? Math.round((previos.reduce((s, m) => s + m.gasto, 0) / previos.length) * 100) / 100
    : null;

  return {
    period,
    gastado: actual.gasto,
    esperado,
    proyectado: Math.round((actual.gasto / diaDelMes) * diasDelMes * 100) / 100,
    promedioPrevio,
    diaDelMes,
    diasDelMes,
  };
}
