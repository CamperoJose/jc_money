import { createClient } from "@/lib/supabase/server";
import { getResumen } from "@/lib/queries/patrimonio";
import { analizarTendencia } from "@/lib/tendencias";
import { analizarGastos } from "@/lib/analisis";
import { getTransacciones } from "@/lib/queries/gastos";
import { getDpfs } from "@/lib/queries/dpf";
import { getDeudas } from "@/lib/queries/deudas";
import { enriquecerDpf } from "@/lib/dpf";
import { resumenDeudas } from "@/lib/deudas";
import {
  calcularEstadoPatrimonio,
  disponibilidadDe,
} from "@/lib/patrimonio/estado";
import {
  proyectarPatrimonio,
  type BaseProyeccion,
} from "@/lib/proyeccion-patrimonio";
import { fechaBoliviaHoy } from "@/lib/datetime";
import { Card, CardContent } from "@/components/ui/card";
import { TendenciasClient } from "@/components/tendencias/tendencias-client";

export const dynamic = "force-dynamic";

export default async function TendenciasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hoy = fechaBoliviaHoy();
  const [resPatrimonio, resEstado, resTx, resDpf, resDeudas] =
    await Promise.allSettled([
      getResumen(supabase),
      user
        ? calcularEstadoPatrimonio(supabase, user.id, hoy)
        : Promise.resolve(null),
      user ? getTransacciones(supabase, user.id) : Promise.resolve([]),
      user ? getDpfs(supabase, user.id) : Promise.resolve([]),
      user ? getDeudas(supabase, user.id) : Promise.resolve([]),
    ]);
  if (resPatrimonio.status === "rejected") {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          <p className="font-medium text-destructive">
            No se pudieron leer los datos.
          </p>
          <p className="mt-1 text-muted-foreground">
            {resPatrimonio.reason instanceof Error
              ? resPatrimonio.reason.message
              : "Error al leer el patrimonio."}
          </p>
        </CardContent>
      </Card>
    );
  }
  const resumen = resPatrimonio.value;
  // Una foto futura no debe convertirse en el patrimonio actual ni entrenar el modelo.
  const ultima = resumen.snapshots.findLast((s) => s.snapshot_date <= hoy);
  const estado = resEstado.status === "fulfilled" ? resEstado.value : null;
  const transacciones = resTx.status === "fulfilled" ? resTx.value : [];
  const dpfs =
    resDpf.status === "fulfilled"
      ? resDpf.value.map((d) => enriquecerDpf(d, hoy))
      : [];
  const deudas =
    resDeudas.status === "fulfilled"
      ? resumenDeudas(resDeudas.value, hoy).deudas
      : [];
  const avisos: string[] = [];
  if (resEstado.status === "rejected")
    avisos.push(
      "No se pudo actualizar el patrimonio en vivo. Se utiliza el último registro histórico disponible.",
    );
  if (resTx.status === "rejected")
    avisos.push(
      "No se pudieron leer los movimientos. Las estimaciones por flujos no están disponibles.",
    );
  if (resDpf.status === "rejected")
    avisos.push(
      "No se pudieron leer los DPF. El calendario de vencimientos está incompleto.",
    );
  if (resDeudas.status === "rejected")
    avisos.push(
      "No se pudieron leer las deudas por cobrar. El calendario de cobros está incompleto.",
    );
  const balances = estado?.balances ?? ultima?.balances ?? [];
  const exposicion = balances.reduce(
    (s, b) =>
      s +
      (b.account.currency === "BOB"
        ? 0
        : b.amount * (b.account.is_liability ? -1 : 1)),
    0,
  );
  const base: BaseProyeccion | null = estado
    ? {
        fecha: hoy,
        bob: estado.totalBob,
        disponible: disponibilidadDe(estado),
        exposicion,
        rate: estado.rate,
        enVivo: true,
      }
    : ultima
      ? {
          fecha: ultima.snapshot_date,
          bob: ultima.total_bob,
          disponible: null,
          exposicion,
          rate: ultima.exchange_rate,
          enVivo: false,
        }
      : null;
  const serie = resumen.serie.map((p) => ({ fecha: p.fecha, bob: p.bob }));
  const proyeccion = proyectarPatrimonio({
    hoy,
    serie,
    base,
    transacciones,
    dpfs,
    deudas,
    avisos,
  });
  // La lectura descriptiva sí incluye el saldo vivo. El backtest anterior usa
  // exclusivamente cierres históricos, sin contaminación de datos futuros.
  const serieActual = base?.enVivo
    ? [...serie, { fecha: base.fecha, bob: base.bob }]
    : serie;
  const gastos =
    resTx.status === "fulfilled"
      ? analizarGastos(
          transacciones.filter(
            (t) =>
              t.txn_date <= hoy &&
              Number.isFinite(t.amount_bob) &&
              t.amount > 0 &&
              (t.currency === "BOB" ||
                (t.exchange_rate != null && t.exchange_rate > 0)),
          ),
          hoy,
        )
      : null;
  return (
    <TendenciasClient
      t={analizarTendencia(serieActual, { hoy })}
      gastos={gastos}
      proyeccion={proyeccion}
    />
  );
}
