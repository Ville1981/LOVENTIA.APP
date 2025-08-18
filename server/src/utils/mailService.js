// --- REPLACE START: mail service utility (Nodemailer SMTP) ---
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM_NAME,
  MAIL_FROM_EMAIL,
} = process.env;

// Create and cache a transporter (avoid re-creating on every send)
let cachedTransporter;

/**
 * Build (or reuse) a Nodemailer transporter from environment variables.
 * Keeps behavior compatible with Gmail (App Password) and generic SMTP.
 */
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = SMTP_HOST || "localhost";
  const port = Number(SMTP_PORT || 1025);
  const secure =
    (SMTP_SECURE || "").toString().toLowerCase() === "true" || port === 465;

  const auth =
    SMTP_USER && SMTP_PASS
      ? {
          user: SMTP_USER,
          pass: SMTP_PASS,
        }
      : undefined;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
  });

  return cachedTransporter;
}

/**
 * Generic sendMail wrapper used across the app.
 * @param {{to:string|string[],subject:string,html?:string,text?:string,replyTo?:string}} param0
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
export async function sendMail({ to, subject, html, text, replyTo }) {
  const transporter = getTransporter();

  const fromName = MAIL_FROM_NAME || "LoventiaApp";
  const fromAddr = MAIL_FROM_EMAIL || SMTP_USER || "no-reply@localhost";
  const from = `"${fromName}" <${fromAddr}>`;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
      replyTo,
    });
    console.log("[mailService] Sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("[mailService] Error sending mail:", err?.message || err);
    throw err;
  }
}

/**
 * Optional: quick health check to verify SMTP config at startup.
 * Call this during boot if needed (won't throw on failure unless you handle it).
 */
export async function verifyMailer() {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log("[mailService] SMTP connection verified.");
    return true;
  } catch (err) {
    console.warn(
      "[mailService] SMTP verification failed:",
      err?.message || err
    );
    return false;
  }
}

export default { sendMail, verifyMailer };
// --- REPLACE END ---
