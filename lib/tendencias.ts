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
  /** Banda de predicción al 95%: [piso, techo]. Solo en el tramo proyectado. */
  banda: [number, number] | null;
}

export interface CambioMensual {
  period: string; // 'YYYY-MM'
  inicio: number;
  fin: number;
  cambio: number; // fin − inicio, en BOB
  pct: number | null; // cambio / inicio
}

export interface Aceleracion {
  ritmoReciente: number | null; // Bs/mes de la ventana corta
  ritmoPrevio: number | null; // Bs/mes del tramo anterior
  direccion: "acelerando" | "desacelerando" | "estable" | "sin_datos";
}

export interface Hallazgo {
  id: string;
  titulo: string;
  detalle: string;
  tono: "bueno" | "malo" | "neutro" | "aviso";
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

  // --- Lectura del comportamiento, no solo de la recta ---
  /** Desviación típica de los residuos: cuánto se aparta la realidad de la recta. */
  errorEstandar: number | null;
  /** Desviación típica de los cambios mes a mes, en BOB. */
  volatilidadMensual: number | null;
  maximo: { fecha: string; valor: number } | null;
  /** Cuánto estás por debajo del máximo histórico (0 si estás en el pico). */
  drawdown: { monto: number; pct: number } | null;
  aceleracion: Aceleracion;
  porMes: CambioMensual[];
  mejorMes: CambioMensual | null;
  peorMes: CambioMensual | null;
  /** Meses consecutivos en la misma dirección, contando desde el último. */
  racha: { meses: number; direccion: "alza" | "baja" } | null;
  hallazgos: Hallazgo[];
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
    errorEstandar: null,
    volatilidadMensual: null,
    maximo: null,
    drawdown: null,
    aceleracion: { ritmoReciente: null, ritmoPrevio: null, direccion: "sin_datos" },
    porMes: [],
    mejorMes: null,
    peorMes: null,
    racha: null,
    hallazgos: [],
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
  // Banda de predicción al 95%. Una sola línea proyectada finge una precisión
  // que no existe: con pocas fotos y R² bajo, el rango honesto es ancho. Se usa
  // el intervalo de predicción clásico, que se abre al alejarse del centro de
  // los datos: se ± t · sqrt(1 + 1/n + (x−x̄)²/Sxx).
  const gl = n - 2; // grados de libertad
  const se = gl > 0 ? Math.sqrt(ssRes / gl) : null;
  const mediaX = sumX / n;
  const sxx = xs.reduce((a, x) => a + (x - mediaX) ** 2, 0);
  const T95 = 1.96; // normal; con n muy chico subestima un poco, y se avisa
  const margen = (dia: number): number | null => {
    if (se == null || sxx <= 0) return null;
    return T95 * se * Math.sqrt(1 + 1 / n + (dia - mediaX) ** 2 / sxx);
  };

  const puntos: PuntoTendencia[] = puntosValidos.map((p) => {
    const dia = diasEntre(desde, p.fecha);
    const centro = predict(dia);
    // En el tramo histórico la banda solo ensucia: ya está el dato real. La
    // excepción es la ÚLTIMA foto: sin ese punto la banda arrancaría recién a
    // un mes vista y quedaría un hueco entre «hoy» y el rango proyectado.
    const mrg = p.fecha === hasta ? margen(dia) : null;
    return {
      fecha: p.fecha,
      real: r2n(p.bob),
      proyeccion: r2n(centro),
      banda: mrg == null ? null : [r2n(Math.max(0, centro - mrg)), r2n(centro + mrg)],
    };
  });
  for (const m of MESES_HORIZONTE) {
    const fecha = sumarMeses(hasta, m);
    const dia = diasEntre(desde, fecha);
    const centro = predict(dia);
    const mrg = margen(dia);
    puntos.push({
      fecha,
      real: null,
      proyeccion: r2n(centro),
      // El piso no baja de cero: un patrimonio negativo no es un escenario, y
      // dibujarlo desplazaría el eje Y hasta hacer ilegible el resto.
      banda: mrg == null ? null : [r2n(Math.max(0, centro - mrg)), r2n(centro + mrg)],
    });
  }

  // --------------------------------------------------------------------------
  // Lectura del comportamiento: lo que la recta sola no cuenta
  // --------------------------------------------------------------------------

  // Máximo histórico y cuánto estás por debajo de él.
  let maximo = { fecha: puntosValidos[0].fecha, valor: puntosValidos[0].bob };
  for (const p of puntosValidos) if (p.bob > maximo.valor) maximo = { fecha: p.fecha, valor: p.bob };
  const caida = maximo.valor - valorActual;
  const drawdown = {
    monto: r2n(Math.max(0, caida)),
    pct: maximo.valor > 0 ? r4(Math.max(0, caida) / maximo.valor) : 0,
  };

