import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiRequest } from "@/lib/types";

const CAMPOS =
  "id, created_at, processed_at, origen, status, transcripcion, n_gastos, n_deudas, resumen, error, correo_ok";

/** Histórico de solicitudes de registro por voz (auditoría), recientes primero. */
export async function getSolicitudesIA(supabase: SupabaseClient, limit = 100): Promise<AiRequest[]> {
  const { data, error } = await supabase
    .from("ai_requests")
    .select(CAMPOS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AiRequest[];
}

/** Token de ingesta (Shortcut iOS) del usuario; lo crea si no existe. */
export async function getIngestToken(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.from("api_ingest_tokens").select("token").limit(1);
  if (error) throw error;
  return (data?.[0] as { token: string } | undefined)?.token ?? null;
}
