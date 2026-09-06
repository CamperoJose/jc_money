"use client";

import { PantallaError } from "@/components/ui/error-boundary";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaError {...props} seccion="Parámetros" />;
}
