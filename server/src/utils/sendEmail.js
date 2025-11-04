// PATH: server/src/utils/sendEmail.js
// Purpose: minimal, robust email sender with ENV-based config and file logging.
// Notes:
// - Reads both EMAIL_* and SMTP_* so it works with different .env styles.
// - If SMTP is not configured, we do NOT crash: we log and use streamTransport (dev).
// - Always writes a log entry to ./logs/mail-YYYYMMDD-HHmmss.log so you can see
//   what would have been sent.
// - The replacement region is marked so you can later swap just the env/transport part.

import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { fileURLToPath } from "node:url";

// --- REPLACE START: resolve log folder + helper ---
// In your logs we saw Node starting from a PS pipe (Tee-Object) and sometimes
// C:\Windows\System32 ends up as CWD. In that case process.cwd() is WRONG for logs,
// so we add a fallback that resolves relative to THIS file (src/utils/...).
function getBaseDir() {
  // try to use the real process cwd first
  const cwd = process.cwd();
  if (cwd && fs.existsSync(cwd)) {
    return cwd;
  }

  // fallback: directory of this file (ESM-safe)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // go two levels up: server/src/utils → server
  const root = path.resolve(__dirname, "..", "..");
  return root;
}

function ensureLogsDir() {
  // prefer project root/logs, not Windows/system32/logs
  const baseDir = getBaseDir();
  const logsDir = path.resolve(baseDir, "logs");
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (err) {
    // don't crash mail on mkdir failure
    console.warn("[sendEmail] could not create logs directory:", err?.message || err);
  }
  return logsDir;
}

function writeMailLog(payload = {}) {
  const logsDir = ensureLogsDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(logsDir, `mail-${stamp}.log`);
  const data = JSON.stringify(payload, null, 2);
  try {
    fs.writeFileSync(file, data, "utf8");
  } catch (err) {
    console.warn("[sendEmail] could not write mail log:", err?.message || err);
  }
}
// --- REPLACE END ---

/**
 * Create a nodemailer transporter using ENV fallbacks.
 * Prefers EMAIL_* keys; falls back to SMTP_*; defaults to streamTransport in dev.
 */
function createTransporter() {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.EMAIL_SECURE || "").toLowerCase() === "true" ||
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
    port === 465;

  const user = process.env.EMAIL_USER || process.env.SMTP_USER || "";
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS || "";

  const missingSmtp = !host || (!user && !pass);

  if (missingSmtp) {
    // very important for your current debug
    console.warn(
      "[mail] SMTP not configured, skipping real send (using streamTransport). " +
        "Set EMAIL_HOST/EMAIL_USER/EMAIL_PASS or SMTP_HOST/SMTP_USER/SMTP_PASS."
    );
    return {
      transporter: nodemailer.createTransport({
        streamTransport: true,
        newline: "unix",
        buffer: true,
      }),
      smtpConfigured: false,
    };
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    }),
    smtpConfigured: true,
  };
}

/**
 * Default sender
 * EMAIL_FROM (full "Name <address>") wins; otherwise combine NAME + EMAIL.
 * Final fallback is "Loventia <no-reply@localhost>" for dev.
 */
// --- REPLACE START: from header normalization ---
function resolveFromHeader() {
  // If EMAIL_FROM is provided (e.g., "Loventia <no-reply@loventia.app>"), use as-is.
  const explicit = process.env.EMAIL_FROM;
  if (explicit && explicit.trim()) return explicit.trim();

  // Otherwise, compose from name + email fallbacks.
  const name =
    process.env.MAIL_FROM_NAME ||
    process.env.EMAIL_FROM_NAME ||
    "Loventia";

  const email =
    process.env.MAIL_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    "no-reply@localhost";

  return `"${name}" <${email}>`;
}
// --- REPLACE END ---

/**
 * Send email (text and/or html).
 * Returns nodemailer send result. In streamTransport mode, prints preview snippet to console.
 *
 * IMPORTANT:
 * - We ALWAYS write the mail-*.log before sending.
 * - Even if transporter fails, you will still see intent in logs/.
 * - This matches the controller wrapper you just updated (userController forgot-password).
 */
export default async function sendEmail(to, subject, text, html) {
  const { transporter, smtpConfigured } = createTransporter();
  const from = resolveFromHeader();

  // We'll log before sending, so even if send fails we see intent.
  const logPayload = {
    at: new Date().toISOString(),
    smtpConfigured,
    from,
    to,
    subject,
    text: text || null,
    html: html || null,
    env: {
      EMAIL_HOST: process.env.EMAIL_HOST || null,
      SMTP_HOST: process.env.SMTP_HOST || null,
      EMAIL_FROM: process.env.EMAIL_FROM || null,
      NODE_ENV: process.env.NODE_ENV || null,
    },
  };

  // write file log always (now using project root, not random CWD)
  writeMailLog(logPayload);

  let info;
  try {
    info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("[sendEmail] send failed:", err?.message || err);
    // do not throw, controller expects generic 200
    return null;
  }

  // DEV preview when using streamTransport
  if (!smtpConfigured && info && info.message && Buffer.isBuffer(info.message)) {
    try {
      const preview = info.message.toString("utf8");
      console.log("[sendEmail preview]\n" + preview.substring(0, 1200));
    } catch (e) {
      console.warn("[sendEmail preview] failed to print preview:", e?.message || e);
    }
  }

  return info;
}


