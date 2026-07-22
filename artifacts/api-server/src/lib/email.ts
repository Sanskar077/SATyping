import nodemailer from "nodemailer";
import { logger } from "./logger";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null | undefined;

/**
 * Lazily builds an SMTP transport from env vars. Returns null (not throw) when SMTP isn't
 * configured, so the app degrades to logging instead of hard-failing — matches the same
 * "seam" pattern as lib/payments/gateway.ts: one interface, swap the implementation later
 * (e.g. a transactional email API) without touching call sites.
 */
function getTransport() {
  if (cachedTransport !== undefined) return cachedTransport;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    cachedTransport = null;
    return null;
  }

  cachedTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedTransport;
}

/**
 * Sends an email if SMTP is configured; otherwise logs it (dev-friendly, never throws so a
 * missing SMTP config can't break registration/password-reset flows). Never awaited by the
 * caller as a hard requirement for success — a delivery failure here should not roll back the
 * DB change that triggered it.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const transport = getTransport();

  if (!transport) {
    logger.info({ to: input.to, subject: input.subject }, "[email:dev-fallback] SMTP not configured — logging instead of sending");
    logger.info(input.text);
    return;
  }

  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "GCC-TBC Pro <no-reply@gcctbcpro.example>",
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (err) {
    logger.error({ err, to: input.to }, "Failed to send email");
  }
}

function frontendUrl(path: string): string {
  const base = process.env.FRONTEND_URL ?? "http://localhost:5000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const link = frontendUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  await sendEmail({
    to,
    subject: "Verify your email — GCC-TBC Pro",
    text: `Hi ${name},\n\nVerify your email by visiting: ${link}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi ${name},</p><p>Verify your email by clicking the link below:</p><p><a href="${link}">Verify my email</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const link = frontendUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  await sendEmail({
    to,
    subject: "Reset your password — GCC-TBC Pro",
    text: `Hi ${name},\n\nReset your password by visiting: ${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: `<p>Hi ${name},</p><p>Reset your password by clicking the link below:</p><p><a href="${link}">Reset my password</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
  });
}
