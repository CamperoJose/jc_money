import nodemailer from "nodemailer";

/**
 * Envío de correos vía SMTP (Gmail App Password por defecto). Las credenciales
 * NUNCA van en el repo: se leen de variables de entorno.
 *   SMTP_USER  → tu correo Gmail (remitente)
 *   SMTP_PASS  → App Password de Gmail (16 caracteres, sin espacios)
 *   MAIL_TO    → destinatario (por defecto, el mismo SMTP_USER)
 *   SMTP_HOST  → opcional (default smtp.gmail.com)
 *   SMTP_PORT  → opcional (default 465, SSL)
 */
export interface CorreoConfig {
  user: string;
  pass: string;
  to: string;
  host: string;
  port: number;
}

export function leerConfigCorreo(): CorreoConfig | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return {
    user,
    pass,
    to: process.env.MAIL_TO || user,
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
  };
}

/** Envía un correo HTML. Lanza Error claro si faltan credenciales. */
export async function enviarCorreo(opts: {
  subject: string;
  html: string;
  text?: string;
  to?: string;
}): Promise<void> {
  const cfg = leerConfigCorreo();
  if (!cfg) {
    throw new Error("Faltan SMTP_USER y/o SMTP_PASS en el entorno (App Password de Gmail).");
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465, // 465 = SSL; 587 = STARTTLS
    auth: { user: cfg.user, pass: cfg.pass },
  });

  await transporter.sendMail({
    from: `MyMoney <${cfg.user}>`,
    to: opts.to || cfg.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
