"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkle,
  Key,
  Copy,
  ArrowsClockwise,
  Eye,
  EyeSlash,
  Check,
  Microphone,
  Receipt,
  HandCoins,
  Warning,
  DeviceMobile,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { AiRequest, AiRequestStatus } from "@/lib/types";

const ESTADO: Record<AiRequestStatus, { label: string; variant: "success" | "secondary" | "destructive" | "outline" }> = {
  completado: { label: "Completado", variant: "success" },
  parcial: { label: "Parcial", variant: "secondary" },
  incompleto: { label: "Incompleto", variant: "destructive" },
  procesando: { label: "Procesando…", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
};

export function AsistenteClient({
  solicitudes,
  token,
  ingestUrl,
}: {
  solicitudes: AiRequest[];
  token: string | null;
  ingestUrl: string;
}) {
  const router = useRouter();
  const [tok, setTok] = useState(token);
  const [ver, setVer] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [regenerando, setRegenerando] = useState(false);

  async function copiar(texto: string, cual: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      setTimeout(() => setCopiado(null), 1500);
    } catch {}
  }

  async function regenerar() {
    if (tok && !confirm("¿Regenerar el token? El Shortcut anterior dejará de funcionar hasta que lo actualices.")) return;
    setRegenerando(true);
    try {
      const res = await fetch("/api/voz/token", { method: "POST" });
      const j = await res.json();
      if (res.ok) {
        setTok(j.token);
        setVer(true);
      }
    } finally {
      setRegenerando(false);
    }
  }

  const enmascarado = tok ? `${tok.slice(0, 6)}${"•".repeat(18)}${tok.slice(-4)}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkle weight="duotone" className="size-6 text-primary" /> Asistente por voz
        </h1>
        <p className="text-sm text-muted-foreground">
          Registra gastos y deudas dictando por voz. Se procesan en segundo plano y recibes el
          detalle por correo. Aquí queda el historial de solicitudes.
        </p>
      </div>

      {/* Token para Shortcut / Action Button de iOS */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Key weight="duotone" className="size-5 text-primary" />
            <h2 className="font-semibold">Atajo de iOS (Shortcut / Botón de Acción)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Usa este token para grabar y enviar audio desde un Atajo, sin abrir la app. Es de larga
            duración; si crees que se filtró, regénéralo (invalida el anterior).
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Token</label>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
                {tok ? (ver ? tok : enmascarado) : "— sin token —"}
              </code>
              {tok && (
                <>
                  <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar" : "Mostrar"}>
                    {ver ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => copiar(tok, "token")} aria-label="Copiar token">
                    {copiado === "token" ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                  </Button>
                </>
              )}
              <Button variant="outline" className="shrink-0" onClick={regenerar} disabled={regenerando}>
                <ArrowsClockwise weight="bold" className={`size-4 ${regenerando ? "animate-spin" : ""}`} />
                {tok ? "Regenerar" : "Generar"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">URL del endpoint (POST)</label>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs">{ingestUrl}</code>
              <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => copiar(ingestUrl, "url")} aria-label="Copiar URL">
                {copiado === "url" ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>

          <details className="rounded-lg border bg-muted/20 p-3 text-sm" open>
            <summary className="cursor-pointer font-medium">
              <DeviceMobile weight="duotone" className="mr-1 inline size-4 text-primary" />
              Cómo configurarlo en el Atajo (pasos exactos)
            </summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>Acción <b>“Grabar audio”</b> (Record Audio). Ábrela y pon <b>Finalizar grabación: Al tocar</b>.</li>
              <li>Acción <b>“Codificar” → Base64</b> con la <b>Audio grabada</b>. Toca la flechita y pon
                <b> Line Breaks (Saltos de línea): None</b>.</li>
              <li>Acción <b>“Obtener contenido de”</b> (Get contents of):
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>En el <b>campo URL de la acción</b> (arriba, no como encabezado) pega la URL de arriba.</li>
                  <li>Método: <b>POST</b>.</li>
                  <li><b>Encabezados:</b> deja solo <code>Content-Type</code> = <code>application/json</code>.
                    <b> Borra los encabezados “URL” y “Bearer”.</b></li>
                  <li><b>Cuerpo de la solicitud: JSON</b>, con estos 4 campos (todos tipo Texto):
                    <ul className="mt-0.5 list-disc pl-5">
                      <li><code>audioBase64</code> = variable <b>Base64 Encoded</b></li>
                      <li><code>mimeType</code> = <code>audio/m4a</code></li>
                      <li><code>origen</code> = <code>shortcut</code></li>
                      <li><code>token</code> = tu token (el de arriba)</li>
                    </ul>
                  </li>
                </ul>
              </li>
              <li>Asigna el atajo al <b>Botón de Acción</b> (Ajustes → Botón de Acción → Atajo).</li>
            </ol>
            <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
              Error común: poner la URL o el token como <b>encabezados</b>. La URL va en el campo de la
              acción y el token va como <b>campo del JSON</b> (o encabezado <code>Authorization: Bearer …</code>).
            </p>
          </details>
        </CardContent>
      </Card>

      {/* Historial */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Historial de solicitudes ({solicitudes.length})
        </h2>
        {solicitudes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Microphone weight="duotone" className="size-8 opacity-60" />
              Aún no hay solicitudes por voz. Usa el botón de micrófono para registrar la primera.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {solicitudes.map((s) => {
              const est = ESTADO[s.status];
              return (
                <Card key={s.id}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={est.variant}>{est.label}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(s.created_at)}</span>
                        {s.origen === "shortcut" && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">Atajo</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {s.n_gastos > 0 && (
                          <span className="flex items-center gap-1"><Receipt weight="duotone" className="size-3.5" />{s.n_gastos}</span>
                        )}
                        {s.n_deudas > 0 && (
                          <span className="flex items-center gap-1"><HandCoins weight="duotone" className="size-3.5" />{s.n_deudas}</span>
                        )}
                        {s.correo_ok && <span title="Correo enviado">✉️</span>}
                      </div>
                    </div>
                    {s.transcripcion && (
                      <p className="mt-2 text-sm italic text-muted-foreground">🎙️ “{s.transcripcion}”</p>
                    )}
                    {s.resumen && s.status !== "error" && (
                      <p className="mt-1 text-sm">{s.resumen}</p>
                    )}
                    {s.error && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
                        <Warning weight="fill" className="mt-0.5 size-3.5 shrink-0" />{s.error}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
            <ArrowsClockwise className="size-4" /> Actualizar
          </Button>
        </p>
      </div>
    </div>
  );
}
