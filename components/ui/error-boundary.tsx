"use client";

// Pantalla de error compartida por todos los `error.tsx` de Tracking.
// Sin esto, un fallo al renderizar mostraba la pantalla genérica de Next, en
// inglés y sin forma de reintentar — que es exactamente lo que se vio cuando
// `/tracking/patrimonio` devolvió 500 en producción.
import { useEffect } from "react";
import { ArrowClockwise, WarningOctagon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PantallaError({
  error,
  reset,
  seccion,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  seccion: string;
}) {
  useEffect(() => {
    // Queda en la consola del navegador y en los logs de la función de Vercel,
    // que es donde se busca cuando algo falla en producción.
    console.error(`[${seccion}]`, error);
  }, [error, seccion]);

  return (
    <Card className="trama-diagonal">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <WarningOctagon weight="fill" className="size-6" />
        </span>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            No se pudo cargar {seccion}
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Algo falló al preparar esta pantalla. Tus datos no se tocaron: esto
            ocurre al mostrarlos, no al guardarlos.
          </p>
        </div>

        {/* El digest es el identificador que aparece en los logs de Vercel; sin
            él no hay forma de encontrar el error concreto. */}
        {error.digest && (
          <p className="rounded-md bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
            Referencia: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>
            <ArrowClockwise weight="bold" className="size-4" />
            Reintentar
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Recargar la página
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
