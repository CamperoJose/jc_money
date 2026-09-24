import { calcularTcBinanceP2P, mediana } from "../lib/dolar-blue-bolivia.ts";

function assertEqual(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${label}: esperado ${expected}, recibido ${actual}`);
  }
}

assertEqual(mediana([3, 1, 2]), 2, "mediana impar");
assertEqual(mediana([4, 1, 3, 2]), 2.5, "mediana par");

const sampleRates = [
  12.32,
  12.32,
  12.33,
  12.33,
  12.33,
  12.33,
  12.33,
  12.33,
  12.33,
  12.34,
];

const sample = calcularTcBinanceP2P(
  sampleRates.map((rate, index) => ({ rank: index + 1, rate }))
);

assertEqual(sample.valor, 12.33, "mediana del ejemplo Binance P2P");

const conOutlier = calcularTcBinanceP2P([
  { rate: 12.31 },
  { rate: 12.32 },
  { rate: 12.33 },
  { rate: 12.34 },
  { rate: 99.99 },
]);

assertEqual(conOutlier.valor, 12.33, "resistencia a outlier");

let falloEsperado = false;
try {
  calcularTcBinanceP2P([{ rate: 12.3 }, { rate: 0 }, { rate: Number.NaN }]);
} catch {
  falloEsperado = true;
}

if (!falloEsperado) {
  throw new Error("Debe rechazar respuestas con menos de 3 cotizaciones válidas.");
}

console.log("Todos los tests de cálculo Binance P2P pasaron.");
