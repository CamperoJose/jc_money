import * as React from "react";
import { cn } from "@/lib/utils";

// Estilo Tremor (fondo tintado + ring interior), pero con los tokens del tema.
type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "destructive"
  | "warning"
  | "neutral";

// Cada variante lleva un degradado vertical muy leve: el chip deja de ser un
// rectángulo plano y toma algo de volumen, sin perder contraste del texto.
const styles: Record<Variant, string> = {
  default:
    "bg-gradient-to-b from-primary/15 to-primary/[0.07] text-primary ring-primary/30",
  secondary:
    "bg-gradient-to-b from-secondary to-secondary/70 text-secondary-foreground ring-border",
  outline: "bg-gradient-to-b from-foreground/[0.04] to-transparent text-foreground ring-border",
  success:
    "bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.07] text-emerald-700 ring-emerald-500/30 dark:text-emerald-400",
  destructive:
    "bg-gradient-to-b from-destructive/15 to-destructive/[0.07] text-destructive ring-destructive/30",
  warning:
    "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.07] text-amber-700 ring-amber-500/30 dark:text-amber-400",
  neutral: "bg-gradient-to-b from-muted to-muted/50 text-muted-foreground ring-border",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-x-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}
