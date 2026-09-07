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

// ---------------------------------------------------------------------------
// Decisiones de «¿toca avisar?», separadas del acceso a datos
//
// Viven aquí, puras, porque son la parte que falla en silencio: si el filtro se
// equivoca, o llega el mismo correo todos los días hasta que se deja de leer, o
// no llega nunca y nadie se entera. Mezcladas con las consultas no había forma
// de comprobarlas.
// ---------------------------------------------------------------------------

/** Nivel de aviso de una categoría: 0 = nada, 85 = en alerta, 100 = excedida. */
export type NivelPresupuesto = 0 | 85 | 100;

export function nivelDeEstado(estado: string): NivelPresupuesto {
  if (estado === "excedido") return 100;
  if (estado === "alerta") return 85;
  return 0;
}

export interface DecisionPresupuesto<T> {
  /** Las categorías que cruzaron un nivel nuevo. Vacío = no mandar correo. */
  nuevas: T[];
  /** Marcas a guardar si se manda el correo. */
  marcas: Record<string, NivelPresupuesto>;
}

/**
 * Qué categorías merecen aviso. Se avisa una vez por NIVEL: al cruzar el 85% y
 * otra vez al pasar el 100%. Bajar de nivel no borra la marca: si volvieras a
 * subir, ya avisamos de eso este mes y repetirlo sería ruido.
 */
export function decidirAvisoPresupuesto<T>(
  filas: { categoryId: string; nivel: NivelPresupuesto; dato: T }[],
  avisados: Record<string, number>
): DecisionPresupuesto<T> {
  const nuevas: T[] = [];
  const marcas: Record<string, NivelPresupuesto> = {};
  for (const [k, v] of Object.entries(avisados)) {
    if (v === 85 || v === 100) marcas[k] = v;
  }
  for (const f of filas) {
    if (f.nivel === 0) continue;
    if ((avisados[f.categoryId] ?? 0) >= f.nivel) continue;
    marcas[f.categoryId] = f.nivel;
    nuevas.push(f.dato);
  }
  return { nuevas, marcas };
}

/** Días calendario entre dos fechas 'YYYY-MM-DD' (b − a). */
function dias(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export const DIAS_ENTRE_AVISOS_DEUDA = 7;

/**
 * ¿Toca recordar las deudas vencidas? Una deuda vencida sigue vencida mañana,
 * así que se repite como mucho una vez por semana; pero si aparece una vencida
 * NUEVA se avisa el mismo día, porque eso sí es información nueva.
 */
export function decidirAvisoDeudas(
  idsVencidas: string[],
  previo: { fecha: string; ids: string[] } | null,
  hoy: string
): boolean {
  if (idsVencidas.length === 0) return false;
  if (!previo) return true;
  const hayNuevas = idsVencidas.some((id) => !previo.ids.includes(id));
  return hayNuevas || dias(previo.fecha, hoy) >= DIAS_ENTRE_AVISOS_DEUDA;
}
