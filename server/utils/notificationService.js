// server/src/utils/notificationService.js

const axios = require('axios');
const nodemailer = require('nodemailer');

// Environment variables
const {
  SLACK_WEBHOOK_URL,
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  ALERT_EMAIL_FROM,
  ALERT_EMAIL_TO
} = process.env;

/**
 * Send a notification message to Slack via incoming webhook.
 * @param {string} message - The text message to send.
 */
async function sendSlackNotification(message) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    await axios.post(SLACK_WEBHOOK_URL, { text: message });
  } catch (error) {
    console.error('Slack notification failed:', error);
  }
}

/**
 * Nodemailer transporter setup for email notifications.
 */
const mailTransporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: Number(EMAIL_PORT),
  secure: EMAIL_PORT === '465', // true for port 465, false for others
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
    await mailTransporter.sendMail({
      from: ALERT_EMAIL_FROM,
      to: ALERT_EMAIL_TO.split(',').map(s => s.trim()),
      subject,
      text: message,
    });
  } catch (error) {
    console.error('Email notification failed:', error);
  }
}

// --- REPLACE START: Export notification helpers ---
module.exports = {
  sendSlackNotification,
  sendEmailNotification,
};
// --- REPLACE END ---

// Import / Export example:
// const { sendSlackNotification, sendEmailNotification } = require('./notificationService');
