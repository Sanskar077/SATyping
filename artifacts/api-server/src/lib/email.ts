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
 *
 * ── Configuring a free SMTP provider ──────────────────────────────────────────
 * Any provider works; these two are free-tier friendly:
 *
 *   Brevo (recommended — 300 emails/day free)
 *     SMTP_HOST=smtp-relay.brevo.com
 *     SMTP_PORT=587
 *     SMTP_USER=<the SMTP login shown in Brevo → SMTP & API → SMTP>
 *     SMTP_PASS=<the SMTP key generated there — NOT your account password>
 *     EMAIL_FROM=Your App <you@a-domain-verified-in-brevo.com>
 *
 *   Gmail (fine for low volume / testing)
 *     SMTP_HOST=smtp.gmail.com
 *     SMTP_PORT=587
 *     SMTP_USER=you@gmail.com
 *     SMTP_PASS=<16-char App Password; requires 2FA. A normal password will NOT work.>
 *     EMAIL_FROM=Your App <you@gmail.com>
 *
 * Two provider-side gotchas cause almost every "verification email never arrives":
 *   1. EMAIL_FROM must use a domain/sender the provider has VERIFIED. An unverified sender is
 *      rejected at send time (Brevo: 553 / "sender not valid").
 *   2. Brevo accounts can restrict SMTP to an IP allowlist. From an unlisted IP the login fails
 *      with `525 5.7.1 Unauthorized IP address` even though the credentials are correct — add the
 *      server's IP under Security → Authorised IPs, or disable the restriction.
 * Run `pnpm --filter @workspace/api-server run check-email` to test the configuration directly.
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
    // Fail fast instead of hanging the caller. Without these, an unreachable SMTP host (wrong
    // port, or a provider IP-allowlist rejecting this server) blocks the TCP connect forever —
    // and any route that awaits sendEmail() inline (forgot-password, registration) hangs its
    // HTTP response with it. 10s covers slow-but-working providers; anything longer is down.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return cachedTransport;
}

/**
 * Sends an email if SMTP is configured; otherwise logs it (dev-friendly, never throws so a
 * missing SMTP config can't break registration/password-reset flows). Never awaited by the
 * caller as a hard requirement for success — a delivery failure here should not roll back the
 * DB change that triggered it.
 *
 * Returns whether the message was actually handed to the SMTP server, so callers can tell the
 * user "check your inbox" versus "we couldn't send it". Previously this returned void and
 * swallowed failures, which meant a misconfigured provider looked identical to a successful
 * send — the user was told to check an inbox that would never receive anything.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const transport = getTransport();

  if (!transport) {
    logger.info({ to: input.to, subject: input.subject }, "[email:dev-fallback] SMTP not configured — logging instead of sending");
    logger.info(input.text);
    return false;
  }

  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "SATyping <no-reply@satyping.example>",
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return true;
  } catch (err) {
    // Log the provider's own message — it names the actual cause (unverified sender, unauthorised
    // IP, bad app password), which is otherwise invisible and very hard to guess.
    logger.error(
      { err, to: input.to, host: process.env.SMTP_HOST, from: process.env.EMAIL_FROM },
      "Failed to send email — check SMTP credentials, sender verification, and IP allowlisting",
    );
    return false;
  }
}

function frontendUrl(path: string): string {
  const base = process.env.FRONTEND_URL ?? "http://localhost:5000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<boolean> {
  const link = frontendUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  return sendEmail({
    to,
    subject: "Verify your email — SATyping",
    text: `Hi ${name},\n\nVerify your email by visiting: ${link}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi ${name},</p><p>Verify your email by clicking the link below:</p><p><a href="${link}">Verify my email</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<boolean> {
  const link = frontendUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  return sendEmail({
    to,
    subject: "Reset your password — SATyping",
    text: `Hi ${name},\n\nReset your password by visiting: ${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: `<p>Hi ${name},</p><p>Reset your password by clicking the link below:</p><p><a href="${link}">Reset my password</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
  });
}

/**
 * Verifies the SMTP configuration without sending anything — used by the check-email script and
 * safe to call at boot. Returns the provider's own error message on failure, which is what
 * actually tells you why delivery is broken.
 */
export async function verifyEmailTransport(): Promise<{ ok: boolean; configured: boolean; error?: string }> {
  const transport = getTransport();
  if (!transport) return { ok: false, configured: false };
  try {
    await transport.verify();
    return { ok: true, configured: true };
  } catch (err) {
    return { ok: false, configured: true, error: (err as Error).message };
  }
}
