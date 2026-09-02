import { createClient } from "@/lib/supabase/server";
import { getResumenActivos } from "@/lib/queries/activos";
import { getCuentas } from "@/lib/queries/patrimonio";
import type { ResumenActivos } from "@/lib/activos";
import type { Account } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ActivosClient } from "@/components/activos/activos-client";

export const dynamic = "force-dynamic";

export default async function ActivosPage() {
  const supabase = await createClient();

  let resumen: ResumenActivos | null = null;
  let cuentas: Account[] = [];
  let errorMsg: string | null = null;
  try {
    resumen = await getResumenActivos(supabase);
    cuentas = await getCuentas(supabase);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg || !resumen) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudieron leer los activos.</p>
          <p className="mt-1 text-muted-foreground">
            Verifica que aplicaste la migración 0012 en Supabase. Detalle: {errorMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <ActivosClient resumen={resumen} cuentas={cuentas} />;
}
