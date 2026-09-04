// Adaptado de Tremor ProgressCircle → usa los tokens del tema (no colores fijos).
import * as React from "react";
import { cn } from "@/lib/utils";

type Variante = "default" | "neutral" | "success" | "warning" | "error";

// El arco se pinta con un degradado construido a partir de `currentColor`, así
// que basta con fijar el color de texto por variante y el anillo toma volumen.
const trazo: Record<Variante, string> = {
  default: "text-primary",
  neutral: "text-muted-foreground",
  success: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-destructive",
};

export interface ProgressCircleProps
  extends Omit<React.SVGProps<SVGSVGElement>, "value"> {
  value?: number;
  max?: number;
  variant?: Variante;
  radius?: number;
  strokeWidth?: number;
  showAnimation?: boolean;
  children?: React.ReactNode;
}

/** Anillo de progreso con el valor al centro (KPIs, % de presupuesto, avance de DPF). */
export function ProgressCircle({
  value = 0,
  max = 100,
  radius = 32,
  strokeWidth = 6,
  showAnimation = true,
  variant = "default",
  className,
  children,
  ...props
}: ProgressCircleProps) {
  const gradId = React.useId();
  const seguro = Math.min(max, Math.max(value, 0));
  const r = radius - strokeWidth / 2;
  const circunferencia = r * 2 * Math.PI;
  const offset = circunferencia - (max ? seguro / max : 0) * circunferencia;

  return (
    <div
      className="relative shrink-0"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <svg
        width={radius * 2}
        height={radius * 2}
        viewBox={`0 0 ${radius * 2} ${radius * 2}`}
        className={cn("-rotate-90 transform", trazo[variant], className)}
        {...props}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <circle
          r={r}
          cx={radius}
          cy={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          className="stroke-muted"
        />
        <circle
          r={r}
          cx={radius}
          cy={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circunferencia} ${circunferencia}`}
          strokeDashoffset={offset}
          fill="transparent"
          strokeLinecap="round"
          stroke={`url(#${gradId})`}
          className={cn(showAnimation && "transition-all duration-500 ease-in-out")}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
