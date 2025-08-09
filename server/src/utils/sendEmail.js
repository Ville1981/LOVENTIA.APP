// File: server/src/utils/sendEmail.js

// --- REPLACE START: convert to CommonJS and default export to module.exports ---
const nodemailer = require('nodemailer');

/**
 * Sends an email using SMTP transport.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} text - Plain-text body of the email
 */
async function sendEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: String(process.env.EMAIL_SECURE).toLowerCase() === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error('Error sending email:', err);
    throw err;
  }
}

module.exports = sendEmail;
// --- REPLACE END ---
