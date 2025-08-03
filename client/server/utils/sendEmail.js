// server/utils/sendEmail.js

const nodemailer = require('nodemailer');

/**
 * Send an email using SMTP credentials from environment variables.
 *
 * If SMTP_USER / SMTP_PASS are not set, transporter is created
 * without auth (e.g. for MailDev).
 *
 * @param {string} to      Recipient email address
 * @param {string} subject Email subject line
 * @param {string} text    Plain-text body of the email
 */
async function sendEmail(to, subject, text) {
  // Base transport options
  const transportOptions = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
  };

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transportOptions.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }

  console.log('📧 sendEmail transportOptions:', transportOptions);
  const transporter = nodemailer.createTransport(transportOptions);

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || 'App'}" <${
        process.env.SMTP_USER || 'no-reply@example.com'
      }>`,
      to,
      subject,
      text,
    });
    console.log(`📧 Email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('❌ Error sending email:', err);
    throw err;
  }
}

module.exports = sendEmail;
