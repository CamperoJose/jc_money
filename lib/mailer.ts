import nodemailer from "nodemailer";

export interface CorreoConfig { user: string; pass: string; to: string; host: string; port: number; }

/** Configuración SMTP global. El remitente es siempre la casilla de la aplicación. */
export function leerConfigCorreo(): CorreoConfig | null {
  const user = process.env.SMTP_USER; const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return { user, pass, to: process.env.MAIL_TO || user, host: process.env.SMTP_HOST || "smtp.gmail.com", port: Number(process.env.SMTP_PORT || 465) };
}

/** Envía desde SMTP_USER al destinatario indicado por la aplicación. */
export async function enviarCorreo(opts: { subject: string; html: string; text?: string; to?: string }): Promise<void> {
  const cfg = leerConfigCorreo();
  if (!cfg) throw new Error("Faltan SMTP_USER y/o SMTP_PASS en el entorno (App Password de Gmail).");
  const transporter = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.port === 465, auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 });
  await transporter.sendMail({ from: `MyMoney <${cfg.user}>`, to: opts.to || cfg.to, subject: opts.subject, text: opts.text, html: opts.html });
  transporter.close();
}
