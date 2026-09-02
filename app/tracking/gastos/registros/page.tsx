import { createClient } from "@/lib/supabase/server";
import { getCuentas } from "@/lib/queries/patrimonio";
import { getTransacciones, getCategorias, getParticipantes } from "@/lib/queries/gastos";
import { Card, CardContent } from "@/components/ui/card";
import { GastosClient } from "@/components/gastos/gastos-client";
import type { Account, Category, Participant, TransactionUI } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GastosRegistrosPage() {
  const supabase = await createClient();

  let transacciones: TransactionUI[] = [];
  let cuentas: Account[] = [];
  let categorias: Category[] = [];
  let participantes: Participant[] = [];
  let errorMsg: string | null = null;
  try {
    [transacciones, cuentas, categorias, participantes] = await Promise.all([
      getTransacciones(supabase),
      getCuentas(supabase),
      getCategorias(supabase),
      getParticipantes(supabase),
    ]);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudieron leer los datos.</p>
          <p className="mt-1 text-muted-foreground">
            Verifica que aplicaste las migraciones 0004 y 0005 en Supabase. Detalle: {errorMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <GastosClient
        transacciones={transacciones}
        cuentas={cuentas}
        categorias={categorias}
        participantes={participantes}
      />
    </div>
  );
}
