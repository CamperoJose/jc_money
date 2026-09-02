import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryKind } from "@/lib/types";

// --- Categorías --------------------------------------------------------------

const KINDS: CategoryKind[] = ["gasto", "ingreso", "inversion"];

export async function crearCategoria(
  supabase: SupabaseClient,
  name: string,
  kind: CategoryKind
): Promise<string> {
  const limpio = name.trim();
  if (!limpio) throw new Error("El nombre es obligatorio.");
  if (!KINDS.includes(kind)) throw new Error("Tipo de categoría inválido.");
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: limpio, kind })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function actualizarCategoria(
  supabase: SupabaseClient,
  id: string,
  campos: { name?: string; active?: boolean }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (campos.name !== undefined) {
    const limpio = campos.name.trim();
    if (!limpio) throw new Error("El nombre es obligatorio.");
    patch.name = limpio;
  }
  if (campos.active !== undefined) patch.active = campos.active;
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

export async function borrarCategoria(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}
