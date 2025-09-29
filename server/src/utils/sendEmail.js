// PATH: server/src/utils/sendEmail.js

// --- REPLACE START: convert to pure ESM with default export ---
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/**
 * Sends an email using SMTP transport.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} text - Plain-text body of the email
 */
export default async function sendEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || "587", 10),
      secure: String(process.env.EMAIL_SECURE || "").toLowerCase() === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error("Error sending email:", err);
    throw err;
  }
}
// --- REPLACE END ---
