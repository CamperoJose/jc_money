// Primitivos de tabla estilo Tremor, con los tokens del tema.
// Uso: <TableRoot><Table><TableHead>…</TableHead><TableBody>…</TableBody></Table></TableRoot>
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Contenedor con scroll horizontal (evita desbordes en móvil).
 * Con `altoMaximo` el scroll también es vertical, que es lo que permite que la
 * cabecera quede fija: `sticky` se ancla al contenedor con scroll, no a la
 * página, así que sin altura máxima no tendría efecto.
 */
export function TableRoot({
  className,
  children,
  altoMaximo,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { altoMaximo?: string }) {
  // `role="region"` sin nombre accesible es ruido para un lector de pantalla:
  // solo se declara región si quien la usa le puso etiqueta.
  const tieneNombre = Boolean(props["aria-label"] || props["aria-labelledby"]);
  return (
    // `tabIndex=0` + `role="region"`: un contenedor con scroll horizontal debe
    // poder desplazarse con el teclado, si no el contenido cortado es
    // inalcanzable sin mouse.
    <div
      className={cn("w-full overflow-x-auto", altoMaximo && "overflow-y-auto", className)}
      style={altoMaximo ? { maxHeight: altoMaximo } : undefined}
      tabIndex={0}
      role={tieneNombre ? "region" : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full caption-bottom text-sm", className)} {...props} />;
}

export function TableHead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        // Cabecera fija: al desplazar filas largas los títulos de columna
        // siguen visibles. Fondo opaco (no degradado transparente) porque las
        // filas pasan justo por detrás.
        "sticky top-0 z-10 bg-muted dark:bg-[oklch(0.25_0.025_264.5)]",
        className
      )}
      {...props}
    />
  );
}

export function TableHeaderCell({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      // `scope="col"` es lo que permite a un lector de pantalla anunciar el
      // encabezado correcto al leer cada celda de una tabla ancha.
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

/**
 * Cabecera que ordena al hacer clic. Es un `<button>` dentro del `<th>` para que
 * funcione con teclado, y declara `aria-sort` para que un lector de pantalla
 * anuncie por qué columna y en qué sentido está ordenada la tabla.
 */
export function TableHeaderCellOrdenable({
  campo,
  orden,
  onOrdenar,
  className,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  campo: string;
  orden: { campo: string; asc: boolean } | null;
  onOrdenar: (campo: string) => void;
}) {
  const activo = orden?.campo === campo;
  const alineadoDerecha = /text-right/.test(className ?? "");
  return (
    <th
      scope="col"
      aria-sort={activo ? (orden!.asc ? "ascending" : "descending") : "none"}
      className={cn(
        "whitespace-nowrap border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
      {...props}
    >
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        className={cn(
          "inline-flex w-full items-center gap-1 rounded transition-colors hover:text-foreground",
          activo && "text-foreground",
          alineadoDerecha && "justify-end"
        )}
      >
        {children}
        <span aria-hidden className={cn("text-[10px]", !activo && "opacity-30")}>
          {activo ? (orden!.asc ? "▲" : "▼") : "▼"}
        </span>
      </button>
    </th>
  );
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-gradient-to-r hover:from-primary/[0.05] hover:to-transparent",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 text-sm text-foreground", className)} {...props} />;
}

export function TableFoot({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        "border-t border-border bg-muted/30 text-sm font-semibold text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption className={cn("mt-3 px-3 text-center text-xs text-muted-foreground", className)} {...props} />
  );
}
