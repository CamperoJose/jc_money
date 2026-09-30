// Proyección de aperturas mensuales. No escribe datos ni promete rendimientos.
// El patrimonio se estima por tendencia; los flujos registrados son una lectura
// alternativa, NO se suman de nuevo a la tendencia (evita doble contabilización).
import type { TransactionUI, DpfDepositUI, DebtUI } from "./types";
import {
  DIAS_MES,
  diasEntre,
  fechaValida,
  inicioMes,
  normalizarFotos,
  pendiente,
  proximasAperturas,
  redondear,
  sumarDias,
  type FotoTendencia,
} from "./tendencias-fechas";

export interface BaseProyeccion {
  fecha: string;
  bob: number;
  disponible: number | null;
  /** Unidades netas USD+USDT, descontando los pasivos. */
  exposicion: number;
  rate: number | null;
  enVivo: boolean;
}
export type ModeloId = "constante" | "historico" | "reciente";
export interface ValidacionModelo {
  id: ModeloId;
  nombre: string;
  mae: number;
  sesgo: number; // predicción - realidad: positivo = sobreestima
  evaluaciones: number;
}
export interface AperturaMensual {
  fecha: string;
  dias: number; // del corte al cierre inmediatamente anterior al día 1
  patrimonio: number;
  cambio: number;
  cambioPeriodo: number;
  rango: [number, number] | null;
  patrimonioPorFlujos: number | null;
  disponiblePorFlujos: number | null;
  capitalDpf: number; // previsto en el periodo: NO sumado al patrimonio
  porCobrar: number;
  extrapolacion: boolean;
}
export interface FlujosReferencia {
  meses: string[];
  ingresoMensual: number | null;
  gastoMensual: number | null;
  netoMensual: number | null;
  omitidas: number;
  futuras: number;
}
export interface ProyeccionPatrimonio {
  hoy: string;
  base: BaseProyeccion | null;
  diasSinActualizar: number | null;
  modelo: {
    id: ModeloId;
    nombre: string;
    ritmoMensual: number;
    validado: boolean;
  };
  validacion: ValidacionModelo[];
  horizonteEvaluado: number | null;
  horizonteOrientativo: number;
  fotos: number;
  diasHistoria: number;
  descartadas: number;
  aperturas: AperturaMensual[];
  flujos: FlujosReferencia;
  diferenciaRitmos: number | null;
  avisos: string[];
}
const NOMBRES: Record<ModeloId, string> = {
  constante: "Último saldo sin crecimiento",
  historico: "Tendencia histórica",
  reciente: "Tendencia de los últimos 90 días",
};
const MODELOS: ModeloId[] = ["constante", "historico", "reciente"];
const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}
function ritmo(serie: FotoTendencia[], id: ModeloId): number | null {
  if (!serie.length) return null;
  if (id === "constante") return 0;
  const ultima = serie.at(-1)!;
  const usada =
    id === "reciente"
      ? serie.filter((p) => diasEntre(p.fecha, ultima.fecha) <= 90)
      : serie;
  // Varias fotos del mismo día o una semana no justifican una tendencia anual.
  if (usada.length < 6 || diasEntre(usada[0].fecha, usada.at(-1)!.fecha) < 30)
    return null;
  return pendiente(usada);
}
interface Evaluacion {
  errores: number[];
  dias: number[];
}
/** Evalúa el cierre anterior a cada día 1 con solo las fotos que ya existían
 * al inicio de ese mes. Todos los candidatos usan los mismos cortes. No se
 * interpola un cierre ausente ni se introduce el estado vivo en el backtest. */
