// Álgebra mínima para el ajuste de modelos. Sin dependencias: el proyecto es de
// costo cero y todo corre en el runtime de Next, así que no hay Python ni
// librerías numéricas.

/**
 * Resuelve A·x = b por eliminación gaussiana con pivoteo parcial.
 * Devuelve null si el sistema es singular (columnas colineales), que en una
 * regresión significa «esta especificación no es identificable»: preferimos
 * descartar el modelo antes que devolver coeficientes basura.
 */
export function resolverSistema(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0 || A.some((f) => f.length !== n) || b.length !== n) return null;
  const M = A.map((f, i) => [...f, b[i]]); // copia: no se toca la entrada

  for (let col = 0; col < n; col++) {
    let mejor = col;
    for (let f = col + 1; f < n; f++) {
      if (Math.abs(M[f][col]) > Math.abs(M[mejor][col])) mejor = f;
    }
    if (Math.abs(M[mejor][col]) < 1e-12) return null; // singular
    [M[col], M[mejor]] = [M[mejor], M[col]];

    const pivote = M[col][col];
    for (let f = col + 1; f < n; f++) {
      const factor = M[f][col] / pivote;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[f][c] -= factor * M[col][c];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let f = n - 1; f >= 0; f--) {
    let s = M[f][n];
    for (let c = f + 1; c < n; c++) s -= M[f][c] * x[c];
    x[f] = s / M[f][f];
  }
  return x.every(Number.isFinite) ? x : null;
}

/**
 * Mínimos cuadrados ordinarios: coeficientes de `y ~ X`. `X` NO lleva columna
 * de unos; la agrega quien la necesite.
 *
 * Se resuelve por ecuaciones normales (XᵀX)β = Xᵀy. Con matrices pequeñas y
 * bien escaladas —pocas columnas de retardos— alcanza, y evita arrastrar una
 * descomposición QR entera.
 */
export function mco(X: number[][], y: number[]): number[] | null {
  const n = X.length;
  const k = X[0]?.length ?? 0;
  if (n === 0 || k === 0 || y.length !== n || n < k) return null;

  const XtX: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const Xty = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = a; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];

  return resolverSistema(XtX, Xty);
}

/**
 * Multiplica dos polinomios dados por sus coeficientes en orden ascendente:
 * a[0] + a[1]·B + a[2]·B² + …
 *
 * Se usa para expandir la parte estacional y las diferencias de un SARIMA en un
 * único polinomio AR: φ(B)·Φ(Bˢ)·(1−B)^d·(1−Bˢ)^D. Con eso el pronóstico y los
 * pesos ψ salen de una sola recursión en vez de tres anidadas.
 */
export function multiplicarPolinomios(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0) continue;
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return out;
}

/** Polinomio (1 − Bˢ)^d, en orden ascendente. */
export function polinomioDiferencia(s: number, d: number): number[] {
  let p = [1];
  const base = new Array<number>(s + 1).fill(0);
  base[0] = 1;
  base[s] = -1;
  for (let i = 0; i < d; i++) p = multiplicarPolinomios(p, base);
  return p;
}

export function media(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Desviación típica muestral (n−1). 0 si hay menos de dos datos. */
export function desviacion(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
