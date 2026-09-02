// Utilidades de fecha/hora en zona de Bolivia (GMT-4, sin horario de verano).
// El input <input type="datetime-local"> maneja "hora de pared" sin zona; aquí
// la interpretamos SIEMPRE como hora de Bolivia y la convertimos a un instante
// ISO (UTC) para persistir, y viceversa.

const BOLIVIA_TZ = "America/La_Paz";
export const BOLIVIA_OFFSET = "-04:00";

/** Partes de fecha/hora de un instante, en zona Bolivia. */
function partesBolivia(d: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOLIVIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

/** Ahora, como valor para <input type="datetime-local"> en hora Bolivia. */
export function ahoraLocalInput(): string {
  const p = partesBolivia(new Date());
  const hora = p.hour === "24" ? "00" : p.hour; // en-CA a veces devuelve 24
  return `${p.year}-${p.month}-${p.day}T${hora}:${p.minute}`;
}

/** ISO instantáneo → valor "YYYY-MM-DDTHH:mm" para el input (hora Bolivia). */
export function isoALocalInput(iso: string): string {
  const p = partesBolivia(new Date(iso));
  const hora = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hora}:${p.minute}`;
}

/** Valor del input (hora Bolivia) → ISO instantáneo con offset -04:00. */
export function localInputAIso(local: string): string {
  // local = "YYYY-MM-DDTHH:mm" — lo anclamos a la zona de Bolivia.
  const conSeg = local.length === 16 ? `${local}:00` : local;
  return new Date(`${conSeg}${BOLIVIA_OFFSET}`).toISOString();
}

/** ISO instantáneo → fecha local Bolivia "YYYY-MM-DD" (para txn_date). */
export function isoAFechaBolivia(iso: string): string {
  const p = partesBolivia(new Date(iso));
  return `${p.year}-${p.month}-${p.day}`;
}
