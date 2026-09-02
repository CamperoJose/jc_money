import { createClient } from "@/lib/supabase/server";
import { getResumenDpf } from "@/lib/queries/dpf";
import type { ResumenDpf } from "@/lib/dpf";
import { Card, CardContent } from "@/components/ui/card";
import { DpfDashboard } from "@/components/dpf/dpf-dashboard";

export const dynamic = "force-dynamic";

export default async function DpfDashboardPage() {
  const supabase = await createClient();

  let resumen: ResumenDpf | null = null;
  let errorMsg: string | null = null;
  try {
    resumen = await getResumenDpf(supabase);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg || !resumen) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudieron leer los DPF.</p>
          <p className="mt-1 text-muted-foreground">
            Verifica que aplicaste las migraciones en Supabase (la tabla <code>dpf_deposits</code> existe desde
            0001). Detalle: {errorMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <DpfDashboard resumen={resumen} />;
}
