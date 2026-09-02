// Plantillas HTML de correo (estilo inline + tablas, compatibles con Gmail).
// Paleta verde de la marca.

const VERDE = "#15803d";
const VERDE_CLARO = "#dcfce7";
const TEXTO = "#3a3a3a";
const GRIS = "#6b7280";
const BORDE = "#e5e7eb";
const FONDO = "#f5f5f0";

function bob(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function usd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-BO", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-BO", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
}
function fechaLarga(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

function layout(titulo: string, contenido: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${FONDO};font-family:Arial,Helvetica,sans-serif;color:${TEXTO};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FONDO};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDE};border-radius:14px;overflow:hidden;">
        <tr><td style="background:${VERDE};padding:18px 24px;">
          <table role="presentation" width="100%"><tr>
            <td style="color:#ffffff;font-size:18px;font-weight:bold;">🪙 MyMoney</td>
            <td align="right" style="color:#d1fae5;font-size:13px;">${titulo}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px;">${contenido}</td></tr>
        <tr><td style="padding:14px 24px;background:${FONDO};color:${GRIS};font-size:11px;text-align:center;">
          Correo automático de MyMoney · generado el ${fechaLarga(new Date().toISOString().slice(0, 10))}
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function kpi(label: string, valor: string, sub?: string, color = TEXTO): string {
  return `<td style="padding:6px;" width="50%">
    <table role="presentation" width="100%" style="background:${FONDO};border:1px solid ${BORDE};border-radius:10px;">
      <tr><td style="padding:12px 14px;">
        <div style="font-size:11px;color:${GRIS};text-transform:uppercase;letter-spacing:.4px;">${label}</div>
        <div style="font-size:20px;font-weight:bold;color:${color};margin-top:4px;">${valor}</div>
        ${sub ? `<div style="font-size:11px;color:${GRIS};margin-top:2px;">${sub}</div>` : ""}
      </td></tr>
    </table>
  </td>`;
}

// ============================================================================
// Correo diario de patrimonio (mini-dashboard)
// ============================================================================

export interface PatrimonioEmailData {
  fecha: string;
  totalBob: number;
  totalUsd: number;
  tc: number;
  deltaBob: number | null;
  deltaPct: number | null;
  disponibilidad: number | null;
  porCobrar: number | null;
  activos: number | null;
  dpf: { capital: number; gananciaLiquida: number; proxima: { titulo: string; fecha: string; monto: number; dias: number } | null } | null;
}

