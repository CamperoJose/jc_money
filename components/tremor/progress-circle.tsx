// Adaptado de Tremor ProgressCircle → usa los tokens del tema (no colores fijos).
import * as React from "react";
import { cn } from "@/lib/utils";

type Variante = "default" | "neutral" | "success" | "warning" | "error";

const trazo: Record<Variante, string> = {
  default: "stroke-primary",
  neutral: "stroke-muted-foreground",
  success: "stroke-emerald-500",
  warning: "stroke-amber-500",
  error: "stroke-destructive",
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
        className={cn("-rotate-90 transform", className)}
        {...props}
      >
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
          className={cn(
            trazo[variant],
            showAnimation && "transition-all duration-500 ease-in-out"
          )}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
