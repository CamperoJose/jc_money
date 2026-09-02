import { createClient } from "@/lib/supabase/server";
import { getDpfs, getCuentasMap } from "@/lib/queries/dpf";
import { getCuentas } from "@/lib/queries/patrimonio";
import { enriquecerDpf } from "@/lib/dpf";
import { Card, CardContent } from "@/components/ui/card";
import { DpfClient } from "@/components/dpf/dpf-client";
import type { Account, DpfDepositUI } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DpfRegistrosPage() {
  const supabase = await createClient();

  let dpfs: DpfDepositUI[] = [];
  let cuentas: Account[] = [];
  let errorMsg: string | null = null;
  try {
    const [raw, cuentasMap, cuentasList] = await Promise.all([
      getDpfs(supabase),
      getCuentasMap(supabase),
      getCuentas(supabase),
    ]);
    cuentas = cuentasList;
    dpfs = raw.map((d) => enriquecerDpf(d, undefined, cuentasMap));
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudieron leer los DPF.</p>
          <p className="mt-1 text-muted-foreground">
            Verifica que aplicaste las migraciones en Supabase. Detalle: {errorMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <DpfClient dpfs={dpfs} cuentas={cuentas} />
    </div>
  );
}
