import "server-only";
import type { MailMessage } from "@/server/mail/mailer";

function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function layout(title: string, body: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px">
      <tr><td>
        <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">loopify<span style="color:#7c3aed">.</span></div>
        <h1 style="font-size:22px;margin:24px 0 8px">${title}</h1>
        ${body}
        <p style="font-size:12px;color:#78716c;margin-top:32px">If you did not ask for this, you can safely ignore this email.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function codeBlock(code: string) {
  return `<div style="font-size:32px;font-weight:700;letter-spacing:0.3em;background:#f5f3ff;color:#5b21b6;border-radius:14px;padding:16px;text-align:center;margin:24px 0">${code}</div>`;
}

export function verifyEmailMessage(to: string, name: string, code: string): MailMessage {
  return {
    to,
    subject: `${code} is your Loopify code`,
    text: `Hi ${name},\n\nYour Loopify verification code is ${code}. It expires in 10 minutes.`,
    html: layout(
      `Welcome aboard, ${esc(name)}`,
      `<p style="font-size:15px;line-height:1.6;margin:0">Pop this code in to verify your email. It expires in 10 minutes.</p>${codeBlock(code)}`,
    ),
  };
}

export function passwordResetMessage(to: string, name: string, code: string): MailMessage {
  return {
    to,
    subject: `${code} is your Loopify reset code`,
    text: `Hi ${name},\n\nUse ${code} to reset your Loopify password. It expires in 10 minutes.`,
    html: layout(
      "Reset your password",
      `<p style="font-size:15px;line-height:1.6;margin:0">Happens to the best of us. Use this code to set a new password. It expires in 10 minutes.</p>${codeBlock(code)}`,
    ),
  };
}

export function inviteMessage(to: string, inviterName: string, orgName: string, link: string): MailMessage {
  return {
    to,
    subject: `${inviterName} invited you to ${orgName} on Loopify`,
    text: `${inviterName} invited you to join ${orgName} on Loopify.\n\nAccept: ${link}`,
    html: layout(
      `Join ${esc(orgName)}`,
      `<p style="font-size:15px;line-height:1.6;margin:0">${esc(inviterName)} wants you on the team.</p>
       <p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">Accept invite</a></p>`,
    ),
  };
}
