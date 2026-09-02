import { createClient } from "@/lib/supabase/server";
import { getResumenDeudas } from "@/lib/queries/deudas";
import type { ResumenDeudas } from "@/lib/deudas";
import { Card, CardContent } from "@/components/ui/card";
import { DeudasClient } from "@/components/deudas/deudas-client";

export const dynamic = "force-dynamic";

export default async function DeudasPage() {
  const supabase = await createClient();

  let resumen: ResumenDeudas | null = null;
  let errorMsg: string | null = null;
  try {
    resumen = await getResumenDeudas(supabase);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg || !resumen) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudieron leer las deudas.</p>
          <p className="mt-1 text-muted-foreground">
            Verifica que aplicaste la migración 0011 en Supabase. Detalle: {errorMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <DeudasClient resumen={resumen} />;
}
