import type { SupabaseClient } from "@supabase/supabase-js";
export interface UsuarioJob { userId: string; email: string | null; }
export async function getUsuariosJob(admin: SupabaseClient): Promise<UsuarioJob[]> {
  const ids = new Set<string>(); const emails = new Map<string, string>();
  const { data: settings, error: e1 } = await admin.from("app_settings").select("user_id, value").eq("key", "email_destino");
  if (e1) throw e1;
  for (const r of settings ?? []) { ids.add(r.user_id as string); if (r.value) emails.set(r.user_id as string, r.value as string); }
  const { data: accounts, error: e2 } = await admin.from("accounts").select("user_id"); if (e2) throw e2;
  for (const r of accounts ?? []) ids.add(r.user_id as string);
  return [...ids].map(userId => ({ userId, email: emails.get(userId) ?? null }));
}
export async function ejecutarPorUsuario<T>(admin: SupabaseClient, usuarios: UsuarioJob[], job: (u: UsuarioJob) => Promise<T>): Promise<T[]> {
  const oldUser = process.env.JOB_USER_ID; const oldMail = process.env.MAIL_TO; const out: T[] = [];
  try { for (const u of usuarios) { process.env.JOB_USER_ID = u.userId; if (u.email) process.env.MAIL_TO = u.email; else delete process.env.MAIL_TO; out.push(await job(u)); } }
  finally { if (oldUser === undefined) delete process.env.JOB_USER_ID; else process.env.JOB_USER_ID = oldUser; if (oldMail === undefined) delete process.env.MAIL_TO; else process.env.MAIL_TO = oldMail; }
  return out;
}
