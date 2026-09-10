import type { Currency } from "@/lib/types";

/** Un gasto detectado en el audio (monto puede faltar si no se dijo). */
export interface GastoVoz {
  descripcion: string;
  monto: number | null;
  moneda: Currency;
  cuenta_id: string | null;
  categoria_id: string | null;
}

/** Una deuda (que me deben) detectada en el audio. */
export interface DeudaVoz {
  quien: string | null;
  monto: number | null;
  moneda: Currency;
  motivo: string | null;
}

/** Resultado estructurado de interpretar un comando por voz. */
export interface ResultadoVoz {
  gastos: GastoVoz[];
  deudas: DeudaVoz[];
  transcripcion: string | null;
}
