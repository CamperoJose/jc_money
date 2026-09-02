import { createClient } from "@/lib/supabase/server";
import { getResumenPresupuestos } from "@/lib/queries/presupuestos";
import type { ResumenPresupuestos } from "@/lib/presupuestos";
import { Card, CardContent } from "@/components/ui/card";
import { PresupuestosClient } from "@/components/presupuestos/presupuestos-client";

export const dynamic = "force-dynamic";

export default async function PresupuestosPage() {
  const supabase = await createClient();

  let resumen: ResumenPresupuestos | null = null;
  let errorMsg: string | null = null;
  try {
    resumen = await getResumenPresupuestos(supabase);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg || !resumen) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudieron leer los presupuestos.</p>
          <p className="mt-1 text-muted-foreground">Detalle: {errorMsg}</p>
        </CardContent>
      </Card>
    );
  }

  return <PresupuestosClient resumen={resumen} />;
}
