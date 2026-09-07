// Detección de patrones de gasto. Lógica pura (sin red) sobre las
// transacciones ya convertidas a BOB.
//
// La regla de este archivo: **no afirmar lo que los datos no sostienen**. Cada
// patrón exige un mínimo de observaciones y, cuando la muestra es corta, o se
// omite o se marca como tentativo. Un dashboard que inventa patrones es peor
// que uno que no los busca.

import type { TransactionUI } from "@/lib/types";

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function r2n(n: number): number {
  return Math.round(n * 100) / 100;
}
function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
/** Día de la semana (0=domingo) de una fecha 'YYYY-MM-DD', anclada al mediodía. */
function diaSemana(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}
function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
function mediana(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface GastoPorDiaSemana {
  dia: number; // 0 = domingo
  nombre: string;
  total: number;
  promedio: number; // por día de calendario con ese nombre en el rango
  movimientos: number;
}

export interface CategoriaEnMovimiento {
  categoria: string;
  actual: number; // gastado en el mes en curso
  /** Promedio de lo gastado en los mismos días del mes, en los meses previos. */
  referencia: number;
  variacion: number; // actual − referencia
  pct: number | null; // variacion / referencia
  meses: number; // meses de referencia usados
}

export interface GastoRecurrente {
  descripcion: string;
  categoria: string | null;
  montoTipico: number;
  vecesVisto: number;
  cadaDias: number; // mediana del intervalo entre apariciones
  ultima: string;
  proximaEstimada: string;
}

export interface MesGasto {
  period: string;
  gasto: number;
  ingreso: number;
  neto: number;
  tasaAhorro: number | null; // neto / ingreso, null si no hubo ingresos
}

export interface Hallazgo {
  id: string;
  titulo: string;
  detalle: string;
  tono: "bueno" | "malo" | "neutro" | "aviso";
}

export interface AnalisisGastos {
  suficienteData: boolean;
  movimientos: number;
  desde: string | null;
  hasta: string | null;
  gastoDiarioPromedio: number | null;
  porDiaSemana: GastoPorDiaSemana[];
  diaMasCaro: GastoPorDiaSemana | null;
  categoriasEnAlza: CategoriaEnMovimiento[];
  categoriasEnBaja: CategoriaEnMovimiento[];
  recurrentes: GastoRecurrente[];
  porMes: MesGasto[];
  tasaAhorroPromedio: number | null;
  /** Cuántos de los últimos 30 días no tuvieron ningún gasto. */
  diasSinGastar: number | null;
  concentracion: { top3Pct: number; categorias: string[] } | null;
  hallazgos: Hallazgo[];
}

const MIN_MOVIMIENTOS = 10;

export function analizarGastos(
  transacciones: TransactionUI[],
  hoy: string
): AnalisisGastos {
  const gastos = transacciones
    .filter((t) => t.type === "gasto" && t.txn_date && Number.isFinite(t.amount_bob))
    .sort((a, b) => a.txn_date.localeCompare(b.txn_date));
  const ingresos = transacciones.filter((t) => t.type === "ingreso" && t.txn_date);

  const vacio: AnalisisGastos = {
    suficienteData: false,
    movimientos: gastos.length,
    desde: null,
    hasta: null,
    gastoDiarioPromedio: null,
    porDiaSemana: [],
    diaMasCaro: null,
    categoriasEnAlza: [],
    categoriasEnBaja: [],
    recurrentes: [],
    porMes: [],
    tasaAhorroPromedio: null,
    diasSinGastar: null,
    concentracion: null,
    hallazgos: [],
  };
  if (gastos.length < MIN_MOVIMIENTOS) return vacio;

  const desde = gastos[0].txn_date;
  const hasta = gastos[gastos.length - 1].txn_date;
  const diasRango = Math.max(1, diasEntre(desde, hoy) + 1);
  const totalGastado = gastos.reduce((s, t) => s + t.amount_bob, 0);
  const gastoDiarioPromedio = r2n(totalGastado / diasRango);

  // --- Por día de la semana -------------------------------------------------
  // El promedio se divide por cuántos lunes (martes…) hubo realmente en el
  // rango, no por el número de movimientos: si no, un día con pocas compras
  // pero grandes parecería el más caro solo por tener menos filas.
  const cuentaDeCadaDia = new Array(7).fill(0);
  for (let i = 0; i < diasRango; i++) {
    const d = new Date(`${desde}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    cuentaDeCadaDia[d.getUTCDay()]++;
  }
  const acumPorDia = new Array(7).fill(0);
  const movsPorDia = new Array(7).fill(0);
  for (const t of gastos) {
    const d = diaSemana(t.txn_date);
    acumPorDia[d] += t.amount_bob;
    movsPorDia[d]++;
  }
  const porDiaSemana: GastoPorDiaSemana[] = acumPorDia.map((total, dia) => ({
    dia,
    nombre: DIAS_SEMANA[dia],
    total: r2n(total),
    promedio: cuentaDeCadaDia[dia] > 0 ? r2n(total / cuentaDeCadaDia[dia]) : 0,
    movimientos: movsPorDia[dia],
  }));
  const diaMasCaro = porDiaSemana.reduce((a, b) => (b.promedio > a.promedio ? b : a));

  // --- Por mes: gasto, ingreso y tasa de ahorro -----------------------------
  const mesesMapa = new Map<string, { gasto: number; ingreso: number }>();
  const tocaMes = (period: string) => {
    if (!mesesMapa.has(period)) mesesMapa.set(period, { gasto: 0, ingreso: 0 });
    return mesesMapa.get(period)!;
  };
  for (const t of gastos) tocaMes(t.txn_date.slice(0, 7)).gasto += t.amount_bob;
  for (const t of ingresos) tocaMes(t.txn_date.slice(0, 7)).ingreso += t.amount_bob;
  const porMes: MesGasto[] = [...mesesMapa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, v]) => ({
      period,
      gasto: r2n(v.gasto),
      ingreso: r2n(v.ingreso),
      neto: r2n(v.ingreso - v.gasto),
      tasaAhorro: v.ingreso > 0 ? r4((v.ingreso - v.gasto) / v.ingreso) : null,
    }));
  const conIngreso = porMes.filter((m) => m.tasaAhorro != null);
  const tasaAhorroPromedio = conIngreso.length
    ? r4(conIngreso.reduce((s, m) => s + m.tasaAhorro!, 0) / conIngreso.length)
    : null;

  // --- Categorías en movimiento: mes en curso vs. meses previos completos ---
  const mesActual = hoy.slice(0, 7);
  const previos = [...new Set(gastos.map((t) => t.txn_date.slice(0, 7)))]
    .filter((m) => m < mesActual)
    .sort()
    .slice(-3); // hasta 3 meses de referencia
  const gastoPorCatMes = new Map<string, Map<string, number>>();
  for (const t of gastos) {
    const cat = t.category?.name ?? "Sin categoría";
    const mes = t.txn_date.slice(0, 7);
    if (!gastoPorCatMes.has(cat)) gastoPorCatMes.set(cat, new Map());
    const m = gastoPorCatMes.get(cat)!;
    m.set(mes, (m.get(mes) ?? 0) + t.amount_bob);
  }
  // El mes en curso está a medias, así que compararlo con meses COMPLETOS haría
  // que el día 7 toda categoría sin gastar todavía apareciera con «−100%».
  //
  // Prorratear el promedio mensual tampoco sirve: asume que el gasto se reparte
  // parejo, y no es así (el alquiler cae el 1, el mercado el 20…). Se compara
  // la MISMA ventana de días: lo que va del 1 al día de hoy contra lo que iba
  // del 1 al mismo día en cada mes previo. Sin supuestos y exacto.
  const diaDelMes = Number(hoy.slice(8, 10));

  const enMovimiento: CategoriaEnMovimiento[] = [];
  // Los primeros días la muestra es tan chica que un gasto suelto se dispara a
  // porcentajes absurdos; por debajo de una semana no se compara nada.
  if (previos.length >= 2 && diaDelMes >= 7) {
    // Gasto por categoría y mes, contando solo los días 1..diaDelMes.
    const hastaElDia = new Map<string, Map<string, number>>();
    for (const t of gastos) {
      if (Number(t.txn_date.slice(8, 10)) > diaDelMes) continue;
      const cat = t.category?.name ?? "Sin categoría";
      const mes = t.txn_date.slice(0, 7);
      if (!hastaElDia.has(cat)) hastaElDia.set(cat, new Map());
      const m = hastaElDia.get(cat)!;
      m.set(mes, (m.get(mes) ?? 0) + t.amount_bob);
    }

    for (const [categoria, porM] of hastaElDia) {
      const refs = previos.map((m) => porM.get(m) ?? 0);
      const referencia = refs.reduce((a, b) => a + b, 0) / refs.length;
      const actual = porM.get(mesActual) ?? 0;
      // Se descartan las categorías marginales: un salto de 20 a 60 Bs es un
      // +200% que no significa nada y taparía a los movimientos que importan.
      if (referencia < 50 && actual < 50) continue;
      enMovimiento.push({
        categoria,
        actual: r2n(actual),
        referencia: r2n(referencia),
        variacion: r2n(actual - referencia),
        pct: referencia > 0 ? r4((actual - referencia) / referencia) : null,
        meses: previos.length,
      });
    }
  }
  const categoriasEnAlza = enMovimiento
    .filter((c) => c.pct != null && c.pct > 0.2)
    .sort((a, b) => b.variacion - a.variacion)
    .slice(0, 5);
  const categoriasEnBaja = enMovimiento
    .filter((c) => c.pct != null && c.pct < -0.2)
    .sort((a, b) => a.variacion - b.variacion)
    .slice(0, 5);

  // --- Gastos recurrentes ---------------------------------------------------
  // Se agrupan por descripción normalizada. Se exige al menos 3 apariciones,
  // intervalos parecidos entre sí y montos parecidos: con dos apariciones
  // cualquier par de gastos "sería" recurrente.
  const norm = (s: string | null) =>
    (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const grupos = new Map<string, TransactionUI[]>();
  for (const t of gastos) {
    const k = norm(t.description);
    if (k.length < 3) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(t);
  }
  const recurrentes: GastoRecurrente[] = [];
  for (const [, items] of grupos) {
    if (items.length < 3) continue;
    const fechas = items.map((t) => t.txn_date);
    const intervalos: number[] = [];
    for (let i = 1; i < fechas.length; i++) intervalos.push(diasEntre(fechas[i - 1], fechas[i]));
    if (intervalos.some((d) => d <= 0)) continue; // varios el mismo día: no es cadencia
    const cadaDias = Math.round(mediana(intervalos));
    if (cadaDias < 5 || cadaDias > 100) continue; // ni diario ni una vez al año
    // Los intervalos tienen que parecerse: ±40% de la mediana.
    const regular = intervalos.every((d) => Math.abs(d - cadaDias) <= cadaDias * 0.4);
    if (!regular) continue;
    const montos = items.map((t) => t.amount_bob);
    const montoTipico = mediana(montos);
    const montoEstable = montos.every((m) => Math.abs(m - montoTipico) <= Math.max(5, montoTipico * 0.25));
    if (!montoEstable) continue;
    const ultima = fechas[fechas.length - 1];
    const d = new Date(`${ultima}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + cadaDias);
    recurrentes.push({
      descripcion: items[items.length - 1].description ?? "",
      categoria: items[items.length - 1].category?.name ?? null,
      montoTipico: r2n(montoTipico),
      vecesVisto: items.length,
      cadaDias,
      ultima,
      proximaEstimada: d.toISOString().slice(0, 10),
    });
  }
  recurrentes.sort((a, b) => b.montoTipico * (30 / b.cadaDias) - a.montoTipico * (30 / a.cadaDias));

  // --- Días sin gastar en los últimos 30 -----------------------------------
  const hace30 = new Date(`${hoy}T12:00:00Z`);
  hace30.setUTCDate(hace30.getUTCDate() - 29);
  const desde30 = hace30.toISOString().slice(0, 10);
  const conGasto = new Set(gastos.filter((t) => t.txn_date >= desde30 && t.txn_date <= hoy).map((t) => t.txn_date));
  const diasSinGastar = 30 - conGasto.size;

  // --- Concentración: ¿cuánto pesan las 3 categorías más grandes? ----------
  const porCat = new Map<string, number>();
  for (const t of gastos) {
    const cat = t.category?.name ?? "Sin categoría";
    porCat.set(cat, (porCat.get(cat) ?? 0) + t.amount_bob);
  }
  const orden = [...porCat.entries()].sort((a, b) => b[1] - a[1]);
  const top3 = orden.slice(0, 3);
  const concentracion = totalGastado > 0
    ? {
        top3Pct: r4(top3.reduce((s, [, v]) => s + v, 0) / totalGastado),
        categorias: top3.map(([n]) => n),
      }
    : null;

  // --- Hallazgos ------------------------------------------------------------
  const hallazgos: Hallazgo[] = [];
  const promedioDiario = porDiaSemana.reduce((s, d) => s + d.promedio, 0) / 7;
  if (promedioDiario > 0 && diaMasCaro.promedio > promedioDiario * 1.5 && diaMasCaro.movimientos >= 3) {
    hallazgos.push({
      id: "dia-caro",
      titulo: `Los ${diaMasCaro.nombre} son tu día más caro`,
      detalle: `Gastás ${fmt(diaMasCaro.promedio)} Bs en promedio, ${(diaMasCaro.promedio / promedioDiario).toFixed(1)}× un día cualquiera.`,
      tono: "neutro",
    });
  }
  for (const c of categoriasEnAlza.slice(0, 2)) {
    hallazgos.push({
      id: `alza-${c.categoria}`,
      titulo: `${c.categoria} subió ${Math.round(c.pct! * 100)}% este mes`,
      detalle: `Vas ${fmt(c.actual)} Bs contra los ${fmt(c.referencia)} Bs que llevabas a esta altura del mes en los ${c.meses} meses previos.`,
      tono: "aviso",
    });
  }
  for (const c of categoriasEnBaja.slice(0, 1)) {
    hallazgos.push({
      id: `baja-${c.categoria}`,
      titulo: `${c.categoria} bajó ${Math.round(Math.abs(c.pct!) * 100)}% este mes`,
      detalle: `Vas ${fmt(c.actual)} Bs contra los ${fmt(c.referencia)} Bs que llevabas a esta altura del mes.`,
      tono: "bueno",
    });
  }
  if (recurrentes.length > 0) {
    const mensual = recurrentes.reduce((s, r) => s + r.montoTipico * (30 / r.cadaDias), 0);
    hallazgos.push({
      id: "recurrentes",
      titulo: `${recurrentes.length} gasto(s) que se repiten`,
      detalle: `Se van solos unos ${fmt(mensual)} Bs al mes. El más pesado: ${recurrentes[0].descripcion} (${fmt(recurrentes[0].montoTipico)} Bs cada ${recurrentes[0].cadaDias} días).`,
      tono: "neutro",
    });
  }
  if (concentracion && concentracion.top3Pct > 0.7) {
    hallazgos.push({
      id: "concentracion",
      titulo: "Tu gasto se concentra en pocas categorías",
      detalle: `${Math.round(concentracion.top3Pct * 100)}% se va en ${concentracion.categorias.join(", ")}. Ahí es donde un recorte se nota.`,
      tono: "neutro",
    });
  }
  if (tasaAhorroPromedio != null) {
    hallazgos.push({
      id: "ahorro",
      titulo: tasaAhorroPromedio >= 0.2 ? "Buena tasa de ahorro" : tasaAhorroPromedio >= 0 ? "Ahorro ajustado" : "Estás gastando más de lo que entra",
      detalle: `De cada 100 Bs que entran te quedan ${Math.round(tasaAhorroPromedio * 100)} Bs, promediando ${conIngreso.length} mes(es) con ingresos registrados.`,
      tono: tasaAhorroPromedio >= 0.2 ? "bueno" : tasaAhorroPromedio >= 0 ? "neutro" : "malo",
    });
  }
  if (diasSinGastar >= 10) {
    hallazgos.push({
      id: "dias-sin-gastar",
      titulo: `${diasSinGastar} de los últimos 30 días sin gastar`,
      detalle: "O tuviste días tranquilos, o quedaron movimientos sin registrar.",
      tono: "neutro",
    });
  }

  return {
    suficienteData: true,
    movimientos: gastos.length,
    desde,
    hasta,
    gastoDiarioPromedio,
    porDiaSemana,
    diaMasCaro,
    categoriasEnAlza,
    categoriasEnBaja,
    recurrentes,
    porMes,
    tasaAhorroPromedio,
    diasSinGastar,
    concentracion,
    hallazgos,
  };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(n);
}
