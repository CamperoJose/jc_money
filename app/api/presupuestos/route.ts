import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guardarBudget, validarBudget, type BudgetInput } from "@/lib/mutations/presupuestos";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let input: BudgetInput;
  try {
    input = (await request.json()) as BudgetInput;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const errorMsg = validarBudget(input);
  if (errorMsg) return NextResponse.json({ error: errorMsg }, { status: 400 });

  try {
    const id = await guardarBudget(supabase, input);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al guardar" }, { status: 500 });
  }
}
