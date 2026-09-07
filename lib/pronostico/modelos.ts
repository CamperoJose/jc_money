// Modelos de pronóstico para una serie temporal univariante, puros y sin
// dependencias.
//
// Por qué estos y no otros: una serie de tipo de cambio diario se comporta,
// casi siempre, como una caminata aleatoria. La literatura es tozuda en esto —
// desde Meese y Rogoff (1983), los modelos elaborados rara vez le ganan a la
// caminata aleatoria fuera de muestra. Por eso aquí la caminata NO es un
// relleno: es el rival a batir, y solo se usa un SARIMA si le gana en un
// backtest de origen móvil. Un modelo que no demuestra ser mejor no se usa.
//
// La «X» de SARIMAX es de variables exógenas. Aquí no hay ninguna disponible
// —haría falta inflación, reservas del BCB o el dólar paralelo, y ninguna está
// en la app—, así que el modelo es SARIMA. Decirlo importa: inventar una
// exógena a partir de los propios datos sería hacerse trampa.

import {
  mco,
  multiplicarPolinomios,
  polinomioDiferencia,
  media,
  desviacion,
} from "./algebra";

export interface Pronostico {
  /** Valor central por horizonte, del paso 1 en adelante. */
  valores: number[];
  /** Límite inferior y superior del intervalo, mismo largo que `valores`. */
  inferior: number[];
  superior: number[];
}

export interface ModeloAjustado {
  id: string;
  nombre: string;
  /** Explicación en una línea de qué asume el modelo. */
  supuesto: string;
  /** Residuos dentro de muestra (para diagnósticos). */
  residuos: number[];
  /** Nº de parámetros estimados, para penalizar en AIC. */
  parametros: number;
  /** Predice `h` pasos hacia adelante. */
  pronosticar(h: number, z: number): Pronostico;
}

// ---------------------------------------------------------------------------
// Utilidades de serie
// ---------------------------------------------------------------------------

/** Diferencia la serie `d` veces con paso `s`. */
export function diferenciar(y: number[], d: number, s = 1): number[] {
  let out = [...y];
  for (let i = 0; i < d; i++) {
    const sig: number[] = [];
    for (let t = s; t < out.length; t++) sig.push(out[t] - out[t - s]);
    out = sig;
  }
  return out;
}

/**
 * Pesos ψ de la representación MA(∞), a partir del polinomio AR expandido
 * (que ya incorpora diferencias y parte estacional) y el MA.
 *
 * ψ₀ = 1;  ψⱼ = θⱼ + Σᵢ φᵢ·ψⱼ₋ᵢ
 *
 * Con ellos, la varianza del error a h pasos es σ²·Σ_{j<h} ψⱼ², que es lo que
 * hace que el intervalo se abra con el horizonte en vez de quedarse plano.
 */
export function pesosPsi(phi: number[], theta: number[], n: number): number[] {
  const psi = new Array<number>(n).fill(0);
  psi[0] = 1;
  for (let j = 1; j < n; j++) {
    let v = j - 1 < theta.length ? theta[j - 1] : 0;
    for (let i = 1; i <= Math.min(j, phi.length); i++) v += phi[i - 1] * psi[j - i];
    psi[j] = v;
  }
  return psi;
}

/** Cuantil de la normal estándar (Acklam), para los intervalos. */
export function zNormal(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pBajo = 0.02425;
  let q: number;
  if (p < pBajo) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pBajo) return -zNormal(1 - p);
  q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// ---------------------------------------------------------------------------
// Caminata aleatoria con deriva — el rival a batir
// ---------------------------------------------------------------------------

