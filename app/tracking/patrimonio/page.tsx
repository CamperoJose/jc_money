import { TrendUp, TrendDown, CurrencyDollar, Coins } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { getResumen, type ResumenPatrimonio } from "@/lib/queries/patrimonio";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CurvaPatrimonio } from "@/components/patrimonio/curva-chart";
import { formatBob, formatUsd, formatNumber, formatDate, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PatrimonioPage() {
  const supabase = await createClient();

  let resumen: ResumenPatrimonio | null = null;
  let errorMsg: string | null = null;
  try {
    resumen = await getResumen(supabase);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Error al leer los datos.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patrimonio</h1>
        <p className="text-sm text-muted-foreground">
          Evolución de tu patrimonio neto en BOB y USD.
        </p>
      </div>

      {errorMsg && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="font-medium text-destructive">No se pudieron leer los datos.</p>
            <p className="mt-1 text-muted-foreground">
              Verifica que aplicaste el esquema SQL en Supabase
              (<code>supabase/migrations/0001_schema_inicial.sql</code>) y las
              semillas. Detalle: {errorMsg}
            </p>
          </CardContent>
        </Card>
      )}

      {resumen && (resumen.snapshots.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Todavía no hay fotos de patrimonio. Cuando migres el Excel o registres
            una foto, aparecerán aquí.
          </CardContent>
        </Card>
      ) : (
        <PatrimonioContenido resumen={resumen} />
      ))}
    </div>
  );
}

function PatrimonioContenido({ resumen }: { resumen: ResumenPatrimonio }) {
  const { ultimo, variacionBob, variacionPct, distribucionMoneda } = resumen;
  const sube = (variacionBob ?? 0) >= 0;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Acento: el patrimonio neto usa el color primario del tema */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardDescription>Patrimonio neto</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {formatBob(ultimo?.total_bob)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {formatUsd(ultimo?.total_usd)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Variación vs. foto anterior</CardDescription>
            <CardTitle
              className={"flex items-center gap-1 text-2xl " + (sube ? "text-primary" : "text-destructive")}
            >
              {variacionBob == null ? (
                "—"
              ) : (
                <>
                  {sube ? <TrendUp className="size-5" /> : <TrendDown className="size-5" />}
                  {formatBob(Math.abs(variacionBob))}
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {variacionPct == null ? "Sin comparación" : formatPercent(variacionPct)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tipo de cambio (T/C)</CardDescription>
            <CardTitle className="flex items-center gap-1 text-2xl">
              <CurrencyDollar weight="duotone" className="size-5 text-muted-foreground" />
              {formatNumber(ultimo?.exchange_rate, 2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Bs por USD</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fotos registradas</CardDescription>
            <CardTitle className="flex items-center gap-1 text-2xl">
              <Coins weight="duotone" className="size-5 text-muted-foreground" />
              {resumen.snapshots.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Última: {formatDate(ultimo?.snapshot_date)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolución del patrimonio</CardTitle>
          <CardDescription>Serie histórica en bolivianos.</CardDescription>
        </CardHeader>
        <CardContent>
          <CurvaPatrimonio serie={resumen.serie} />
        </CardContent>
      </Card>

      {distribucionMoneda && (
        <Card>
          <CardHeader>
            <CardTitle>Distribución por moneda (última foto)</CardTitle>
            <CardDescription>Valor en BOB de cada moneda.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            {(["BOB", "USD", "USDT"] as const).map((m) => (
              <div key={m} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{m}</div>
                <div className="text-lg font-semibold">
                  {formatBob(distribucionMoneda[m])}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fotos de patrimonio</CardTitle>
          <CardDescription>Cada fila es una foto por fecha.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">T/C</TableHead>
                <TableHead className="text-right">Total BOB</TableHead>
                <TableHead className="text-right">Total USD</TableHead>
                <TableHead>Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...resumen.snapshots].reverse().map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{formatDate(s.snapshot_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(s.exchange_rate, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatBob(s.total_bob)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatUsd(s.total_usd)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                    {s.note ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