  // Cambio mes a mes: se toma la ÚLTIMA foto de cada mes como cierre, y el
  // cierre del mes anterior como apertura, para que los meses encadenen sin
  // huecos aunque las fotos sean irregulares.
  const cierrePorMes = new Map<string, number>();
  for (const p of puntosValidos) cierrePorMes.set(p.fecha.slice(0, 7), p.bob);
  const mesesOrdenados = [...cierrePorMes.keys()].sort();
  const porMes: CambioMensual[] = [];
  for (let i = 1; i < mesesOrdenados.length; i++) {
    const inicio = cierrePorMes.get(mesesOrdenados[i - 1])!;
    const fin = cierrePorMes.get(mesesOrdenados[i])!;
    porMes.push({
      period: mesesOrdenados[i],
      inicio: r2n(inicio),
      fin: r2n(fin),
      cambio: r2n(fin - inicio),
      pct: inicio > 0 ? r4((fin - inicio) / inicio) : null,
    });
  }
  const mejorMes = porMes.length ? porMes.reduce((a, b) => (b.cambio > a.cambio ? b : a)) : null;
  const peorMes = porMes.length ? porMes.reduce((a, b) => (b.cambio < a.cambio ? b : a)) : null;

  // Volatilidad: desviación típica de los cambios mensuales. Dice si el ritmo
  // es parejo o a los saltos, que es distinto de si sube o baja.
  let volatilidadMensual: number | null = null;
  if (porMes.length >= 2) {
    const cambios = porMes.map((m) => m.cambio);
    const media = cambios.reduce((a, b) => a + b, 0) / cambios.length;
    const varianza = cambios.reduce((a, c) => a + (c - media) ** 2, 0) / (cambios.length - 1);
    volatilidadMensual = r2n(Math.sqrt(varianza));
  }

  // Racha: meses consecutivos en la misma dirección, desde el último hacia atrás.
  let racha: { meses: number; direccion: "alza" | "baja" } | null = null;
  if (porMes.length > 0) {
    const ultimo = porMes[porMes.length - 1];
    if (ultimo.cambio !== 0) {
      const direccion: "alza" | "baja" = ultimo.cambio > 0 ? "alza" : "baja";
      let cuenta = 0;
      for (let i = porMes.length - 1; i >= 0; i--) {
        const sube = porMes[i].cambio > 0;
        if (porMes[i].cambio === 0 || sube !== (direccion === "alza")) break;
        cuenta++;
      }
      racha = { meses: cuenta, direccion };
    }
  }

  // Aceleración: ritmo de los últimos 90 días contra el de todo lo anterior.
  // Se compara con la MISMA regresión sobre cada tramo, no con el promedio
  // simple, para que un par de fotos juntas no distorsionen la lectura.
  const VENTANA_DIAS = 90;
  const corteReciente = sumarDiasISO(hasta, -VENTANA_DIAS);
  const recientes = puntosValidos.filter((p) => p.fecha >= corteReciente);
  const previos = puntosValidos.filter((p) => p.fecha < corteReciente);
  const pendienteDe = (pts: { fecha: string; bob: number }[]): number | null => {
    if (pts.length < 2) return null;
    const base = pts[0].fecha;
    const px = pts.map((p) => diasEntre(base, p.fecha));
    const py = pts.map((p) => p.bob);
    const k = pts.length;
    const sx = px.reduce((a, b) => a + b, 0);
    const sy = py.reduce((a, b) => a + b, 0);
    const sxy = px.reduce((a, x, i) => a + x * py[i], 0);
    const sxx2 = px.reduce((a, x) => a + x * x, 0);
    const den = k * sxx2 - sx * sx;
    return den !== 0 ? (k * sxy - sx * sy) / den : null;
  };
  const pReciente = pendienteDe(recientes);
  const pPrevio = pendienteDe(previos);
  const ritmoReciente = pReciente != null ? r2n(pReciente * DIAS_MES) : null;
  const ritmoPrevio = pPrevio != null ? r2n(pPrevio * DIAS_MES) : null;
  let direccion: Aceleracion["direccion"] = "sin_datos";
  if (ritmoReciente != null && ritmoPrevio != null) {
    // Umbral relativo: un 15% de diferencia sobre el mayor de los dos, para no
    // llamar "aceleración" al ruido.
    const escala = Math.max(Math.abs(ritmoReciente), Math.abs(ritmoPrevio), 1);
    const delta = (ritmoReciente - ritmoPrevio) / escala;
    direccion = delta > 0.15 ? "acelerando" : delta < -0.15 ? "desacelerando" : "estable";
  }
  const aceleracion: Aceleracion = { ritmoReciente, ritmoPrevio, direccion };

