// Adaptado de Tremor Divider. Separador horizontal con texto opcional al
// centro. Usa los tokens del tema en vez de la escala `gray` de la plantilla.
import * as React from "react";
import { cn } from "@/lib/utils";

export type DividerProps = React.ComponentPropsWithoutRef<"div">;

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mx-auto my-6 flex w-full items-center justify-between gap-3 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      {children ? (
        <>
          <div className="h-px w-full bg-border" />
          <div className="whitespace-nowrap text-inherit">{children}</div>
          <div className="h-px w-full bg-border" />
        </>
      ) : (
        <div className="h-px w-full bg-border" />
      )}
    </div>
  )
);
Divider.displayName = "Divider";
