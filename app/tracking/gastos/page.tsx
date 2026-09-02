import { createClient } from "@/lib/supabase/server";
import { getResumenGastos, type ResumenGastos } from "@/lib/queries/gastos";
import { Card, CardContent } from "@/components/ui/card";
import { GastosDashboard } from "@/components/gastos/gastos-dashboard";

export const dynamic = "force-dynamic";

export default async function GastosDashboardPage() {
  const supabase = await createClient();

  let resumen: ResumenGastos | null = null;
  let errorMsg: string | null = null;
  try {
    resumen = await getResumenGastos(supabase);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg || !resumen) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudieron leer los gastos.</p>
          <p className="mt-1 text-muted-foreground">
            Verifica que aplicaste las migraciones 0004 y 0005 en Supabase. Detalle: {errorMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <GastosDashboard resumen={resumen} />;
}