export function htmlPatrimonioDiario(d: PatrimonioEmailData): { subject: string; html: string; text: string } {
  const sube = (d.deltaBob ?? 0) >= 0;
  const deltaColor = d.deltaBob == null ? GRIS : sube ? VERDE : "#dc2626";
  const deltaTxt =
    d.deltaBob == null
      ? "Sin comparación"
      : `${sube ? "▲" : "▼"} ${bob(Math.abs(d.deltaBob))}${d.deltaPct != null ? ` (${pct(d.deltaPct)})` : ""} vs. día anterior`;

  const hero = `
    <div style="text-align:center;padding:8px 0 16px;">
      <div style="font-size:12px;color:${GRIS};text-transform:uppercase;letter-spacing:.5px;">Patrimonio neto · ${fechaLarga(d.fecha)}</div>
      <div style="font-size:34px;font-weight:bold;color:${VERDE};margin-top:6px;">${bob(d.totalBob)}</div>
      <div style="font-size:14px;color:${GRIS};margin-top:2px;">${usd(d.totalUsd)} · T/C ${d.tc.toFixed(2)}</div>
      <div style="display:inline-block;margin-top:10px;padding:5px 12px;border-radius:999px;background:${VERDE_CLARO};color:${deltaColor};font-size:13px;font-weight:bold;">${deltaTxt}</div>
    </div>`;

  const kpis = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
      <tr>
        ${kpi("Disponibilidad rápida", bob(d.disponibilidad), "Efectivo + banco + stablecoins", VERDE)}
        ${kpi("Capital en DPF", d.dpf ? bob(d.dpf.capital) : "—", d.dpf ? `Ganancia líq. ${bob(d.dpf.gananciaLiquida)}` : undefined)}
      </tr>
      <tr>
        ${kpi("Por cobrar (deudas)", bob(d.porCobrar))}
        ${kpi("Activos (patrimonio)", bob(d.activos))}
      </tr>
    </table>`;

  const proxima = d.dpf?.proxima
    ? `<table role="presentation" width="100%" style="margin-top:14px;background:${VERDE_CLARO};border-radius:10px;">
        <tr><td style="padding:12px 14px;">
          <div style="font-size:12px;color:${VERDE};font-weight:bold;">📅 Próxima liberación de DPF</div>
          <div style="font-size:13px;color:${TEXTO};margin-top:4px;">
            <strong>${d.dpf.proxima.titulo}</strong> — vence ${fechaLarga(d.dpf.proxima.fecha)}
            (${d.dpf.proxima.dias < 0 ? "vencido" : `en ${d.dpf.proxima.dias} días`}) ·
            <strong>${bob(d.dpf.proxima.monto)}</strong>
          </div>
        </td></tr>
      </table>`
    : "";

  const html = layout("Resumen diario", hero + kpis + proxima);
  const text = `Patrimonio ${fechaLarga(d.fecha)}: ${bob(d.totalBob)} (${usd(d.totalUsd)}). ${deltaTxt}. Disponibilidad: ${bob(d.disponibilidad)}.`;
  return { subject: `MyMoney · Patrimonio ${bob(d.totalBob)} (${fechaLarga(d.fecha)})`, html, text };
}

// ============================================================================
// Correo de alerta: DPF que vence hoy
// ============================================================================

export interface DpfAlertaItem {
  titulo: string;
  fecha: string;
  capital: number;
  montoAlVencimiento: number;
  ganancia: number;
  tasa: number;
}

export function htmlDpfAlerta(items: DpfAlertaItem[], hoy: string): { subject: string; html: string; text: string } {
  const totalLiberado = items.reduce((s, i) => s + i.montoAlVencimiento, 0);
  const totalGanancia = items.reduce((s, i) => s + i.ganancia, 0);

  const filas = items
    .map(
      (i) => `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid ${BORDE};font-size:13px;"><strong>${i.titulo}</strong><br><span style="color:${GRIS};font-size:11px;">${pct(i.tasa)} anual</span></td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BORDE};font-size:13px;text-align:right;">${bob(i.capital)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BORDE};font-size:13px;text-align:right;color:${VERDE};"><strong>${bob(i.montoAlVencimiento)}</strong><br><span style="font-size:11px;">+${bob(i.ganancia)}</span></td>
      </tr>`
    )
    .join("");

  const contenido = `
    <div style="text-align:center;padding-bottom:12px;">
      <div style="font-size:15px;font-weight:bold;color:${VERDE};">🔔 Hoy se libera ${items.length === 1 ? "un DPF" : `${items.length} DPF`}</div>
      <div style="font-size:12px;color:${GRIS};margin-top:2px;">${fechaLarga(hoy)}</div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${kpi("Se libera hoy", bob(totalLiberado), "Capital + interés", VERDE)}
        ${kpi("Ganancia líquida", bob(totalGanancia))}
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border:1px solid ${BORDE};border-radius:10px;overflow:hidden;">
      <tr style="background:${FONDO};">
        <td style="padding:8px 12px;font-size:11px;color:${GRIS};text-transform:uppercase;">DPF</td>
        <td style="padding:8px 12px;font-size:11px;color:${GRIS};text-transform:uppercase;text-align:right;">Capital</td>
        <td style="padding:8px 12px;font-size:11px;color:${GRIS};text-transform:uppercase;text-align:right;">Al vencimiento</td>
      </tr>
      ${filas}
    </table>
    <div style="margin-top:14px;font-size:12px;color:${GRIS};">
      Recuerda cobrar y decidir si reinviertes (laddering). Marca el DPF como <em>cobrado</em> en la app e indica a qué cuenta ingresó.
    </div>`;

  const text = `Hoy vence(n) ${items.length} DPF. Se libera ${bob(totalLiberado)} (ganancia ${bob(totalGanancia)}).`;
  return { subject: `MyMoney · 🔔 Hoy se libera ${items.length === 1 ? "un DPF" : `${items.length} DPF`} (${bob(totalLiberado)})`, html: contenido.length ? layout("Alerta de DPF", contenido) : "", text };
}

// ============================================================================
// Resumen semanal (lunes)
// ============================================================================

function listaCategorias(items: { nombre: string; monto: number }[]): string {
  if (!items.length) return `<div style="color:${GRIS};font-size:12px;">Sin gastos por categoría.</div>`;
  return items
    .map(
      (c) => `<tr>
        <td style="padding:6px 0;font-size:13px;">${c.nombre}</td>
        <td style="padding:6px 0;font-size:13px;text-align:right;font-weight:bold;">${bob(c.monto)}</td>
      </tr>`
    )
    .join("");
}

function deltaChip(deltaBob: number | null, deltaPct: number | null, label: string): string {
  if (deltaBob == null) return `<div style="color:${GRIS};font-size:12px;">Sin comparación de patrimonio.</div>`;
  const sube = deltaBob >= 0;
  const color = sube ? VERDE : "#dc2626";
  return `<div style="display:inline-block;padding:5px 12px;border-radius:999px;background:${VERDE_CLARO};color:${color};font-size:13px;font-weight:bold;">
    ${sube ? "▲" : "▼"} ${bob(Math.abs(deltaBob))}${deltaPct != null ? ` (${pct(deltaPct)})` : ""} <span style="font-weight:normal;color:${GRIS};">${label}</span>
  </div>`;
}

export interface SemanalEmailData {
  fecha: string;
  gasto7: number;
  topCategorias: { nombre: string; monto: number }[];
  deltaPatrimonioBob: number | null;
  deltaPatrimonioPct: number | null;
  dpfProximos: { titulo: string; fecha: string; monto: number; dias: number }[];
  presupuestoPct: number | null;
  presupuestoExcedidas: number;
}

export function htmlResumenSemanal(d: SemanalEmailData): { subject: string; html: string; text: string } {
  const dpf = d.dpfProximos.length
    ? `<div style="margin-top:14px;"><div style="font-size:12px;font-weight:bold;color:${VERDE};">📅 DPF que vencen esta semana</div>
        ${d.dpfProximos
          .map((i) => `<div style="font-size:13px;color:${TEXTO};margin-top:4px;">• <strong>${i.titulo}</strong> — ${fechaLarga(i.fecha)} (${i.dias <= 0 ? "hoy/vencido" : `en ${i.dias} d`}) · ${bob(i.monto)}</div>`)
          .join("")}</div>`
    : "";
  const presu = d.presupuestoPct != null
    ? `<div style="margin-top:14px;font-size:13px;color:${TEXTO};">🎯 Presupuesto del mes: <strong>${pct(d.presupuestoPct)}</strong> usado${d.presupuestoExcedidas > 0 ? ` · <span style="color:#dc2626;">${d.presupuestoExcedidas} categoría(s) excedida(s)</span>` : ""}.</div>`
    : "";

  const contenido = `
    <div style="text-align:center;padding-bottom:10px;">
      <div style="font-size:15px;font-weight:bold;color:${VERDE};">🗓️ Resumen de la semana</div>
      <div style="font-size:12px;color:${GRIS};">${fechaLarga(d.fecha)}</div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${kpi("Gasto de la semana", bob(d.gasto7), "Últimos 7 días", "#dc2626")}
        ${kpi("Patrimonio", "", "vs. hace 7 días")}
      </tr>
    </table>
    <div style="text-align:center;margin:6px 0 4px;">${deltaChip(d.deltaPatrimonioBob, d.deltaPatrimonioPct, "en 7 días")}</div>
    <div style="margin-top:14px;font-size:12px;color:${GRIS};text-transform:uppercase;letter-spacing:.4px;">Top gastos por categoría</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;border-top:1px solid ${BORDE};">
      ${listaCategorias(d.topCategorias)}
    </table>
    ${dpf}
    ${presu}`;
  const text = `Resumen semanal: gasto ${bob(d.gasto7)}. Patrimonio ${d.deltaPatrimonioBob != null ? (d.deltaPatrimonioBob >= 0 ? "+" : "") + bob(d.deltaPatrimonioBob) : "—"} en 7 días.`;
  return { subject: `MyMoney · 🗓️ Resumen semanal (gasto ${bob(d.gasto7)})`, html: layout("Resumen semanal", contenido), text };
}

// ============================================================================
// Reporte mensual (primer lunes del mes) — del mes que acaba de cerrar
// ============================================================================

export interface MensualEmailData {
  period: string; // 'YYYY-MM' reportado
  gastoMes: number;
  ingresoMes: number;
  topCategorias: { nombre: string; monto: number }[];
  deltaPatrimonioBob: number | null;
  deltaPatrimonioPct: number | null;
  presupuestoPlaneado: number;
  presupuestoGastado: number;
  presupuestoExcedidas: number;
  dpfCobrados: number;
  gananciaDpfMes: number;
}

function nombreMesPeriodo(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function htmlReporteMensual(d: MensualEmailData): { subject: string; html: string; text: string } {
  const balance = d.ingresoMes - d.gastoMes;
  const presu = d.presupuestoPlaneado > 0
    ? `<div style="margin-top:14px;font-size:13px;color:${TEXTO};">🎯 Presupuesto: gastaste <strong>${bob(d.presupuestoGastado)}</strong> de <strong>${bob(d.presupuestoPlaneado)}</strong>${d.presupuestoExcedidas > 0 ? ` · <span style="color:#dc2626;">${d.presupuestoExcedidas} excedida(s)</span>` : " · dentro del plan 👏"}.</div>`
    : "";
  const dpf = d.dpfCobrados > 0
    ? `<div style="margin-top:8px;font-size:13px;color:${TEXTO};">🪙 DPF cobrados este mes: <strong>${d.dpfCobrados}</strong> · ganancia ${bob(d.gananciaDpfMes)}.</div>`
    : "";

  const contenido = `
    <div style="text-align:center;padding-bottom:10px;">
      <div style="font-size:15px;font-weight:bold;color:${VERDE};">📈 Reporte de ${nombreMesPeriodo(d.period)}</div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${kpi("Gasto del mes", bob(d.gastoMes), undefined, "#dc2626")}
        ${kpi("Ingreso del mes", bob(d.ingresoMes), undefined, VERDE)}
      </tr>
      <tr>
        ${kpi("Balance", `${balance >= 0 ? "+" : ""}${bob(balance)}`, "Ingreso − gasto", balance >= 0 ? VERDE : "#dc2626")}
        ${kpi("Patrimonio", "", "vs. inicio de mes")}
      </tr>
    </table>
    <div style="text-align:center;margin:6px 0 4px;">${deltaChip(d.deltaPatrimonioBob, d.deltaPatrimonioPct, "en el mes")}</div>
    <div style="margin-top:14px;font-size:12px;color:${GRIS};text-transform:uppercase;letter-spacing:.4px;">Top gastos por categoría</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;border-top:1px solid ${BORDE};">
      ${listaCategorias(d.topCategorias)}
    </table>
    ${presu}
    ${dpf}`;
  const text = `Reporte ${nombreMesPeriodo(d.period)}: gasto ${bob(d.gastoMes)}, ingreso ${bob(d.ingresoMes)}, balance ${bob(balance)}.`;
  return { subject: `MyMoney · 📈 Reporte de ${nombreMesPeriodo(d.period)}`, html: layout("Reporte mensual", contenido), text };
}
