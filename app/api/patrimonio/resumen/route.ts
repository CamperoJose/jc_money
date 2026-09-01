import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResumen } from "@/lib/queries/patrimonio";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const resumen = await getResumen(supabase);
    return NextResponse.json(resumen);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
