import { createClient } from "@/lib/supabase/server";
import { getResumen } from "@/lib/queries/patrimonio";
import { analizarTendencia } from "@/lib/tendencias";
import { Card, CardContent } from "@/components/ui/card";
import { TendenciasClient } from "@/components/tendencias/tendencias-client";

export const dynamic = "force-dynamic";

export default async function TendenciasPage() {
  const supabase = await createClient();

  let serie: { fecha: string; bob: number }[] = [];
  let errorMsg: string | null = null;
  try {
    const resumen = await getResumen(supabase);
    serie = resumen.serie.map((p) => ({ fecha: p.fecha, bob: p.bob }));
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudieron leer los datos.</p>
          <p className="mt-1 text-muted-foreground">Detalle: {errorMsg}</p>
        </CardContent>
      </Card>
    );
  }

  return <TendenciasClient t={analizarTendencia(serie)} />;
}
