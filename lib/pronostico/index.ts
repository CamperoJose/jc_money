// Pronóstico del tipo de cambio: elige el modelo por backtest y traduce el
// resultado a decisiones.
//
// El orden importa y es a propósito:
//   1. ¿La serie se mueve? Si está anclada, pronosticarla es teatro.
//   2. Competencia entre modelos con validación de origen móvil.
//   3. Solo entonces, el pronóstico del ganador, con su intervalo.
//   4. Diagnóstico honesto de lo que el modelo NO capta.

import {
  ajustarSarima,
  caminataConDeriva,
  holt,
  diferenciar,
  zNormal,
  nombreOrden,
  type ModeloAjustado,
  type OrdenSarima,
  type Pronostico,
} from "./modelos";
import { media, desviacion } from "./algebra";

export type { Pronostico } from "./modelos";

export interface PuntoSerie {
  fecha: string; // YYYY-MM-DD
  valor: number;
}

export interface MetricasBacktest {
  id: string;
  nombre: string;
  supuesto: string;
  /** Error absoluto medio fuera de muestra. */
  mae: number;
  /** Raíz del error cuadrático medio. */
  rmse: number;
  /** Error porcentual absoluto medio. */
  mape: number;
  /** Cuántos pronósticos fuera de muestra se evaluaron. */
  evaluaciones: number;
  /** Mejora en MAE frente a la caminata aleatoria (positiva = mejor). */
  mejoraVsCaminata: number | null;
}

export interface PuntoPronostico {
  fecha: string;
  valor: number;
  inferior: number;
  superior: number;
}

export type Regimen = "anclado" | "movil";

export interface Diagnostico {
  id: string;
  titulo: string;
  detalle: string;
  tono: "bueno" | "malo" | "neutro" | "aviso";
}

export interface LecturaHorizonte {
  dias: number;
  fecha: string;
  valor: number;
  inferior: number;
  superior: number;
  /** Cambio esperado respecto del valor de hoy. */
  cambioPct: number;
  /** P(el T/C esté por ENCIMA del de hoy en esa fecha). */
  probabilidadSubir: number;
  /**
   * ¿El movimiento esperado se distingue del ruido? Una caminata aleatoria
   * finita SIEMPRE estima alguna deriva, así que a 90 días puede salir un
   * «24% de probabilidad de subir» que en realidad es ruido con decimales.
   * Cuando esto es falso, la dirección no debe presentarse como una señal.
   */
  direccionSignificativa: boolean;
  /** Qué le pasa a 1.000 USD guardados, medido en BOB. */
  efectoEn1000Usd: number;
}

export interface ResultadoPronostico {
  suficienteData: boolean;
  motivo: string | null;
  n: number;
  desde: string | null;
  hasta: string | null;
  ultimo: number | null;

  /** ¿La serie se mueve, o es un ancla? */
  regimen: Regimen;
  /** Registros totales disponibles (la serie sin recortar). */
  nDisponibles: number;
  /** Días con cambio respecto al día anterior, sobre el total. */
  diasConCambio: number;
  proporcionCambio: number;
  /** Volatilidad diaria en % (desviación de los rendimientos). */
  volatilidadDiaria: number | null;
  /** Volatilidad anualizada en % (×√252). */
  volatilidadAnual: number | null;

  /** Tabla comparativa: todos los modelos que se pudieron ajustar. */
  competencia: MetricasBacktest[];
  ganador: MetricasBacktest | null;
  /** Pronóstico del ganador. */
  puntos: PuntoPronostico[];
  /** Confianza del intervalo (0,95 = 95%). */
  confianza: number;

  /** Lectura por horizonte, para la tabla de decisión. */
  horizontes: LecturaHorizonte[];
  diagnosticos: Diagnostico[];
  narrativa: string;
}

/**
 * Φ(x): función de distribución de la normal estándar, por la aproximación de
 * Abramowitz y Stegun (error < 7,5·10⁻⁸). Se usa para pasar del intervalo a una
 * probabilidad, que es lo que de verdad sirve para decidir: «hay un 62% de que
 * suba» se acciona; «el intervalo es [6,95; 7,10]» no tanto.
 */
