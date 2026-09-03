import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSolicitudesIA, getIngestToken } from "@/lib/queries/asistente";
import type { AiRequest } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { AsistenteClient } from "@/components/asistente/asistente-client";

export const dynamic = "force-dynamic";

export default async function AsistentePage() {
  const supabase = await createClient();

  let solicitudes: AiRequest[] = [];
  let token: string | null = null;
  let errorMsg: string | null = null;
  try {
    [solicitudes, token] = await Promise.all([getSolicitudesIA(supabase), getIngestToken(supabase)]);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  if (errorMsg) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">No se pudo leer el asistente de voz.</p>
          <p className="mt-1 text-muted-foreground">
            Verifica que aplicaste la migración 0014 en Supabase. Detalle: {errorMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : "");

  return <AsistenteClient solicitudes={solicitudes} token={token} ingestUrl={`${baseUrl}/api/voz/ingesta`} />;
}
