// server/src/utils/alertRules.js

// --- REPLACE START: Import notification helpers (ESM) ---
import axios from "axios";
import nodemailer from "nodemailer";

const {
  SLACK_WEBHOOK_URL,
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  ALERT_EMAIL_FROM,
  ALERT_EMAIL_TO,
} = process.env;
// --- REPLACE END ---

/**
 * Send a notification message to Slack via incoming webhook.
 * @param {string} message - The text message to send.
 */
async function sendSlackNotification(message) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    await axios.post(SLACK_WEBHOOK_URL, { text: message });
  } catch (error) {
    console.error("[alertRules] Slack notification failed:", error);
  }
}

/**
 * Nodemailer transporter setup for email notifications.
 */
const mailTransporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: Number(EMAIL_PORT),
  secure: EMAIL_PORT === "465", // true for port 465
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

/**
 * Send an email notification.
 * @param {string} subject - The email subject.
 * @param {string} message - The email body text.
 */
async function sendEmailNotification(subject, message) {
  if (!EMAIL_HOST) return;
  try {
    const recipients = (ALERT_EMAIL_TO || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    await mailTransporter.sendMail({
      from: ALERT_EMAIL_FROM,
      to: recipients,
      subject,
      text: message,
    });
  } catch (error) {
    console.error("[alertRules] Email notification failed:", error);
  }
}

/**
 * Check a metric against threshold and send notifications if exceeded.
 * @param {string} metricName - Name of the metric.
 * @param {number} currentValue - Current measured value.
 * @param {number} threshold - Threshold value to trigger notification.
 */
async function checkThreshold(metricName, currentValue, threshold) {
  if (currentValue > threshold) {
    const msg = `🚨 ${metricName} is ${currentValue} (threshold: ${threshold})`;
    console.warn("[alertRules]", msg);
    await sendSlackNotification(msg);
    await sendEmailNotification(`${metricName} Alert`, msg);
  }
}

// --- REPLACE START: Export notification helpers and threshold check (ESM) ---
export { sendSlackNotification, sendEmailNotification, checkThreshold };
// Provide a default export for consumers that may import the module as a whole.
export default { sendSlackNotification, sendEmailNotification, checkThreshold };
// --- REPLACE END ---

// Usage example (ESM):
// import { checkThreshold } from './alertRules.js';
// await checkThreshold('Error Rate', errorRate, Number(process.env.ERROR_RATE_THRESHOLD));
