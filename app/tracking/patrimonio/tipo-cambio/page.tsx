import { createClient } from "@/lib/supabase/server";
import { getExchangeRates, getTcConfig } from "@/lib/queries/tc";
import { Card, CardContent } from "@/components/ui/card";
import { TcClient } from "@/components/tc/tc-client";
import { pronosticarTipoCambio, type ResultadoPronostico } from "@/lib/pronostico";
import type { ExchangeRate, TcConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TipoCambioPage() {
  const supabase = await createClient();

  let rates: ExchangeRate[] = [];
  let config: TcConfig = { cod_indicador: 1, cod_moneda: 12 };
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

  // El pronóstico se calcula aquí, en el servidor: es el cálculo más pesado de
  // la app (decenas de ajustes durante el backtest) y no hay razón para mandarlo
  // al navegador. Si algo falla, la pantalla de T/C sale igual sin él.
  let pronostico: ResultadoPronostico | null = null;
  try {
    pronostico = pronosticarTipoCambio(
      rates.map((r) => ({ fecha: r.rate_date, valor: r.valor }))
    );
  } catch {
    pronostico = null;
  }

  return <TcClient rates={rates} config={config} pronostico={pronostico} />;
}
