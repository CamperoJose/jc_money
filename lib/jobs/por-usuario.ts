import type { SupabaseClient } from "@supabase/supabase-js";

export interface UsuarioJob { userId: string; email: string | null; }

/** Obtiene usuarios reales de Auth y conserva el email configurado por usuario. */
export async function getUsuariosJob(admin: SupabaseClient): Promise<UsuarioJob[]> {
  const emails = new Map<string, string>();
  const { data: settings, error: e1 } = await admin.from("app_settings").select("user_id, value").eq("key", "email_destino");
  if (e1) throw e1;
  for (const r of settings ?? []) if (r.value) emails.set(r.user_id as string, String(r.value).trim());

  const { data: authUsers, error: eAuth } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (eAuth) throw eAuth;

  return (authUsers.users ?? []).map((u) => ({
    userId: u.id,
    email: emails.get(u.id) ?? u.email ?? null,
  }));
}

/** Ejecuta el job con el userId explícito; no usa process.env para aislar usuarios. */
export async function ejecutarPorUsuario<T>(
  admin: SupabaseClient,
  usuarios: UsuarioJob[],
  job: (u: UsuarioJob) => Promise<T>
): Promise<T[]> {
  const out: T[] = [];
  for (const u of usuarios) out.push(await job(u));
  return out;
}
