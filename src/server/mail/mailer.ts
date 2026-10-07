import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/server/env";

let transporter: Transporter | null = null;

function getTransporter() {
  if (!env.EMAIL_USER || !env.EMAIL_PASS) return null;
  transporter ??= nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_PORT === 465,
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
  });
  return transporter;
}

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Sends an email through SMTP. Without EMAIL_USER / EMAIL_PASS in development,
 * the message is printed to the terminal so auth flows still work locally.
 */
export async function sendMail(message: MailMessage) {
  const transport = getTransporter();

  if (!transport) {
    if (env.NODE_ENV === "production") {
      throw new Error("Email is not configured. Set EMAIL_USER and EMAIL_PASS.");
    }
    console.info(`\n[mail:dev] To: ${message.to}\n[mail:dev] Subject: ${message.subject}\n${message.text}\n`);
    return;
  }

  await transport.sendMail({
    from: { name: env.EMAIL_FROM_NAME, address: env.EMAIL_USER! },
    ...message,
  });
}
