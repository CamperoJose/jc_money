import { fechaBoliviaHoy } from "@/lib/datetime";

export interface IngresoRecibo {
  descripcion: string;
  monto: number;
  moneda: string;
  cuenta: string | null;
  categoria: string | null;
}

export interface ReciboVozCompleto {
  fechaHora: string;
  transcripcion: string | null;
  gastos: Array<{
    descripcion: string;
    monto: number;
    moneda: string;
    cuenta: string | null;
    categoria: string | null;
  }>;
  ingresos: IngresoRecibo[];
  deudas: Array<{ quien: string | null; monto: number; motivo: string | null }>;
  incompletos: string[];
}

function monto(n: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es-BO", {
      style: "currency",
      currency: moneda === "USD" ? "USD" : "BOB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${moneda}`;
  }
}

function escapar(value: string | null | undefined): string {
  return (value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function htmlReciboVozCompleto(d: ReciboVozCompleto): { subject: string; html: string; text: string } {
  const partes: string[] = [];
  if (d.gastos.length) partes.push(`${d.gastos.length} gasto${d.gastos.length === 1 ? "" : "s"}`);
  if (d.ingresos.length) partes.push(`${d.ingresos.length} ingreso${d.ingresos.length === 1 ? "" : "s"}`);
  if (d.deudas.length) partes.push(`${d.deudas.length} deuda${d.deudas.length === 1 ? "" : "s"}`);

  const movimiento = (titulo: string, color: string, rows: string) =>
    rows
      ? `<div style="margin-top:18px"><div style="font-size:12px;font-weight:bold;color:${color};text-transform:uppercase;letter-spacing:.5px">${titulo}</div><table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;border-collapse:collapse">${rows}</table></div>`
      : "";

  const gastoRows = d.gastos.map((g) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb"><strong>${escapar(g.descripcion || "Gasto")}</strong><br><span style="font-size:12px;color:#6b7280">${escapar(g.cuenta || "Sin cuenta")} · ${escapar(g.categoria || "Sin categoría")}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:bold">−${monto(g.monto, g.moneda)}</td></tr>`).join("");
  const ingresoRows = d.ingresos.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb"><strong>${escapar(i.descripcion || "Ingreso")}</strong><br><span style="font-size:12px;color:#6b7280">${escapar(i.cuenta || "Sin cuenta")} · ${escapar(i.categoria || "Sin categoría")}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:bold">+${monto(i.monto, i.moneda)}</td></tr>`).join("");
  const deudaRows = d.deudas.map((x) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb"><strong>${escapar(x.quien || "Alguien")}</strong><br><span style="font-size:12px;color:#6b7280">${escapar(x.motivo || "Sin motivo")}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:bold">${monto(x.monto, x.monto ? "BOB" : "BOB")}</td></tr>`).join("");
  const incompletos = d.incompletos.length
    ? `<div style="margin-top:18px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b"><strong>No registrados</strong><ul>${d.incompletos.map((x) => `<li>${escapar(x)}</li>`).join("")}</ul></div>`
    : "";

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;color:#111827"><div style="background:#1e3a8a;color:white;padding:18px 22px;border-radius:10px 10px 0 0"><strong style="font-size:18px">🪙 MyMoney</strong><div style="font-size:12px;color:#dbeafe;margin-top:4px">Registro por voz · ${escapar(d.fechaHora)}</div></div><div style="border:1px solid #e5e7eb;border-top:0;padding:20px 22px">${movimiento("Gastos", "#dc2626", gastoRows)}${movimiento("Ingresos", "#15803d", ingresoRows)}${movimiento("Deudas por cobrar", "#1e3a8a", deudaRows)}${incompletos}${d.transcripcion ? `<div style="margin-top:18px;font-size:12px;color:#6b7280"><strong>Transcripción:</strong> ${escapar(d.transcripcion)}</div>` : ""}</div><div style="padding:12px;text-align:center;font-size:11px;color:#6b7280;background:#f3f4f6">Correo automático de MyMoney · ${escapar(fechaBoliviaHoy())}</div></div>`;
  const text = [
    `Registro por voz: ${partes.join(", ") || "sin registros"}.`,
    ...d.gastos.map((g) => `Gasto: ${g.descripcion} — ${monto(g.monto, g.moneda)} — cuenta: ${g.cuenta ?? "sin cuenta"}.`),
    ...d.ingresos.map((i) => `Ingreso: ${i.descripcion} — ${monto(i.monto, i.moneda)} — cuenta: ${i.cuenta ?? "sin cuenta"}.`),
    ...d.deudas.map((x) => `Deuda: ${x.quien ?? "alguien"} — ${monto(x.monto, "BOB")} — ${x.motivo ?? "sin motivo"}.`),
    ...d.incompletos.map((x) => `No registrado: ${x}`),
  ].join("\n");
  return {
    subject: `MyMoney · Registro por voz${partes.length ? ` · ${partes.join(", ")}` : ""}`,
    html: body,
    text,
  };
}
