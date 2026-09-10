import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/queries/gastos";
import { getCuentas } from "@/lib/queries/patrimonio";
import { getTcConfig } from "@/lib/queries/tc";
import { Card, CardContent } from "@/components/ui/card";
import { ParametrosClient } from "@/components/configuracion/parametros-client";
import { CuentasPanel } from "@/components/configuracion/cuentas-panel";
import type { Category, TcConfig, Account } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ParametrosPage() {
  const supabase = await createClient();
  let categorias: Category[] = [];
  let cuentas: Account[] = [];
  let tcConfig: TcConfig = { cod_indicador: 1, cod_moneda: 12 };
  let errorMsg: string | null = null;
  try {
    [categorias, cuentas, tcConfig] = await Promise.all([getCategorias(supabase), getCuentas(supabase), getTcConfig(supabase)]);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }
  if (errorMsg) return <Card><CardContent className="pt-6 text-sm"><p className="font-medium text-destructive">No se pudieron leer los parámetros.</p><p className="mt-1 text-muted-foreground">Detalle: {errorMsg}</p></CardContent></Card>;
  return <div className="space-y-6"><CuentasPanel cuentas={cuentas} /><ParametrosClient categorias={categorias} tcConfig={tcConfig} /></div>;
}
