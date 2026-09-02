// Análisis de tendencia del patrimonio: regresión lineal + proyección compuesta.
// Puro (sin red). Trabaja sobre la serie histórica (fecha ISO, valor en BOB).

function diasEntre(a: string, b: string): number {
  const ma = Date.parse(`${a}T00:00:00Z`);
  const mb = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(ma) || Number.isNaN(mb)) return 0;
  return Math.round((mb - ma) / 86_400_000);
}
function sumarMeses(fecha: string, meses: number): string {
  const [y, m, dd] = fecha.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), Math.min(dd, ultimoDia)))
    .toISOString()
    .slice(0, 10);
}
function r2n(n: number): number {
  return Math.round(n * 100) / 100;
}
function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export interface Proyeccion {
  meses: number;
  label: string;
  fecha: string;
  valorLineal: number;
  valorCompuesto: number | null;
}

export interface Meta {
  objetivo: number;
  fecha: string | null; // null si nunca (ritmo ≤ 0)
  dias: number | null;
}

export interface PuntoTendencia {
  fecha: string;
  real: number | null;
  proyeccion: number | null;
}

export interface ResumenTendencias {
  suficienteData: boolean;
  n: number;
  desde: string | null;
  hasta: string | null;
  valorActual: number | null;
  ritmoDiario: number | null; // Bs/día (pendiente de la regresión)
  ritmoMensual: number | null; // Bs/mes ≈ ritmoDiario · 30.44
  r2: number | null; // 0..1, qué tan lineal es
  crecimientoMensualPct: number | null; // compuesto (primero→último)
  proyecciones: Proyeccion[];
  metas: Meta[];
  puntos: PuntoTendencia[]; // histórico + línea proyectada
  narrativa: string;
}

const MESES_HORIZONTE = [1, 3, 6, 12, 24];
const DIAS_MES = 30.4375;

function etiquetaMeses(m: number): string {
  if (m === 12) return "1 año";
  if (m === 24) return "2 años";
  return `${m} ${m === 1 ? "mes" : "meses"}`;
}

/** Metas "redondas" por encima del valor actual. */
function metasSugeridas(valor: number): number[] {
  const escalera = [
    50_000, 75_000, 100_000, 150_000, 200_000, 250_000, 300_000, 400_000, 500_000,
    750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000,
  ];
  return escalera.filter((x) => x > valor).slice(0, 4);
}

export function analizarTendencia(
  serie: { fecha: string; bob: number }[]
): ResumenTendencias {
  const puntosValidos = serie.filter((p) => p.fecha && Number.isFinite(p.bob));
  const n = puntosValidos.length;
  const vacio: ResumenTendencias = {
    suficienteData: false,
    n,
    desde: null,
    hasta: null,
    valorActual: null,
    ritmoDiario: null,
    ritmoMensual: null,
    r2: null,
    crecimientoMensualPct: null,
    proyecciones: [],
    metas: [],
    puntos: [],
    narrativa: "Necesitas al menos 2 fotos de patrimonio para proyectar una tendencia.",
  };
  if (n < 2) return vacio;

  const desde = puntosValidos[0].fecha;
  const hasta = puntosValidos[n - 1].fecha;
  const valorActual = r2n(puntosValidos[n - 1].bob);

  // Regresión lineal por mínimos cuadrados: x = días desde la primera foto.
  const xs = puntosValidos.map((p) => diasEntre(desde, p.fecha));
  const ys = puntosValidos.map((p) => p.bob);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const predict = (dia: number) => intercept + slope * dia;

  // R²
  const meanY = sumY / n;
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((a, y, i) => a + (y - predict(xs[i])) ** 2, 0);
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;

  const ritmoDiario = r2n(slope);
  const ritmoMensual = r2n(slope * DIAS_MES);

  // Crecimiento mensual compuesto (primero→último).
  const primero = puntosValidos[0].bob;
  const mesesTotales = diasEntre(desde, hasta) / DIAS_MES;
  const crecimientoMensualPct =
    primero > 0 && mesesTotales > 0 && valorActual > 0
      ? r4(Math.pow(valorActual / primero, 1 / mesesTotales) - 1)
      : null;

  const proyecciones: Proyeccion[] = MESES_HORIZONTE.map((m) => {
    const fecha = sumarMeses(hasta, m);
    const dia = diasEntre(desde, fecha);
    const valorLineal = r2n(predict(dia));
    const valorCompuesto =
      crecimientoMensualPct != null ? r2n(valorActual * Math.pow(1 + crecimientoMensualPct, m)) : null;
    return { meses: m, label: etiquetaMeses(m), fecha, valorLineal, valorCompuesto };
  });

  const metas: Meta[] = metasSugeridas(valorActual).map((objetivo) => {
    if (slope <= 0) return { objetivo, fecha: null, dias: null };
    const diaObjetivo = (objetivo - intercept) / slope;
    const diasDesdeHasta = Math.ceil(diaObjetivo - diasEntre(desde, hasta));
    if (diasDesdeHasta <= 0) return { objetivo, fecha: hasta, dias: 0 };
    const fecha = sumarDiasISO(hasta, diasDesdeHasta);
    return { objetivo, fecha, dias: diasDesdeHasta };
  });

  // Puntos para el gráfico: histórico (real) + línea de regresión, extendida
  // hasta el horizonte más lejano.
  const puntos: PuntoTendencia[] = puntosValidos.map((p) => ({
    fecha: p.fecha,
    real: r2n(p.bob),
    proyeccion: r2n(predict(diasEntre(desde, p.fecha))),
  }));
  for (const m of MESES_HORIZONTE) {
    const fecha = sumarMeses(hasta, m);
    puntos.push({ fecha, real: null, proyeccion: r2n(predict(diasEntre(desde, fecha))) });
  }

  const proy12 = proyecciones.find((p) => p.meses === 12)!;
  const narrativa =
    ritmoMensual >= 0
      ? `Si mantienes este ritmo (+${fmt(ritmoMensual)} Bs/mes), el ${fechaLarga(proy12.fecha)} tendrás alrededor de ${fmt(proy12.valorLineal)} Bs.`
      : `A este ritmo (${fmt(ritmoMensual)} Bs/mes) tu patrimonio viene bajando; revisa gastos o aportes.`;

  return {
    suficienteData: true,
    n,
    desde,
    hasta,
    valorActual,
    ritmoDiario,
    ritmoMensual,
    r2: r4(r2),
    crecimientoMensualPct,
    proyecciones,
    metas,
    puntos,
    narrativa,
  };
}

function sumarDiasISO(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function fmt(n: number): string {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(n);
}
function fechaLarga(iso: string): string {
  const [y, m, dd] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, dd))
  );
}