export function caminataConDeriva(y: number[]): ModeloAjustado | null {
  if (y.length < 3) return null;
  const dif = diferenciar(y, 1);
  const deriva = media(dif);
  const residuos = dif.map((v) => v - deriva);
  const sigma = desviacion(dif);
  const ultimo = y[y.length - 1];

  return {
    id: "rw",
    nombre: "Caminata aleatoria con deriva",
    supuesto: "Mañana es hoy más el cambio medio del periodo. El clásico de los tipos de cambio.",
    residuos,
    parametros: 1,
    pronosticar(h, z) {
      const valores: number[] = [];
      const inferior: number[] = [];
      const superior: number[] = [];
      for (let k = 1; k <= h; k++) {
        const v = ultimo + deriva * k;
        // La incertidumbre de una caminata crece con √h: los shocks se acumulan.
        const margen = z * sigma * Math.sqrt(k);
        valores.push(v);
        inferior.push(v - margen);
        superior.push(v + margen);
      }
      return { valores, inferior, superior };
    },
  };
}

// ---------------------------------------------------------------------------
// Holt (suavizado exponencial con tendencia)
// ---------------------------------------------------------------------------

function ajustarHolt(y: number[], alfa: number, beta: number) {
  let nivel = y[0];
  let tendencia = y[1] - y[0];
  const residuos: number[] = [];
  for (let t = 1; t < y.length; t++) {
    const prediccion = nivel + tendencia;
    residuos.push(y[t] - prediccion);
    const nivelPrevio = nivel;
    nivel = alfa * y[t] + (1 - alfa) * prediccion;
    tendencia = beta * (nivel - nivelPrevio) + (1 - beta) * tendencia;
  }
  return { nivel, tendencia, residuos };
}

export function holt(y: number[]): ModeloAjustado | null {
  if (y.length < 5) return null;
  // Rejilla en vez de optimizador: con dos parámetros acotados en (0,1) una
  // rejilla fina encuentra prácticamente el mismo óptimo, sin arrastrar un
  // Nelder-Mead ni sus problemas de convergencia.
  let mejor: { alfa: number; beta: number; sse: number } | null = null;
  for (let a = 0.05; a <= 0.95; a += 0.05) {
    for (let b = 0.05; b <= 0.95; b += 0.05) {
      const { residuos } = ajustarHolt(y, a, b);
      const sse = residuos.reduce((s, r) => s + r * r, 0);
      if (!mejor || sse < mejor.sse) mejor = { alfa: a, beta: b, sse };
    }
  }
  if (!mejor) return null;
  const { nivel, tendencia, residuos } = ajustarHolt(y, mejor.alfa, mejor.beta);
  const sigma = Math.sqrt(residuos.reduce((s, r) => s + r * r, 0) / Math.max(1, residuos.length - 2));
  const { alfa, beta } = mejor;

  return {
    id: "holt",
    nombre: "Suavizado exponencial (Holt)",
    supuesto: `Hay nivel y tendencia, y lo reciente pesa más (α=${alfa.toFixed(2)}, β=${beta.toFixed(2)}).`,
    residuos,
    parametros: 2,
    pronosticar(h, z) {
      const valores: number[] = [];
      const inferior: number[] = [];
      const superior: number[] = [];
      for (let k = 1; k <= h; k++) {
        const v = nivel + tendencia * k;
        // Varianza a h pasos del método de Holt (Hyndman, Koehler, Ord y
        // Snyder, «Forecasting with Exponential Smoothing», ETS(A,A,N)):
        //   σ²ₕ = σ²·[1 + Σ_{j=1}^{h−1} (α + α·β·j)²]
        // A un paso es σ², y de ahí se va abriendo.
        let acum = 1;
        for (let j = 1; j <= k - 1; j++) acum += (alfa + alfa * beta * j) ** 2;
        const margen = z * sigma * Math.sqrt(acum);
        valores.push(v);
        inferior.push(v - margen);
        superior.push(v + margen);
      }
      return { valores, inferior, superior };
    },
  };
}

// ---------------------------------------------------------------------------
// SARIMA(p,d,q)(P,D,Q)ₛ por Hannan-Rissanen
// ---------------------------------------------------------------------------

export interface OrdenSarima {
  p: number; d: number; q: number;
  P?: number; D?: number; Q?: number; s?: number;
}

