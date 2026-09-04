// Encabezado de página con el patrón de la plantilla: título, bajada y una
// acción opcional a la derecha, seguidos de un separador.
import * as React from "react";
import { Divider } from "@/components/tremor/divider";
import { cn } from "@/lib/utils";

export function PageHeader({
  titulo,
  descripcion,
  accion,
  className,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  /** Botón o control alineado a la derecha. */
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className={cn("text-2xl font-semibold text-foreground")}>{titulo}</h1>
          {descripcion && (
            <p className="text-muted-foreground sm:text-sm/6">{descripcion}</p>
          )}
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
      <Divider />
    </div>
  );
}
