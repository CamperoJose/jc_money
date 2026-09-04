import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Cabecera típica: título + subtítulo + acción. */
function CabeceraSkeleton() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-60" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

/** Fila de KPIs (n tarjetas). */
function KpisSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Skeleton genérico de dashboard: cabecera + KPIs + gráficos. */
export function DashboardSkeleton({ graficos = 2 }: { graficos?: number }) {
  return (
    <div className="space-y-6">
      <CabeceraSkeleton />
      <KpisSkeleton />
      {Array.from({ length: graficos }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Skeleton para páginas de lista/tabla: cabecera + filas. */
export function ListaSkeleton({ filas = 6 }: { filas?: number }) {
  return (
    <div className="space-y-6">
      <CabeceraSkeleton />
      <KpisSkeleton />
      <Card>
        <CardContent className="divide-y p-0">
          {Array.from({ length: filas }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
