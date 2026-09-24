export const DOLAR_BLUE_BOLIVIA_BUYERS_ENDPOINT =
  "https://api.dolarbluebolivia.click/private/v1/p2p/binance/buyers";

export const BINANCE_P2P_SOURCE = "binance_p2p_median";

export interface BinanceP2POrder {
  rank?: number;
  rate: number;
  name?: string;
  platform?: string;
  side?: string;
  available_usdt?: number;
  min_bob?: number;
  max_bob?: number;
  completed_orders?: number;
  completion_rate?: number;
  payment_methods?: string[];
}

export interface DolarBlueBoliviaResponse {
  data?: {
    source?: string;
    pair?: string;
    side?: string;
    orders?: BinanceP2POrder[];
    count?: number;
    fetched_at?: string;
  };
  cached?: boolean;
  fetched_at?: string;
  updated_at?: string;
  cache_key?: string;
}

export interface ResultadoBinanceP2P {
  valor: number;
  rates: number[];
  ordersValidas: number;
  ordersRecibidas: number;
  pair: string;
  side: string;
  cached: boolean;
  fetchedAt: string | null;
}

export function mediana(valores: number[]): number {
  if (!valores.length) throw new Error("No hay valores para calcular la mediana.");
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[mitad]
    : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
}

export function calcularTcBinanceP2P(orders: BinanceP2POrder[]): {
  valor: number;
  rates: number[];
} {
  const rates = orders
    .map((o) => Number(o.rate))
    .filter((rate) => Number.isFinite(rate) && rate > 0);

  if (rates.length < 3) {
    throw new Error(
      `Respuesta P2P insuficiente: se requieren al menos 3 cotizaciones válidas y llegaron ${rates.length}.`
    );
  }

  // La mediana evita que una orden aislada, con mucha liquidez o un precio
  // anómalo, arrastre el T/C diario. No ponderamos por available_usdt porque
  // una sola orden grande podría dominar artificialmente el valor del día.
  return {
    valor: Math.round(mediana(rates) * 100000) / 100000,
    rates,
  };
}

export async function obtenerTipoCambioBinanceP2P(
  fetchImpl: typeof fetch = fetch
): Promise<ResultadoBinanceP2P> {
  const apiKey = process.env.DOLAR_BLUE_BOLIVIA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta DOLAR_BLUE_BOLIVIA_API_KEY en las variables de entorno del servidor."
    );
  }

  const response = await fetchImpl(DOLAR_BLUE_BOLIVIA_BUYERS_ENDPOINT, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detalle = await response.text().catch(() => "");
    throw new Error(
      `Dólar Blue Bolivia respondió HTTP ${response.status}${detalle ? `: ${detalle.slice(0, 300)}` : ""}.`
    );
  }

  const payload = (await response.json()) as DolarBlueBoliviaResponse;
  const orders = payload.data?.orders;

  if (!Array.isArray(orders)) {
    throw new Error("Respuesta inválida de Dólar Blue Bolivia: data.orders no es un arreglo.");
  }

  const pair = payload.data?.pair ?? "";
  const side = payload.data?.side ?? "";
  if (pair && pair !== "BOB/USDT") {
    throw new Error(`Par P2P inesperado: ${pair}.`);
  }
  if (side && side !== "buy") {
    throw new Error(`Lado P2P inesperado: ${side}.`);
  }

  const calculo = calcularTcBinanceP2P(orders);

  return {
    valor: calculo.valor,
    rates: calculo.rates,
    ordersValidas: calculo.rates.length,
    ordersRecibidas: orders.length,
    pair: pair || "BOB/USDT",
    side: side || "buy",
    cached: Boolean(payload.cached),
    fetchedAt: payload.data?.fetched_at ?? payload.fetched_at ?? null,
  };
}
