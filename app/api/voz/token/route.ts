import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nuevoToken(): string {
  return crypto.randomBytes(24).toString("hex"); // 48 hex chars
}

/** Genera o regenera el token de ingesta (Shortcut iOS) del usuario. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const token = nuevoToken();
  const { error } = await supabase
    .from("api_ingest_tokens")
    .upsert(
      { user_id: user.id, token, rotated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token });
}
