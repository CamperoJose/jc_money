import type { Currency } from "@/lib/types";

export interface GastoVoz {
  descripcion: string;
  monto: number | null;
  moneda: Currency;
  cuenta_id: string | null;
  categoria_id: string | null;
}

export interface IngresoVoz {
  descripcion: string;
  monto: number | null;
  moneda: Currency;
  cuenta_id: string | null;
  categoria_id: string | null;
}

export interface DeudaVoz {
  quien: string | null;
  monto: number | null;
  moneda: Currency;
  motivo: string | null;
}

export interface ResultadoVoz {
  gastos: GastoVoz[];
  ingresos: IngresoVoz[];
  deudas: DeudaVoz[];
  transcripcion: string | null;
}
