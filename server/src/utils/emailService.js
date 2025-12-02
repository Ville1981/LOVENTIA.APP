// PATH: server/src/utils/emailService.js
// --- REPLACE START: Transactional email service + in-memory log ---
import sendEmail from "./sendEmail.js";

const MAX_LOG_ENTRIES = 100;

// In-memory log; dev/debug-käyttöön
const emailLog = [];

/**
 * Internal helper: push entry safely into the log with sane defaults.
 */
function safePushLog(entry) {
  try {
    const normalized = {
      type: entry?.type || "unknown",
      to: entry?.to || null,
      subject: entry?.subject || null,
      template: entry?.template || null,
      status: entry?.status || "unknown",
      error: entry?.error || null,
      meta: entry?.meta || {},
      createdAt: entry?.createdAt || new Date(),
    };

    emailLog.push(normalized);

    if (emailLog.length > MAX_LOG_ENTRIES) {
      // pidetään vain viimeisimmät N
      emailLog.splice(0, emailLog.length - MAX_LOG_ENTRIES);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[emailService] safePushLog error:", err);
  }
}

/**
 * Public helper: logEmailEvent
 *  - käytetään mm. debug-endpointista ja sisäisesti sendTransactionalEmailistä.
 */
export function logEmailEvent(entry) {
  safePushLog(entry || {});
}

/**
 * Palauta viimeisimmät logimerkinnät (uusin ensin).
 */
export function getEmailLog(limit = 20) {
  const n = Number.isFinite(limit) && limit > 0 ? limit : 20;

  if (emailLog.length <= n) {
    return [...emailLog].reverse();
  }

  // Viimeiset n, käännettynä uusimmasta vanhimpaan
  return emailLog.slice(emailLog.length - n).reverse();
}

/**
 * Tyhjennä logi.
 */
export function clearEmailLog() {
  emailLog.splice(0, emailLog.length);
}

/**
 * Varsinainen transactional email -kutsu.
 *
 * options:
 *  - type: lyhyt tunniste (esim. "billing:purchase", "billing:cancel")
 *  - to, subject, html, text, template, context
 *  - meta: vapaa metadata (esim. { subscriptionId, stripeCustomerId })
 *  - send: boolean, jos false → ei yritetä oikeaa lähetystä (vain logitus)
 */
export async function sendTransactionalEmail(options = {}) {
  const {
    type = "generic",
    to,
    subject,
    html,
    text,
    template,
    context,
    meta = {},
    send = true,
  } = options;

  const createdAt = new Date();

  if (!to) {
    // Ei vastaanottajaa → pelkkä logi
    safePushLog({
      type,
      to: null,
      subject,
      template,
      status: "skipped",
      error: "Missing 'to' address",
      meta: { ...meta, reason: "missing-to" },
      createdAt,
    });

    return { ok: false, status: "skipped", reason: "missing-to" };
  }

  let status = "pending";
  let error = null;

  // Yritetään oikeaa lähetystä vain jos send===true JA meillä on sendEmail-funktio
  if (send && typeof sendEmail === "function") {
    try {
      await sendEmail({
        to,
        subject,
        html,
        text,
        template,
        context,
      });
      status = "sent";
    } catch (err) {
      status = "error";
      error = err?.message || String(err);
      // eslint-disable-next-line no-console
      console.error("[emailService] sendTransactionalEmail error:", err);
    }
  } else {
    status = "skipped";
  }

  safePushLog({
    type,
    to,
    subject,
    template,
    status,
    error,
    meta,
    createdAt,
  });

  return {
    ok: status === "sent" || status === "skipped",
    status,
    error,
  };
}

const defaultExport = {
  sendTransactionalEmail,
  getEmailLog,
  clearEmailLog,
  logEmailEvent,
};

export default defaultExport;
// --- REPLACE END ---


