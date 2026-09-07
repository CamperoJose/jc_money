import { ArrowsClockwise, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { formatBob, formatDateTime, formatNumber } from "@/lib/format";

/**
 * Aviso de que el patrimonio mostrado incluye lo registrado DESPUÉS de la última
 * foto.
 *
 * Es el mismo cálculo que hará el cierre de medianoche, así que lo que se ve
 * aquí es lo que quedará guardado esta noche. Se explica de dónde sale el número
 * para que nadie tenga que adivinar por qué difiere de la última foto.
 */
export function EstadoEnVivo({
  baseTotalBob,
  totalBob,
  baseFecha,
  baseTipo,
  movimientos,
  ajusteDerivadas,
  ajusteMovimientos,
}: {
  baseTotalBob: number;
  totalBob: number;
  baseFecha: string;
  baseTipo: "manual" | "auto";
  movimientos: number;
  ajusteDerivadas: number;
  ajusteMovimientos: number;
}) {
  const delta = Math.round((totalBob - baseTotalBob) * 100) / 100;
  const alDia = delta === 0 && movimientos === 0;

  const piezas: string[] = [];
  if (movimientos > 0) {
    piezas.push(`${movimientos} ${movimientos === 1 ? "movimiento" : "movimientos"}`);
  }
  if (ajusteDerivadas !== 0) piezas.push("cambios en DPF, activos o por cobrar");
  if (ajusteMovimientos !== 0) piezas.push("ventas o cobros");

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {alDia ? (
        <Badge variant="neutral" className="gap-1">
          <CheckCircle weight="fill" className="size-3.5" />
          Al día
        </Badge>
      ) : (
        <Badge variant="default" className="gap-1">
          <ArrowsClockwise weight="fill" className="size-3.5" />
          En vivo
        </Badge>
      )}
      <span className="text-muted-foreground">
        {alDia ? (
          <>Sin cambios desde la última foto ({baseTipo === "auto" ? "cierre" : "manual"} del {formatDateTime(baseFecha)}).</>
        ) : (
          <>
            Última foto {formatBob(baseTotalBob)}{" "}
            <span className={delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
              {delta >= 0 ? "+" : "−"}
              {formatNumber(Math.abs(delta), 2)} Bs
            </span>
            {piezas.length > 0 ? ` por ${piezas.join(" y ")}` : ""}. Se guardará en el cierre de esta
            noche.
          </>
        )}
      </span>
    </div>
  );
}