function validar(serie: FotoTendencia[]): Map<ModeloId, Evaluacion> {
  const resultados = new Map<ModeloId, Evaluacion>(
    MODELOS.map((id) => [id, { errores: [], dias: [] }]),
  );
  if (serie.length < 8) return resultados;
  const desde = inicioMes(serie[0].fecha, 1);
  const hasta = serie.at(-1)!.fecha;
  // Últimos doce cierres: coste acotado incluso con años de registros diarios.
  for (let i = 12; i >= 1; i--) {
    const inicio = inicioMes(hasta, -i + 1);
    const objetivo = sumarDias(inicioMes(inicio, 1), -1);
    if (inicio < desde || objetivo > hasta) continue;
    const train = serie.filter((p) => p.fecha < inicio);
    const observado = serie.findLast((p) => p.fecha <= objetivo);
    if (!train.length || !observado || observado.fecha !== objetivo) continue;
    const slopes = MODELOS.map((id) => ritmo(train, id));
    if (slopes.some((s) => s == null)) continue;
    const base = train.at(-1)!;
    // Una base vieja impediría validar la apertura mensual de manera comparable.
    if (diasEntre(base.fecha, inicio) > 7) continue;
    const h = diasEntre(base.fecha, objetivo);
    MODELOS.forEach((id, j) => {
      const e = resultados.get(id)!;
      e.errores.push(base.bob + slopes[j]! * h - observado.bob);
      e.dias.push(h);
    });
  }
  return resultados;
}

/** Últimos tres meses cerrados CON movimientos, excluyendo el primero si se
 * empezó a registrar a mitad de mes. Los meses vacíos no se inventan como cero.
 * Un T/C ausente invalida ese mes para la referencia de flujos. */
export function resumirFlujos(
  transacciones: TransactionUI[],
  hoy: string,
): FlujosReferencia {
  const futuras = transacciones.filter(
    (t) => fechaValida(t.txn_date) && t.txn_date > hoy,
  ).length;
  const pasadas = transacciones.filter(
    (t) => fechaValida(t.txn_date) && t.txn_date <= hoy,
  );
  const primera = pasadas.map((t) => t.txn_date).sort()[0];
  const mesesInvalidos = new Set<string>();
  let omitidas = transacciones.filter((t) => !fechaValida(t.txn_date)).length;
  const porMes = new Map<string, { ingreso: number; gasto: number }>();
  for (const t of pasadas) {
    const period = t.txn_date.slice(0, 7);
    const rateValido =
      t.currency === "BOB" ||
      (t.exchange_rate != null &&
        Number.isFinite(t.exchange_rate) &&
        t.exchange_rate > 0);
    if (
      !Number.isFinite(t.amount) ||
      t.amount <= 0 ||
      !Number.isFinite(t.amount_bob) ||
      !rateValido
    ) {
      omitidas++;
      mesesInvalidos.add(period);
      continue;
    }
    const m = porMes.get(period) ?? { ingreso: 0, gasto: 0 };
    m[t.type === "ingreso" ? "ingreso" : "gasto"] += t.amount_bob;
    porMes.set(period, m);
  }
  const meses = [-3, -2, -1]
    .map((i) => inicioMes(hoy, i).slice(0, 7))
    .filter(
      (p) =>
        primera &&
        primera <= `${p}-01` &&
        porMes.has(p) &&
        !mesesInvalidos.has(p),
    );
  const suficiente = meses.length >= 2;
  const ingreso = suficiente
    ? media(meses.map((p) => porMes.get(p)!.ingreso))
    : null;
  const gasto = suficiente
    ? media(meses.map((p) => porMes.get(p)!.gasto))
    : null;
  return {
    meses,
    ingresoMensual: ingreso == null ? null : redondear(ingreso),
    gastoMensual: gasto == null ? null : redondear(gasto),
    netoMensual:
      ingreso == null || gasto == null ? null : redondear(ingreso - gasto),
    omitidas,
    futuras,
  };
}

