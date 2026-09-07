// Memoria de los avisos ya enviados, para no repetir el mismo correo a diario.
//
// Se guarda en `app_settings` (clave/valor por usuario, ya existe desde la
// migración 0008): no hace falta tabla nueva y el costo sigue siendo cero. El
// valor es JSON; si está corrupto o falta, se trata como "nunca se avisó", que
// es el lado seguro: como mucho se manda un correo de más.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function leerAviso<T>(
  admin: SupabaseClient,
  userId: string,
  key: string
): Promise<T | null> {
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const crudo = (data[0] as { value: unknown }).value;
  if (crudo == null) return null;
  if (typeof crudo !== "string") return crudo as T;
  try {
    return JSON.parse(crudo) as T;
  } catch {
    return null;
  }
}

export async function guardarAviso(
  admin: SupabaseClient,
  userId: string,
  key: string,
  valor: unknown
): Promise<void> {
  await admin
    .from("app_settings")
    .upsert({ user_id: userId, key, value: JSON.stringify(valor) }, { onConflict: "user_id,key" });
}
