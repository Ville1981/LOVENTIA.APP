// server/utils/sendEmail.js

// --- REPLACE START: convert to ESM imports ---
import nodemailer from 'nodemailer';
// --- REPLACE END ---

/**
 * Sends an email using SMTP transport.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} text - Plain-text body of the email
 */
async function sendEmail(to, subject, text) {
  try {
    // --- REPLACE START: configure transporter via environment variables ---
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    // --- REPLACE END ---

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

// --- REPLACE START: export sendEmail as default ESM ---
export default sendEmail;
// --- REPLACE END ---
