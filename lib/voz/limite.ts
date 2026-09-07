// Límite de tasa para la ingesta por voz. El endpoint acepta un token portador
// (el Atajo de iOS), así que sin tope una fuga de ese token bastaría para
// quemar la capa gratuita de Gemini y llenar la app de gastos falsos.
//
// El conteo se hace sobre `ai_requests`, que ya guarda una fila por solicitud y
// tiene el índice (user_id, created_at desc): no hace falta almacenamiento
// extra ni un servicio aparte, lo que mantiene el costo cero.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Lee un entero de una variable de entorno, con default y mínimo 0. */
function entero(nombre: string, porDefecto: number): number {
  const crudo = process.env[nombre];
  if (crudo == null || crudo.trim() === "") return porDefecto;
  const n = Number(crudo);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : porDefecto;
}

export interface LimiteVoz {
  ventanaMinutos: number;
  maxPorVentana: number;
  maxPorDia: number;
}

/**
 * Configuración del límite, parametrizable por entorno:
 *   VOZ_LIMITE_VENTANA_MIN  (default 10)  ventana corta, en minutos
 *   VOZ_LIMITE_POR_VENTANA  (default 10)  solicitudes permitidas en la ventana
 *   VOZ_LIMITE_POR_DIA      (default 120) tope diario
 * Un 0 en cualquiera de los topes desactiva ESE tope.
 */
export function configLimiteVoz(): LimiteVoz {
  return {
    ventanaMinutos: Math.max(1, entero("VOZ_LIMITE_VENTANA_MIN", 10)),
    maxPorVentana: entero("VOZ_LIMITE_POR_VENTANA", 10),
    maxPorDia: entero("VOZ_LIMITE_POR_DIA", 120),
  };
}

export interface ResultadoLimite {
  permitido: boolean;
  motivo?: string;
  /** Segundos que conviene esperar antes de reintentar (cabecera Retry-After). */
  reintentarEn?: number;
}

/**
 * ¿Puede este usuario mandar otra solicitud de voz? Cuenta las filas de
 * `ai_requests` en la ventana corta y en las últimas 24 h.
 *
 * Ante un fallo al consultar se DEJA PASAR: el límite protege de un abuso, no
 * es una regla de negocio, y no queremos que un hipo de la base impida al
 * usuario registrar un gasto.
 */
export async function verificarLimiteVoz(
  admin: SupabaseClient,
  userId: string,
  cfg: LimiteVoz = configLimiteVoz()
): Promise<ResultadoLimite> {
  if (cfg.maxPorVentana === 0 && cfg.maxPorDia === 0) return { permitido: true };

  const ahora = Date.now();
  const desdeVentana = new Date(ahora - cfg.ventanaMinutos * 60_000).toISOString();
  const desdeDia = new Date(ahora - 24 * 3600_000).toISOString();

  try {
    const [ventana, dia] = await Promise.all([
      cfg.maxPorVentana > 0
        ? admin
            .from("ai_requests")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", desdeVentana)
        : Promise.resolve({ count: 0, error: null }),
      cfg.maxPorDia > 0
        ? admin
            .from("ai_requests")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", desdeDia)
        : Promise.resolve({ count: 0, error: null }),
    ]);

    if (ventana.error || dia.error) return { permitido: true };

    if (cfg.maxPorVentana > 0 && (ventana.count ?? 0) >= cfg.maxPorVentana) {
      return {
        permitido: false,
        motivo: `Demasiadas solicitudes: máximo ${cfg.maxPorVentana} cada ${cfg.ventanaMinutos} minutos.`,
        reintentarEn: cfg.ventanaMinutos * 60,
      };
    }
    if (cfg.maxPorDia > 0 && (dia.count ?? 0) >= cfg.maxPorDia) {
      return {
        permitido: false,
        motivo: `Se alcanzó el tope diario de ${cfg.maxPorDia} solicitudes.`,
        reintentarEn: 3600,
      };
    }
    return { permitido: true };
  } catch {
    return { permitido: true };
  }
}
