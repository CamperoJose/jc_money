import {
  Bank,
  HandCoins,
  ArrowsClockwise,
  CalendarCheck,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatBob, formatDate } from "@/lib/format";
import type { EventoAgenda, ResumenAgenda } from "@/lib/agenda";
import { cn } from "@/lib/utils";

const ICONO = { dpf: Bank, cobro: HandCoins, recurrente: ArrowsClockwise } as const;

/** "vencía hace 3 días", "hoy", "mañana", "en 12 días". */
function cuando(e: EventoAgenda): string {
  if (e.dias < 0) return `hace ${-e.dias} día${-e.dias === 1 ? "" : "s"}`;
  if (e.dias === 0) return "hoy";
  if (e.dias === 1) return "mañana";
  return `en ${e.dias} días`;
}

export function Agenda({
  eventos,
  resumen,
}: {
  eventos: EventoAgenda[];
  resumen: ResumenAgenda;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck weight="duotone" className="size-5 text-primary" />
            Qué se viene
          </CardTitle>
          <CardDescription>
            Vencimientos, cobros y gastos que se repiten, en las próximas semanas.
          </CardDescription>
        </div>
        {eventos.length > 0 && (
          <div className="hidden shrink-0 text-right sm:block">
            <div className="text-xs text-muted-foreground">Entra / sale</div>
            <div className="text-sm font-semibold tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">+{formatBob(resumen.entra)}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="text-destructive">−{formatBob(resumen.sale)}</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay nada agendado para las próximas semanas.
          </p>
        ) : (
          <>
            {resumen.vencidos > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm">
                <Warning weight="duotone" className="size-4 shrink-0 text-destructive" />
                <span>
                  <strong>{resumen.vencidos}</strong> ya {resumen.vencidos === 1 ? "venció" : "vencieron"} y
                  {resumen.vencidos === 1 ? " sigue" : " siguen"} sin resolverse.
                </span>
              </div>
            )}
            <ul className="space-y-2">
              {eventos.slice(0, 10).map((e) => {
                const Icono = ICONO[e.tipo];
                const entra = e.monto >= 0;
                return (
                  <li
                    key={e.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                      e.vencido ? "border-destructive/30 bg-destructive/[0.05]" : "bg-card/60"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          e.vencido
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        <Icono weight="duotone" className="size-4" />
                      </span>
                      <div className="min-w-0">
                        {/* Sin `truncate`: a 320 px se cortaban nombres cortos
                            como «Banco SOL». Mejor que el título baje de línea. */}
                        <div className="text-sm font-medium leading-snug">
                          {e.titulo}
                          {e.estimado && (
                            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                              estimado
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] leading-snug text-muted-foreground">
                          {e.detalle} · {formatDate(e.fecha)}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          entra ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                        )}
                      >
                        {entra ? "+" : "−"}
                        {formatBob(Math.abs(e.monto))}
                      </div>
                      <div
                        className={cn(
                          "text-[11px] tabular-nums",
                          e.vencido ? "font-medium text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {cuando(e)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {eventos.length > 10 && (
              <p className="pt-2 text-center text-[11px] text-muted-foreground">
                y {eventos.length - 10} más
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
