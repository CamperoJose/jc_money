import type { SupabaseClient } from "@supabase/supabase-js";
export interface UsuarioJob { userId: string; email: string | null; }
export async function getUsuariosJob(admin: SupabaseClient): Promise<UsuarioJob[]> {
  const emails = new Map<string, string>();
  const { data: settings, error: e1 } = await admin.from("app_settings").select("user_id, value").eq("key", "email_destino");
  if (e1) throw e1;
  for (const r of settings ?? []) if (r.value) emails.set(r.user_id as string, String(r.value).trim());
  const { data: authUsers, error: eAuth } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (eAuth) throw eAuth;
  return (authUsers.users ?? []).map((u) => ({ userId: u.id, email: emails.get(u.id) ?? u.email ?? null }));
}
export async function ejecutarPorUsuario<T>(admin: SupabaseClient, usuarios: UsuarioJob[], job: (u: UsuarioJob) => Promise<T>): Promise<T[]> {
  const oldUser = process.env.JOB_USER_ID;
  const oldMail = process.env.MAIL_TO;
  const out: T[] = [];
  try {
    for (const u of usuarios) {
      process.env.JOB_USER_ID = u.userId;
      if (u.email) process.env.MAIL_TO = u.email; else delete process.env.MAIL_TO;
      out.push(await job(u));
    }
  } finally {
    if (oldUser === undefined) delete process.env.JOB_USER_ID; else process.env.JOB_USER_ID = oldUser;
    if (oldMail === undefined) delete process.env.MAIL_TO; else process.env.MAIL_TO = oldMail;
  }
  return out;
}