  // --- Hallazgos: lo anterior traducido a frases accionables ---
  const hallazgos: Hallazgo[] = [];
  if (n < 5) {
    hallazgos.push({
      id: "pocas-fotos",
      titulo: "Pocos datos todavía",
      detalle: `La proyección se apoya en ${n} fotos. Con más historial las bandas se van a cerrar bastante.`,
      tono: "aviso",
    });
  }
  if (r2 < 0.5) {
    hallazgos.push({
      id: "ajuste-bajo",
      titulo: "Tu patrimonio no sigue una recta",
      detalle: `El ajuste explica solo el ${Math.round(r2 * 100)}% de la variación: se mueve más a saltos que en línea. La banda del gráfico es la lectura honesta, no la línea del centro.`,
      tono: "aviso",
    });
  }
  if (direccion !== "sin_datos" && direccion !== "estable") {
    hallazgos.push({
      id: "aceleracion",
      titulo: direccion === "acelerando" ? "El ritmo se está acelerando" : "El ritmo se está frenando",
      detalle: `Últimos ${VENTANA_DIAS} días: ${fmtSigno(ritmoReciente!)} Bs/mes, contra ${fmtSigno(ritmoPrevio!)} Bs/mes antes.`,
      // Acelerar hacia abajo no es una buena noticia: el tono mira el signo del
      // ritmo actual, no solo si el cambio fue a más o a menos.
      tono: ritmoReciente! >= 0 && direccion === "acelerando" ? "bueno" : "aviso",
    });
  }
  if (drawdown.pct > 0.02) {
    hallazgos.push({
      id: "drawdown",
      titulo: `Estás ${Math.round(drawdown.pct * 1000) / 10}% por debajo de tu máximo`,
      detalle: `El pico fue ${fmt(maximo.valor)} Bs el ${fechaLarga(maximo.fecha)}; te faltan ${fmt(drawdown.monto)} Bs para recuperarlo.`,
      tono: drawdown.pct > 0.1 ? "malo" : "aviso",
    });
  } else if (valorActual >= maximo.valor) {
    hallazgos.push({
      id: "maximo",
      titulo: "Estás en tu máximo histórico",
      detalle: `Nunca tuviste más que ahora: ${fmt(valorActual)} Bs.`,
      tono: "bueno",
    });
  }
  if (racha && racha.meses >= 2) {
    hallazgos.push({
      id: "racha",
      titulo: `${racha.meses} meses seguidos ${racha.direccion === "alza" ? "al alza" : "a la baja"}`,
      detalle:
        racha.direccion === "alza"
          ? "La tendencia viene sostenida, no es un mes suelto."
          : "Van varios meses cayendo; conviene mirar gastos y aportes.",
      tono: racha.direccion === "alza" ? "bueno" : "malo",
    });
  }
  if (volatilidadMensual != null && Math.abs(ritmoMensual) > 0) {
    const ruido = volatilidadMensual / Math.abs(ritmoMensual);
    if (ruido > 2) {
      hallazgos.push({
        id: "volatilidad",
        titulo: "Meses muy desiguales",
        detalle: `La variación típica entre meses (±${fmt(volatilidadMensual)} Bs) es ${Math.round(ruido)}× tu ritmo promedio: el resultado de un mes dice poco por sí solo.`,
        tono: "neutro",
      });
    }
  }
  if (mejorMes && peorMes && mejorMes.period !== peorMes.period) {
    hallazgos.push({
      id: "extremos",
      titulo: "Tu mejor y tu peor mes",
      detalle: `${nombreMes(mejorMes.period)} sumó ${fmtSigno(mejorMes.cambio)} Bs; ${nombreMes(peorMes.period)} ${fmtSigno(peorMes.cambio)} Bs.`,
      tono: "neutro",
    });
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
    errorEstandar: se != null ? r2n(se) : null,
    volatilidadMensual,
    maximo: { fecha: maximo.fecha, valor: r2n(maximo.valor) },
    drawdown,
    aceleracion,
    porMes,
    mejorMes,
    peorMes,
    racha,
    hallazgos,
  };
}

function sumarDiasISO(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function fmtSigno(n: number): string {
  return `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
}
function nombreMes(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
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
