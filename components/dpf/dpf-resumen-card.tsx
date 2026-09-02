import Link from "next/link";
import { Vault, CalendarCheck, TrendUp, ArrowRight, Warning, Percent } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { formatBob, formatDate, formatPercent } from "@/lib/format";
import type { ResumenDpf } from "@/lib/dpf";

/** Resumen enriquecido de DPF para el dashboard de patrimonio. */
export function DpfResumenCard({ resumen }: { resumen: ResumenDpf }) {
  const { montoEnDpf, gananciaLiquida, tasaPromedio, dpfsActivos, dpfsVencidos, proximo } = resumen;

  const diasTxt =
    proximo == null
      ? "—"
      : proximo.diasRestantes < 0
        ? `venció hace ${Math.abs(proximo.diasRestantes)} d`
        : proximo.diasRestantes === 0
          ? "vence hoy"
          : `en ${proximo.diasRestantes} días`;

  return (
    <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/8 via-transparent to-transparent">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Vault weight="fill" className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight">Inversiones DPF</h2>
              <p className="text-xs text-muted-foreground">
                {dpfsActivos} {dpfsActivos === 1 ? "depósito activo" : "depósitos activos"}
              </p>
            </div>
          </div>
          <Link
            href="/tracking/inversiones/dpf"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver <ArrowRight weight="bold" className="size-4" />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Mini
            icon={<Vault weight="duotone" className="size-4 text-primary" />}
            label="Capital en DPF"
            valor={formatBob(montoEnDpf)}
          />
          <Mini
            icon={<TrendUp weight="duotone" className="size-4 text-primary" />}
            label="Ganancia líquida proy."
            valor={formatBob(gananciaLiquida)}
          />
          <Mini
            icon={<Percent weight="duotone" className="size-4 text-muted-foreground" />}
            label="Tasa promedio"
            valor={tasaPromedio == null ? "—" : formatPercent(tasaPromedio, 2)}
          />
        </div>

        {/* Próxima liberación */}
        {proximo && (
          <div className="mt-4 rounded-lg border bg-card/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <CalendarCheck weight="duotone" className="size-4 text-primary" />
                <span className="font-medium">Próxima liberación</span>
              </div>
              <span
                className={`text-xs font-medium tabular-nums ${
                  proximo.diasRestantes < 0 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {diasTxt}
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm">
                  {proximo.pizarra || "DPF"}
                  {proximo.id_dpf_externo ? (
                    <span className="text-muted-foreground"> · {proximo.id_dpf_externo}</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">{formatDate(proximo.end_date)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold tabular-nums text-primary">
                  {formatBob(proximo.montoAlVencimiento)}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  capital {formatBob(proximo.principal)}
                </div>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${proximo.diasRestantes < 0 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.round(proximo.progreso * 100)}%` }}
              />
            </div>
          </div>
        )}

        {dpfsVencidos > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
            <Warning weight="fill" className="size-3.5" />
            {dpfsVencidos} {dpfsVencidos === 1 ? "DPF vencido" : "DPF vencidos"} sin marcar como cobrado.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="rounded-lg border bg-card/70 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-lg font-bold tabular-nums">{valor}</div>
    </div>
  );
}
