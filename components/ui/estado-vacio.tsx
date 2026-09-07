import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Estado vacío con su acción a mano.
 *
 * Los estados vacíos decían "créalo con «Nuevo registro»", nombrando un botón
 * que en móvil queda fuera de la pantalla. El momento en que alguien ve una
 * lista vacía es justo cuando más intención tiene de crear algo: el botón va
 * aquí.
 */
export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono?: React.ReactNode;
  titulo: string;
  descripcion?: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <Card className="trama-diagonal">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        {icono && (
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {icono}
          </span>
        )}
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{titulo}</p>
          {descripcion && (
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">{descripcion}</p>
          )}
        </div>
        {accion}
      </CardContent>
    </Card>
  );
}