export function proyectarPatrimonio(datos: {
  hoy: string;
  serie: FotoTendencia[];
  base?: BaseProyeccion | null;
  transacciones?: TransactionUI[];
  dpfs?: DpfDepositUI[];
  deudas?: DebtUI[];
  avisos?: string[];
}): ProyeccionPatrimonio {
  const { hoy } = datos;
  const serie = normalizarFotos(datos.serie, hoy);
  const historica = serie.at(-1);
  const candidata = datos.base;
  const base =
    candidata &&
    fechaValida(candidata.fecha) &&
    candidata.fecha <= hoy &&
    Number.isFinite(candidata.bob)
      ? candidata
      : historica
        ? {
            fecha: historica.fecha,
            bob: historica.bob,
            disponible: null,
            exposicion: 0,
            rate: null,
            enVivo: false,
          }
        : null;
  const flujos = resumirFlujos(datos.transacciones ?? [], hoy);
  const avisos = [...(datos.avisos ?? [])];
  const diasHistoria = serie.length
    ? diasEntre(serie[0].fecha, serie.at(-1)!.fecha)
    : 0;
  const bt = validar(serie);
  const validacion: ValidacionModelo[] = MODELOS.flatMap((id) => {
    const e = bt.get(id)!;
    return e.errores.length
      ? [
          {
            id,
            nombre: NOMBRES[id],
            mae: redondear(media(e.errores.map(Math.abs))),
            sesgo: redondear(media(e.errores)),
            evaluaciones: e.errores.length,
          },
        ]
      : [];
  }).sort((a, b) => a.mae - b.mae);
  const validado = (validacion[0]?.evaluaciones ?? 0) >= 4;
  // Sin validación suficiente se prefiere el ritmo reciente, con aviso explícito.
  let elegido: ModeloId =
    ritmo(serie, "reciente") != null
      ? "reciente"
      : ritmo(serie, "historico") != null
        ? "historico"
        : "constante";
  if (validado) {
    const referencia = validacion.find((v) => v.id === "constante")!;
    const mejor = validacion[0];
    elegido = mejor.mae < referencia.mae * 0.95 ? mejor.id : "constante";
  }
  // El backtest decide el ritmo; el valor observado actual ancla el pronóstico.
  const slope = ritmo(serie, elegido) ?? 0;
  const evaluacion = bt.get(elegido)!;
  const hEvaluado = evaluacion.dias.length ? mediana(evaluacion.dias) : null;
  const horizonteOrientativo = Math.min(180, Math.floor(diasHistoria / 2));
  const ordenados = evaluacion.errores.map(Math.abs).sort((a, b) => a - b);
  // Envolvente de errores observados, no un intervalo probabilístico del 95%.
  const errorReferencia = validado ? ordenados.at(-1)! : null;
  if (!validado)
    avisos.push(
      "Estimación provisional: hacen falta al menos cuatro cierres mensuales evaluables para elegir el modelo por error histórico.",
    );
  if (elegido === "constante" && !validado)
    avisos.push(
      "El historial aún no cubre 30 días con seis registros diarios distintos. Se conserva el último saldo; ajusta el escenario para explorar cambios.",
    );
  const diasSinActualizar = base
    ? Math.max(0, diasEntre(base.fecha, hoy))
    : null;
  if (diasSinActualizar && diasSinActualizar > 0)
    avisos.push(
      `La base tiene ${diasSinActualizar} día(s) de antigüedad. Puede faltar actividad posterior.`,
    );
  if (flujos.netoMensual == null)
    avisos.push(
      "Sin dos meses cerrados utilizables entre los últimos tres: no se extrapolan flujos ni disponibilidad.",
    );
  if (flujos.omitidas)
    avisos.push(
      `${flujos.omitidas} movimiento(s) inválidos o sin cotización se excluyeron de la referencia de flujos.`,
    );
  if (flujos.futuras)
    avisos.push(
      `${flujos.futuras} movimiento(s) con fecha futura se excluyeron del histórico de flujos.`,
    );
  avisos.push(
    "El rango orientativo refleja errores pasados y se amplía con el horizonte. No es una probabilidad de acierto ni contempla todos los cambios futuros.",
  );
  const aperturas: AperturaMensual[] = [];
  for (const fecha of proximasAperturas(hoy)) {
    if (!base) break;
    const cierre = sumarDias(fecha, -1);
    const dias = Math.max(0, diasEntre(base.fecha, cierre));
    const patrimonio = redondear(base.bob + slope * dias);
    const margen =
      errorReferencia != null && hEvaluado
        ? errorReferencia * Math.sqrt(dias / hEvaluado)
        : null;
    const desdePeriodo = aperturas.at(-1)?.fecha ?? hoy;
    const dpfs = (datos.dpfs ?? []).filter(
      (d) =>
        d.status === "activo" &&
        fechaValida(d.end_date) &&
        d.end_date >= desdePeriodo &&
        d.end_date < fecha &&
        d.start_date <= hoy,
    );
    const deudas = (datos.deudas ?? []).filter(
      (d) =>
        d.outstanding > 0 &&
        d.status !== "pagado" &&
        d.due_date &&
        fechaValida(d.due_date) &&
        d.due_date >= desdePeriodo &&
        d.due_date < fecha &&
        d.debt_date <= hoy,
    );
    // Si el estado no pudo actualizarse hasta hoy, no se extrapolan flujos
    // desde una base vieja que podría ya incluir o desconocer esos movimientos.
    const neto =
      flujos.netoMensual != null && base.enVivo && base.fecha === hoy
        ? (flujos.netoMensual * dias) / DIAS_MES
        : null;
    aperturas.push({
      fecha,
      dias,
      patrimonio,
      cambio: redondear(patrimonio - base.bob),
      cambioPeriodo: redondear(
        patrimonio - (aperturas.at(-1)?.patrimonio ?? base.bob),
      ),
      rango:
        margen == null
          ? null
          : [redondear(patrimonio - margen), redondear(patrimonio + margen)],
      patrimonioPorFlujos: neto == null ? null : redondear(base.bob + neto),
      disponiblePorFlujos:
        neto == null || base.disponible == null
          ? null
          : redondear(base.disponible + neto),
      capitalDpf: redondear(dpfs.reduce((s, d) => s + d.principal, 0)),
      porCobrar: redondear(deudas.reduce((s, d) => s + d.outstanding, 0)),
      extrapolacion:
        dias > horizonteOrientativo || (hEvaluado != null && dias > hEvaluado),
    });
  }
  return {
    hoy,
    base,
    diasSinActualizar,
    modelo: {
      id: elegido,
      nombre: NOMBRES[elegido],
      ritmoMensual: redondear(slope * DIAS_MES),
      validado,
    },
    validacion,
    horizonteEvaluado: hEvaluado,
    horizonteOrientativo,
    fotos: serie.length,
    diasHistoria,
    descartadas: datos.serie.length - serie.length,
    aperturas,
    flujos,
    diferenciaRitmos:
      flujos.netoMensual == null
        ? null
        : redondear(slope * DIAS_MES - flujos.netoMensual),
    avisos,
  };
}