export function nombreOrden(o: OrdenSarima): string {
  const base = `ARIMA(${o.p},${o.d},${o.q})`;
  const est = o.s && (o.P || o.D || o.Q) ? `(${o.P ?? 0},${o.D ?? 0},${o.Q ?? 0})[${o.s}]` : "";
  return base + est;
}

/**
 * Ajusta un SARIMA por Hannan-Rissanen: primero un AR largo por MCO para
 * estimar los choques, y después una regresión de la serie sobre sus retardos y
 * esos choques estimados. No es máxima verosimilitud, pero es consistente, se
 * calcula en milisegundos y no depende de que converja un optimizador — que en
 * un navegador, sin librerías, es exactamente lo que no queremos.
 */
export function ajustarSarima(y: number[], orden: OrdenSarima): ModeloAjustado | null {
  const { p, d, q } = orden;
  const P = orden.P ?? 0, D = orden.D ?? 0, Q = orden.Q ?? 0, s = orden.s ?? 0;
  if (p < 0 || q < 0 || d < 0) return null;
  if ((P > 0 || D > 0 || Q > 0) && s < 2) return null;

  // 1) Diferenciar (regular y estacional).
  let w = diferenciar(y, d, 1);
  if (D > 0) w = diferenciar(w, D, s);
  const nParam = p + q + P + Q;
  // Regla práctica: al menos 8 observaciones útiles por parámetro. Con menos,
  // los coeficientes son ruido con decimales.
  if (w.length < Math.max(12, 8 * Math.max(1, nParam))) return null;

  const retardosAr = [
    ...Array.from({ length: p }, (_, i) => i + 1),
    ...Array.from({ length: P }, (_, i) => (i + 1) * s),
  ];
  const retardosMa = [
    ...Array.from({ length: q }, (_, i) => i + 1),
    ...Array.from({ length: Q }, (_, i) => (i + 1) * s),
  ];
  const maxAr = retardosAr.length ? Math.max(...retardosAr) : 0;
  const maxMa = retardosMa.length ? Math.max(...retardosMa) : 0;

  const mediaW = media(w);
  const c = w.map((v) => v - mediaW); // se centra: la constante entra aparte

  // 2) Etapa 1 — AR largo para estimar los choques ε.
  const eps: number[] = new Array(c.length).fill(0);
  if (retardosMa.length > 0) {
    const k = Math.min(Math.max(maxAr + maxMa + 2, 6), Math.floor(c.length / 3));
    const X: number[][] = [];
    const Y: number[] = [];
    for (let t = k; t < c.length; t++) {
      X.push(Array.from({ length: k }, (_, i) => c[t - 1 - i]));
      Y.push(c[t]);
    }
    const coef = mco(X, Y);
    if (!coef) return null;
    for (let t = k; t < c.length; t++) {
      let pred = 0;
      for (let i = 0; i < k; i++) pred += coef[i] * c[t - 1 - i];
      eps[t] = c[t] - pred;
    }
  }

  // 3) Etapa 2 — regresión sobre retardos de la serie y de los choques.
  const inicio = Math.max(maxAr, maxMa, retardosMa.length ? Math.floor(c.length / 3) + 1 : 0);
  if (c.length - inicio < nParam + 5) return null;
  const X2: number[][] = [];
  const Y2: number[] = [];
  for (let t = inicio; t < c.length; t++) {
    const fila = [
      ...retardosAr.map((l) => c[t - l]),
      ...retardosMa.map((l) => eps[t - l]),
    ];
    X2.push(fila);
    Y2.push(c[t]);
  }
  let coef2: number[] | null;
  if (nParam === 0) {
    coef2 = []; // ARIMA(0,d,0): solo deriva
  } else {
    coef2 = mco(X2, Y2);
    if (!coef2) return null;
  }

  // Coeficientes por posición de retardo.
  const phiCorto = new Array<number>(maxAr).fill(0);
  retardosAr.forEach((l, i) => { phiCorto[l - 1] = coef2![i]; });
  const thetaCorto = new Array<number>(maxMa).fill(0);
  retardosMa.forEach((l, i) => { thetaCorto[l - 1] = coef2![retardosAr.length + i]; });

  // Un AR explosivo o un MA no invertible producen pronósticos que se van al
  // infinito. Σ|coef| < 1 es la condición SUFICIENTE de estacionariedad e
  // invertibilidad; se afloja a 1,5 para no descartar ajustes buenos que la
  // rozan, pero por encima de eso el modelo no sirve.
  const sumaPhi = phiCorto.reduce((a, b) => a + Math.abs(b), 0);
  const sumaTheta = thetaCorto.reduce((a, b) => a + Math.abs(b), 0);
  if (!Number.isFinite(sumaPhi) || sumaPhi > 1.5) return null;
  if (!Number.isFinite(sumaTheta) || sumaTheta > 1.5) return null;

  // 4) Residuos y σ, recalculados con los coeficientes finales.
  const residuos: number[] = [];
  const epsFinal = [...eps];
  for (let t = inicio; t < c.length; t++) {
    let pred = 0;
    for (let l = 1; l <= maxAr; l++) pred += phiCorto[l - 1] * c[t - l];
    for (let l = 1; l <= maxMa; l++) pred += thetaCorto[l - 1] * epsFinal[t - l];
    const r = c[t] - pred;
    epsFinal[t] = r;
    residuos.push(r);
  }
  if (residuos.length === 0) return null;
  const gl = Math.max(1, residuos.length - nParam);
  const sigma = Math.sqrt(residuos.reduce((a, r) => a + r * r, 0) / gl);
  if (!Number.isFinite(sigma)) return null;

  // 5) Polinomio AR expandido: φ(B)·Φ(Bˢ)·(1−B)^d·(1−Bˢ)^D.
  //    Así el pronóstico se hace sobre la serie ORIGINAL, sin integrar a mano.
  let arExpandido = [1, ...phiCorto.map((v) => -v)];
  arExpandido = multiplicarPolinomios(arExpandido, polinomioDiferencia(1, d));
  if (D > 0) arExpandido = multiplicarPolinomios(arExpandido, polinomioDiferencia(s, D));
  // De (1 − a₁B − a₂B² …) a los coeficientes a.
  const phiTotal = arExpandido.slice(1).map((v) => -v);

  const constante = mediaW * (1 - phiCorto.reduce((a, b) => a + b, 0));

  return {
    id: `sarima-${p}${d}${q}-${P}${D}${Q}-${s}`,
    nombre: nombreOrden(orden),
    supuesto:
      q + Q > 0
        ? "El valor de hoy depende de los valores y de los errores recientes."
        : "El valor de hoy depende de los valores recientes.",
    residuos,
    parametros: nParam + 1,
    pronosticar(h, z) {
      // Historia de la serie original + choques (0 hacia el futuro).
      const hist = [...y];
      const choques = new Array<number>(y.length).fill(0);
      // Los últimos residuos se alinean al final de la serie.
      for (let i = 0; i < residuos.length; i++) {
        const idx = y.length - residuos.length + i;
        if (idx >= 0) choques[idx] = residuos[i];
      }

      const valores: number[] = [];
      for (let k = 1; k <= h; k++) {
        let v = constante;
        for (let l = 1; l <= phiTotal.length; l++) {
          const idx = hist.length - l;
          if (idx >= 0) v += phiTotal[l - 1] * hist[idx];
        }
        for (let l = 1; l <= maxMa; l++) {
          const idx = choques.length - l;
          if (idx >= 0) v += thetaCorto[l - 1] * choques[idx];
        }
        hist.push(v);
        choques.push(0); // el choque futuro tiene esperanza cero
        valores.push(v);
      }

      const psi = pesosPsi(phiTotal, thetaCorto, h);
      const inferior: number[] = [];
      const superior: number[] = [];
      let acum = 0;
      for (let k = 0; k < h; k++) {
        acum += psi[k] * psi[k];
        const margen = z * sigma * Math.sqrt(acum);
        inferior.push(valores[k] - margen);
        superior.push(valores[k] + margen);
      }
      return { valores, inferior, superior };
    },
  };
}
