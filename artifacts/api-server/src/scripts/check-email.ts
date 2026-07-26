/**
 * SMTP configuration diagnostic.
 *
 *   pnpm --filter @workspace/api-server run check-email
 *   pnpm --filter @workspace/api-server run check-email you@example.com   # also sends a test
 *
 * Exists because "the verification email never arrived" has several very different causes that
 * all look identical from the app: unset env vars, wrong credentials, an unverified sender
 * domain, or provider-side IP allowlisting. This reports which one it actually is.
 */
import "../env";

import { verifyEmailTransport, sendEmail } from "../lib/email";

function mask(value: string | undefined): string {
  if (!value) return "(unset)";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}${"*".repeat(Math.min(value.length - 4, 20))}${value.slice(-2)}`;
}

async function main() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, FRONTEND_URL } = process.env;

  console.log("=== SMTP configuration ===\n");
  console.log(`  SMTP_HOST    : ${SMTP_HOST ?? "(unset)"}`);
  console.log(`  SMTP_PORT    : ${SMTP_PORT ?? "(unset)"}`);
  console.log(`  SMTP_USER    : ${SMTP_USER ?? "(unset)"}`);
  console.log(`  SMTP_PASS    : ${mask(SMTP_PASS)}`);
  console.log(`  EMAIL_FROM   : ${EMAIL_FROM ?? "(unset — falls back to a placeholder address)"}`);
  console.log(`  FRONTEND_URL : ${FRONTEND_URL ?? "(unset — verification links default to http://localhost:5000)"}`);
  console.log("");

  const result = await verifyEmailTransport();

  if (!result.configured) {
    console.log("STATUS: SMTP is NOT configured.");
    console.log("        Emails are logged to the console instead of sent. This is fine for local");
    console.log("        development, but verification/reset emails will never reach real inboxes.");
    console.log("        Set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS to enable sending.");
    process.exit(1);
  }

  if (!result.ok) {
    console.log(`STATUS: SMTP is configured but the connection FAILED.\n`);
    console.log(`  Provider said: ${result.error}\n`);
    console.log("  Common causes:");
    console.log("    525 / 5.7.1 Unauthorized IP address");
    console.log("        The provider restricts SMTP to an IP allowlist and this machine is not on");
    console.log("        it. In Brevo: Security -> Authorised IPs. Note a deployed server has a");
    console.log("        different IP than your laptop, so both need adding (or the restriction");
    console.log("        disabling).");
    console.log("    535 / authentication failed");
    console.log("        Wrong SMTP key. For Brevo use the SMTP key, not the account password;");
    console.log("        for Gmail use a 16-character App Password, not the account password.");
    console.log("    553 / sender not valid");
    console.log("        EMAIL_FROM uses a domain the provider has not verified.");
    process.exit(1);
  }

  console.log("STATUS: SMTP connection OK — credentials accepted.\n");

  const recipient = process.argv[2];
  if (!recipient) {
    console.log("Pass an address to send a real test message:");
    console.log("  pnpm --filter @workspace/api-server run check-email you@example.com");
    process.exit(0);
  }

  console.log(`Sending a test email to ${recipient}...`);
  const sent = await sendEmail({
    to: recipient,
    subject: "SATyping — SMTP test",
    text: "This is a test message from SATyping. If you received it, email delivery is working.",
    html: "<p>This is a test message from <strong>SATyping</strong>.</p><p>If you received it, email delivery is working.</p>",
  });

  if (sent) {
    console.log("Sent. Check the inbox (and the spam folder).");
    console.log("If it does not arrive despite this success, the provider accepted it but then");
    console.log("dropped it — check the provider's own delivery/bounce logs.");
    process.exit(0);
  }

  console.log("Send FAILED — see the logged error above for the provider's reason.");
  process.exit(1);
}

main().catch((err) => {
  console.error("check-email failed:", err);
  process.exit(1);
});
