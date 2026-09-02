import { createClient } from "@/lib/supabase/server";
import { getExchangeRates, getTcConfig } from "@/lib/queries/tc";
import { Card, CardContent } from "@/components/ui/card";
import { TcClient } from "@/components/tc/tc-client";
import type { ExchangeRate, TcConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TipoCambioPage() {
  const supabase = await createClient();

  let rates: ExchangeRate[] = [];
  let config: TcConfig = { cod_indicador: 1, cod_moneda: 35 };
  let errorMsg: string | null = null;
  try {
    config = await getTcConfig(supabase);
    rates = await getExchangeRates(supabase, config.cod_moneda);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudo leer el tipo de cambio.</p>
          <p className="mt-1 text-muted-foreground">
            Verifica que aplicaste la migración 0008 en Supabase. Detalle: {errorMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <TcClient rates={rates} config={config} />;
}