/** Aporte adicional distribuido por días y shock de T/C sobre la exposición
 * neta actual (USD y USDT). Mantiene el resto de supuestos del modelo base. */
export function aplicarEscenario(
  p: ProyeccionPatrimonio,
  ahorroExtra: number,
  tcPct: number,
): AperturaMensual[] {
  if (!p.base) return [];
  const efectoTc =
    p.base.rate != null ? (p.base.exposicion * p.base.rate * tcPct) / 100 : 0;
  return p.aperturas.map((a, i) => {
    const cambio = (ahorroExtra * a.dias) / DIAS_MES + efectoTc;
    return {
      ...a,
      patrimonio: redondear(a.patrimonio + cambio),
      cambio: redondear(a.cambio + cambio),
      cambioPeriodo: redondear(
        a.cambioPeriodo +
          (ahorroExtra * (a.dias - (p.aperturas[i - 1]?.dias ?? 0))) /
            DIAS_MES +
          (i === 0 ? efectoTc : 0),
      ),
      rango: a.rango
        ? [redondear(a.rango[0] + cambio), redondear(a.rango[1] + cambio)]
        : null,
      patrimonioPorFlujos:
        a.patrimonioPorFlujos == null
          ? null
          : redondear(a.patrimonioPorFlujos + cambio),
      // El shock de valoración del patrimonio no prueba disponibilidad en BOB.
      disponiblePorFlujos:
        a.disponiblePorFlujos == null
          ? null
          : redondear(
              a.disponiblePorFlujos + (ahorroExtra * a.dias) / DIAS_MES,
            ),
    };
  });
}
