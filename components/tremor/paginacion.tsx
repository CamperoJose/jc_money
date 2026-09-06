"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/** Controles de paginación. Se ocultan solos si todo cabe en una página. */
export function Paginacion({
  indice,
  paginas,
  irA,
  desde,
  hasta,
  total,
  etiqueta = "registros",
}: {
  indice: number;
  paginas: number;
  irA: (n: number) => void;
  desde: number;
  hasta: number;
  total: number;
  etiqueta?: string;
}) {
  if (paginas <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-sm">
      <span className="text-muted-foreground tabular-nums">
        {desde + 1}–{hasta} de {total} {etiqueta}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => irA(indice - 1)}
          disabled={indice === 0}
          aria-label="Página anterior"
        >
          <CaretLeft weight="bold" className="size-4" />
        </Button>
        <span className="px-2 text-muted-foreground tabular-nums">
          {indice + 1} / {paginas}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => irA(indice + 1)}
          disabled={indice >= paginas - 1}
          aria-label="Página siguiente"
        >
          <CaretRight weight="bold" className="size-4" />
        </Button>
      </div>
    </div>
  );
}
