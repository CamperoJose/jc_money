import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/queries/gastos";
import { getTcConfig } from "@/lib/queries/tc";
import { Card, CardContent } from "@/components/ui/card";
import { ParametrosClient } from "@/components/configuracion/parametros-client";
import type { Category, TcConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ParametrosPage() {
  const supabase = await createClient();

  let categorias: Category[] = [];
  let tcConfig: TcConfig = { cod_indicador: 1, cod_moneda: 12 };
  let errorMsg: string | null = null;
  try {
    [categorias, tcConfig] = await Promise.all([getCategorias(supabase), getTcConfig(supabase)]);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudieron leer los parámetros.</p>
          <p className="mt-1 text-muted-foreground">
            Verifica que aplicaste las migraciones 0004 y 0005 en Supabase. Detalle: {errorMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <ParametrosClient categorias={categorias} tcConfig={tcConfig} />;
}