export function phiNormal(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/**
 * Traduce el pronóstico a lecturas por horizonte. La σ implícita sale del ancho
 * del propio intervalo, así que respeta el modelo que haya ganado en vez de
 * suponer uno.
 */
function lecturas(
  puntos: PuntoPronostico[],
  ultimo: number,
  z: number,
  horizontes: number[]
): LecturaHorizonte[] {
  const out: LecturaHorizonte[] = [];
  for (const h of horizontes) {
    const p = puntos[h - 1];
    if (!p) continue;
    const sigma = z > 0 ? (p.superior - p.inferior) / (2 * z) : 0;
    // Con σ = 0 (una serie anclada) la probabilidad de subir es 0, no 50%:
    // no hay incertidumbre que repartir.
    const probabilidadSubir = sigma > 0 ? 1 - phiNormal((ultimo - p.valor) / sigma) : 0;
    // Criterio: el cambio esperado tiene que superar media σ para llamarlo
    // dirección. Por debajo de eso, el intervalo se come al movimiento.
    const direccionSignificativa = sigma > 0 && Math.abs(p.valor - ultimo) > 0.5 * sigma;
    out.push({
      dias: h,
      fecha: p.fecha,
      valor: p.valor,
      inferior: p.inferior,
      superior: p.superior,
      probabilidadSubir,
      direccionSignificativa,
      cambioPct: ultimo > 0 ? (p.valor - ultimo) / ultimo : 0,
      efectoEn1000Usd: (p.valor - ultimo) * 1000,
    });
  }
  return out;
}

const CONFIANZA = 0.95;
/**
 * Observaciones que se usan para modelar, como mucho: unos tres años.
 *
 * Hay dos razones y las dos importan. La metodológica: en un tipo de cambio,
 * los datos de hace ocho años pertenecen a otro régimen y meten ruido en vez de
 * información. La práctica: el backtest reajusta el modelo en cada origen, así
 * que el coste crece rápido — con diez años de historia diaria la página tardaba
 * 2,1 s en renderizar, y esto lo deja en medio segundo.
 */
const VENTANA_MAXIMA = 750;
/** Horizontes que se muestran, en días de calendario. */
export const HORIZONTES = [7, 15, 30, 60, 90];

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Rendimientos logarítmicos: la medida estándar de variación de un T/C. */
function rendimientos(y: number[]): number[] {
  const out: number[] = [];
  for (let t = 1; t < y.length; t++) {
    if (y[t - 1] > 0 && y[t] > 0) out.push(Math.log(y[t] / y[t - 1]));
  }
  return out;
}

/**
 * Estadístico de Ljung-Box sobre los residuos. Si sale grande, quedó estructura
 * sin modelar: el pronóstico central sigue valiendo, pero el intervalo se queda
 * corto y conviene decirlo.
 */
function ljungBox(residuos: number[], m: number): number | null {
  const n = residuos.length;
  if (n < m + 5) return null;
  const mu = media(residuos);
  const c0 = residuos.reduce((a, r) => a + (r - mu) ** 2, 0);
  if (c0 <= 0) return null;
  let q = 0;
  for (let k = 1; k <= m; k++) {
    let ck = 0;
    for (let t = k; t < n; t++) ck += (residuos[t] - mu) * (residuos[t - k] - mu);
    const rk = ck / c0;
    q += (rk * rk) / (n - k);
  }
  return n * (n + 2) * q;
}

/** Valor crítico al 5% de una χ² con `gl` grados de libertad (tabla). */
function criticoChi2(gl: number): number {
  const tabla: Record<number, number> = {
    1: 3.84, 2: 5.99, 3: 7.81, 4: 9.49, 5: 11.07, 6: 12.59, 7: 14.07,
    8: 15.51, 9: 16.92, 10: 18.31, 11: 19.68, 12: 21.03, 13: 22.36, 14: 23.68,
  };
  return tabla[gl] ?? gl + 2 * Math.sqrt(2 * gl); // aproximación para gl grande
}

type Constructor = { id: string; construir: (y: number[]) => ModeloAjustado | null };

/** Órdenes SARIMA que se prueban. Pocos y con sentido, no una rejilla ciega. */
const ORDENES: OrdenSarima[] = [
  { p: 0, d: 1, q: 0 }, // caminata pura
  { p: 1, d: 0, q: 0 }, // reversión a la media
  { p: 1, d: 1, q: 0 },
  { p: 0, d: 1, q: 1 },
  { p: 1, d: 1, q: 1 },
  { p: 2, d: 1, q: 0 },
  { p: 0, d: 1, q: 2 },
  { p: 2, d: 1, q: 2 },
];

function candidatos(n: number): Constructor[] {
  const lista: Constructor[] = [
    { id: "rw", construir: caminataConDeriva },
    { id: "holt", construir: holt },
  ];
  for (const o of ORDENES) {
    lista.push({ id: nombreOrden(o), construir: (y) => ajustarSarima(y, o) });
  }
  // Estacionalidad semanal: solo con historial suficiente para verla varias veces.
  if (n >= 120) {
    for (const o of [
      { p: 1, d: 1, q: 0, P: 1, D: 0, Q: 0, s: 7 },
      { p: 0, d: 1, q: 1, P: 0, D: 0, Q: 1, s: 7 },
    ] as OrdenSarima[]) {
      lista.push({ id: nombreOrden(o), construir: (y) => ajustarSarima(y, o) });
    }
  }
  return lista;
}

/**
 * Validación de origen móvil: se corta la serie en un punto, se ajusta con lo
 * que había ANTES y se predice lo que vino después; luego se avanza el corte.
 *
 * Es la única forma honesta de comparar modelos: el ajuste dentro de muestra
 * premia al más complejo siempre, y un modelo elegido así falla en cuanto ve
 * datos nuevos.
 */
function backtest(
  y: number[],
  c: Constructor,
  horizonte: number,
  origenes: number
): { mae: number; rmse: number; mape: number; evaluaciones: number } | null {
  const minEntrenamiento = Math.max(20, Math.floor(y.length * 0.5));
  if (y.length < minEntrenamiento + horizonte + 1) return null;

  const errores: number[] = [];
  const relativos: number[] = [];
  const primerCorte = Math.max(minEntrenamiento, y.length - horizonte - origenes);
  for (let corte = primerCorte; corte <= y.length - horizonte; corte++) {
    const entrenamiento = y.slice(0, corte);
    const modelo = c.construir(entrenamiento);
    if (!modelo) continue;
    let pron: Pronostico;
    try {
      pron = modelo.pronosticar(horizonte, 1.96);
    } catch {
      continue;
    }
    // Cordura numérica: un pronóstico un orden de magnitud fuera de todo lo
    // observado no es una predicción mala, es un fallo numérico. Dejarlo pasar
    // ensucia la tabla con MAE de 10²⁴ y, peor, podría llegar a «ganar».
    const min = Math.min(...entrenamiento);
    const max = Math.max(...entrenamiento);
    const piso = min / 10;
    const techo = max * 10;

    for (let k = 0; k < horizonte; k++) {
      const real = y[corte + k];
      const pred = pron.valores[k];
      if (!Number.isFinite(pred) || !Number.isFinite(real)) return null;
      if (pred < piso || pred > techo) return null; // modelo explosivo: fuera
      errores.push(real - pred);
      if (real !== 0) relativos.push(Math.abs((real - pred) / real));
    }
  }
  if (errores.length === 0) return null;
  return {
    mae: media(errores.map(Math.abs)),
    rmse: Math.sqrt(media(errores.map((e) => e * e))),
    mape: relativos.length ? media(relativos) : 0,
    evaluaciones: errores.length,
  };
}

export function pronosticarTipoCambio(
  serie: PuntoSerie[],
  opciones: { horizonteDias?: number } = {}
): ResultadoPronostico {
  const horizonte = opciones.horizonteDias ?? 30;
  const limpia = serie
    .filter((p) => p.fecha && Number.isFinite(p.valor) && p.valor > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  // Se modela sobre la ventana reciente; la serie completa se sigue mostrando.
  const usada = limpia.length > VENTANA_MAXIMA ? limpia.slice(-VENTANA_MAXIMA) : limpia;
  const y = usada.map((p) => p.valor);
  const n = y.length;

  const vacio: ResultadoPronostico = {
    suficienteData: false,
    motivo: null,
    n,
    desde: usada[0]?.fecha ?? null,
    hasta: usada[n - 1]?.fecha ?? null,
    ultimo: y[n - 1] ?? null,
    regimen: "movil",
    nDisponibles: limpia.length,
    diasConCambio: 0,
    proporcionCambio: 0,
    volatilidadDiaria: null,
    volatilidadAnual: null,
    competencia: [],
    ganador: null,
    puntos: [],
    confianza: CONFIANZA,
    horizontes: [],
    diagnosticos: [],
    narrativa: "",
  };

  if (n < 30) {
    return {
      ...vacio,
      motivo: `Hacen falta al menos 30 registros para modelar algo; hay ${n}. El job diario los va cargando solo.`,
      narrativa: "Todavía no hay historial suficiente para pronosticar.",
    };
  }

  // --- 1. ¿Se mueve la serie? ----------------------------------------------
  const dif = diferenciar(y, 1);
  const diasConCambio = dif.filter((d) => Math.abs(d) > 1e-9).length;
  const proporcionCambio = dif.length ? diasConCambio / dif.length : 0;
  const rend = rendimientos(y);
  const volDiaria = rend.length >= 2 ? desviacion(rend) : null;
  const volAnual = volDiaria != null ? volDiaria * Math.sqrt(252) : null;

  // Menos de un 2% de días con movimiento es un ancla, no una serie ruidosa.
  const regimen: Regimen = proporcionCambio < 0.02 ? "anclado" : "movil";
  const ultimo = y[n - 1];

  if (regimen === "anclado") {
    const diagnosticos: Diagnostico[] = [
      {
        id: "anclado",
        titulo: "Este tipo de cambio está anclado",
        detalle:
          `En ${dif.length} días registrados cambió ${diasConCambio} ${diasConCambio === 1 ? "vez" : "veces"}. ` +
          "No es que el modelo no encuentre señal: es que no hay nada que pronosticar. " +
          "Ajustar un SARIMA a una constante devolvería esa misma constante con un intervalo de ancho cero, " +
          "y eso se leería como una certeza que no existe.",
        tono: "neutro",
      },
      {
        id: "riesgo-real",
        titulo: "Tu riesgo cambiario no está en este número",
        detalle:
          "Mientras el ancla se sostenga, mover BOB a USD (o al revés) no te hace ganar ni perder por tipo de cambio. " +
          "El riesgo de un ancla no es que se mueva poco a poco: es que se rompa de golpe. Eso no se ve en la serie " +
          "hasta que pasa, así que la decisión pasa por cuánto podrías absorber si se rompiera, no por este pronóstico.",
        tono: "aviso",
      },
    ];
    return {
      ...vacio,
      suficienteData: true,
      regimen,
      nDisponibles: limpia.length,
      diasConCambio,
      proporcionCambio,
      volatilidadDiaria: volDiaria,
      volatilidadAnual: volAnual,
      // El «pronóstico» de un ancla es el ancla. Se dibuja plano y sin banda,
      // para que se vea que no hay incertidumbre estimada, no para fingir precisión.
      puntos: Array.from({ length: horizonte }, (_, i) => ({
        fecha: sumarDias(usada[n - 1].fecha, i + 1),
        valor: ultimo,
        inferior: ultimo,
        superior: ultimo,
      })),
      horizontes: [],
      diagnosticos,
      narrativa:
        `El tipo de cambio lleva ${dif.length} días registrados y cambió ${diasConCambio} ${diasConCambio === 1 ? "vez" : "veces"}. ` +
        "Está anclado: no hay tendencia que proyectar.",
    };
  }

  // --- 2. Competencia entre modelos ----------------------------------------
  const origenes = Math.min(40, Math.max(8, Math.floor(n * 0.2)));
  // El backtest evalúa a un horizonte corto (7 días o el pedido, el menor):
  // comparar a 90 días con este historial daría muy pocos orígenes y una
  // comparación que depende de dos o tres ventanas afortunadas.
  const hEval = Math.min(7, horizonte);

  const metricas: MetricasBacktest[] = [];
  const ajustados = new Map<string, ModeloAjustado>();
  for (const c of candidatos(n)) {
    const m = c.construir(y);
    if (!m) continue;
    const bt = backtest(y, c, hEval, origenes);
    if (!bt) continue;
    ajustados.set(m.id, m);
    metricas.push({
      id: m.id,
      nombre: m.nombre,
      supuesto: m.supuesto,
      mae: bt.mae,
      rmse: bt.rmse,
      mape: bt.mape,
      evaluaciones: bt.evaluaciones,
      mejoraVsCaminata: null,
    });
  }

  if (metricas.length === 0) {
    return {
      ...vacio,
      suficienteData: false,
      regimen,
      nDisponibles: limpia.length,
      diasConCambio,
      proporcionCambio,
      volatilidadDiaria: volDiaria,
      volatilidadAnual: volAnual,
      motivo: "No se pudo ajustar ningún modelo con este historial.",
      narrativa: "No hay suficiente historial para validar un modelo.",
    };
  }

  const caminata = metricas.find((m) => m.id === "rw");
  for (const m of metricas) {
    m.mejoraVsCaminata =
      caminata && caminata.mae > 0 ? (caminata.mae - m.mae) / caminata.mae : null;
  }
  metricas.sort((a, b) => a.mae - b.mae);

  // Regla de parsimonia: un modelo elaborado tiene que ganarle a la caminata
  // por un margen real (5% de MAE), no por decimales. Si no, se queda la
  // caminata, que no tiene parámetros que sobreajustar.
  let ganador = metricas[0];
  if (caminata && ganador.id !== "rw" && (ganador.mejoraVsCaminata ?? 0) < 0.05) {
    ganador = caminata;
  }

  // --- 3. Pronóstico del ganador -------------------------------------------
  const modelo = ajustados.get(ganador.id)!;
  const z = zNormal(1 - (1 - CONFIANZA) / 2);
  const pron = modelo.pronosticar(horizonte, z);
  const puntos: PuntoPronostico[] = pron.valores.map((v, i) => ({
    fecha: sumarDias(usada[n - 1].fecha, i + 1),
    valor: v,
    inferior: pron.inferior[i],
    superior: pron.superior[i],
  }));

  // --- 4. Diagnósticos ------------------------------------------------------
  const diagnosticos: Diagnostico[] = [];

  if (ganador.id === "rw") {
    diagnosticos.push({
      id: "gana-caminata",
      titulo: "Ningún modelo le gana a la caminata aleatoria",
      detalle:
        "Se probaron " + metricas.length + " modelos y ninguno mejoró el MAE de la caminata en más de un 5% " +
        "fuera de muestra. Es el resultado normal en tipos de cambio, y es información útil: la mejor " +
        "predicción del valor de mañana es el valor de hoy. Desconfía de cualquier pronóstico que prometa más.",
      tono: "neutro",
    });
  } else {
    diagnosticos.push({
      id: "gana-modelo",
      titulo: `${ganador.nombre} le gana a la caminata aleatoria`,
      detalle:
        `Reduce el error un ${(100 * (ganador.mejoraVsCaminata ?? 0)).toFixed(1)}% en validación de origen móvil ` +
        `(${ganador.evaluaciones} pronósticos fuera de muestra). Hay estructura aprovechable en la serie.`,
      tono: "bueno",
    });
  }

  const m = Math.min(10, Math.max(4, Math.floor(modelo.residuos.length / 5)));
  const lb = ljungBox(modelo.residuos, m);
  const gl = Math.max(1, m - (modelo.parametros - 1));
  if (lb != null && lb > criticoChi2(gl)) {
    diagnosticos.push({
      id: "autocorrelacion",
      titulo: "Quedó estructura sin capturar",
      detalle:
        `Los residuos siguen correlacionados (Ljung-Box ${lb.toFixed(1)} sobre un crítico de ${criticoChi2(gl).toFixed(1)}). ` +
        "El valor central sigue siendo útil, pero el intervalo es más estrecho de lo que debería: tomalo como un piso.",
      tono: "aviso",
    });
  }

  if (volAnual != null) {
    diagnosticos.push({
      id: "volatilidad",
      titulo: `Volatilidad anualizada del ${(volAnual * 100).toFixed(1)}%`,
      detalle:
        volAnual < 0.02
          ? "Movimiento mínimo: en la práctica se comporta casi como un ancla."
          : volAnual < 0.1
            ? "Movimiento moderado, comparable a una divisa estable."
            : "Movimiento alto: los saltos pueden pesar más que los rendimientos que persigas.",
      tono: volAnual >= 0.1 ? "aviso" : "neutro",
    });
  }

  const ult = puntos[puntos.length - 1];
  const cambio = ultimo > 0 ? (ult.valor - ultimo) / ultimo : 0;
  // El titular usa EXACTAMENTE el mismo criterio que la tabla de horizontes
  // (media σ). Con dos umbrales distintos se daba el caso de leer «no se
  // distingue del ruido» arriba y un «75% de que suba» en negrita abajo.
  const sigmaFinal = z > 0 ? (ult.superior - ult.inferior) / (2 * z) : 0;
  const significativo = sigmaFinal > 0 && Math.abs(ult.valor - ultimo) > 0.5 * sigmaFinal;
  const narrativa = !significativo
    ? `A ${horizonte} días el modelo no ve un movimiento distinguible del ruido: el rango probable ` +
      `(${ult.inferior.toFixed(4)} – ${ult.superior.toFixed(4)}) se come al cambio esperado.`
    : `A ${horizonte} días el modelo apunta a ${ult.valor.toFixed(4)} Bs ` +
      `(${cambio >= 0 ? "+" : ""}${(cambio * 100).toFixed(2)}%), con un rango probable de ` +
      `${ult.inferior.toFixed(4)} a ${ult.superior.toFixed(4)}.`;

  return {
    suficienteData: true,
    motivo: null,
    n,
    desde: usada[0].fecha,
    hasta: usada[n - 1].fecha,
    ultimo,
    regimen,
    nDisponibles: limpia.length,
    diasConCambio,
    proporcionCambio,
    volatilidadDiaria: volDiaria,
    volatilidadAnual: volAnual,
    competencia: metricas,
    ganador,
    puntos,
    confianza: CONFIANZA,
    horizontes: lecturas(puntos, ultimo, z, HORIZONTES.filter((h) => h <= horizonte)),
    diagnosticos,
    narrativa,
  };
}
