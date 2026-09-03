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

const styles: Record<Variant, string> = {
  default: "bg-primary/10 text-primary ring-primary/30",
  secondary: "bg-secondary text-secondary-foreground ring-border",
  outline: "bg-transparent text-foreground ring-border",
  success:
    "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400",
  destructive: "bg-destructive/10 text-destructive ring-destructive/30",
  warning: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400",
  neutral: "bg-muted text-muted-foreground ring-border",
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
