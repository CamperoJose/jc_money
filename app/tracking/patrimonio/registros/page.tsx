import { createClient } from "@/lib/supabase/server";
import { getSnapshots, getCuentas } from "@/lib/queries/patrimonio";
import { Card, CardContent } from "@/components/ui/card";
import { RegistrosClient } from "@/components/patrimonio/registros-client";
import type { SnapshotUI } from "@/lib/queries/patrimonio";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RegistrosPage() {
  const supabase = await createClient();

  let snapshots: SnapshotUI[] = [];
  let cuentas: Account[] = [];
  let errorMsg: string | null = null;
  try {
    [snapshots, cuentas] = await Promise.all([getSnapshots(supabase), getCuentas(supabase)]);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudieron leer los datos.</p>
          <p className="mt-1 text-muted-foreground">
            Verifica el esquema y las semillas en Supabase. Detalle: {errorMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <RegistrosClient snapshots={snapshots} cuentas={cuentas} />
    </div>
  );
}
