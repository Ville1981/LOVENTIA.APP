// --- REPLACE START: server/testMailer.js (standalone SMTP connectivity & send test) ---
/**
 * SMTP Test Sender (ESM)
 *
 * How to run:
 *   node server/testMailer.js [optional-recipient-email]
 *
 * What it does:
 *  1) Loads .env
 *  2) Verifies SMTP connection (transporter.verify)
 *  3) Sends a simple test email to the recipient:
 *       - CLI arg #1, or TEST_EMAIL, or SMTP_USER (fallback)
 *  4) Prints helpful diagnostics (no secrets)
 *
 * Notes:
 *  - Uses the same shape as authController's mail helpers so behavior matches production.
 *  - If you use Gmail, remember: SMTP_PASS must be a Google "App Password".
 */

import 'dotenv/config';
import nodemailer from 'nodemailer';

// --------- Helpers (inline copy to avoid importing app code) ----------
function boolEnv(name, fallback = false) {
  const v = (process.env[name] ?? '').toString().trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

function buildTransporter() {
  const host   = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port   = Number(process.env.SMTP_PORT || 587);
  const secure = boolEnv('SMTP_SECURE', port === 465);
  const user   = process.env.SMTP_USER;
  const pass   = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('⚠️  Missing SMTP_USER or SMTP_PASS — authentication may fail.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  return transporter;
}

function redacted(v, keep = 2) {
  if (!v) return '';
  const s = String(v);
  if (s.length <= keep * 2) return '*'.repeat(Math.max(4, s.length));
  return s.slice(0, keep) + '*'.repeat(s.length - keep * 2) + s.slice(-keep);
}

function showConfigSummary() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = boolEnv('SMTP_SECURE', port === 465);
  const user = process.env.SMTP_USER || '';
  const fromName  = process.env.MAIL_FROM_NAME || 'LoventiaApp';
  const fromEmail = process.env.MAIL_FROM_EMAIL || user || 'no-reply@localhost';

  console.log('--- SMTP config (sanitized) ---');
  console.log('HOST   :', host);
  console.log('PORT   :', port);
  console.log('SECURE :', secure);
  console.log('USER   :', user ? redacted(user, 3) : '(empty)');
  console.log('FROM   :', `"${fromName}" <${fromEmail}>`);
  console.log('--------------------------------\n');
}

// ----------------------- Main -----------------------
async function main() {
  try {
    const toArg = process.argv[2];
    const to =
      (toArg && toArg.trim()) ||
      (process.env.TEST_EMAIL && process.env.TEST_EMAIL.trim()) ||
      (process.env.SMTP_USER && process.env.SMTP_USER.trim());

    if (!to) {
      console.error(
        '❌ No recipient found. Provide an email: `node server/testMailer.js someone@example.com`\n' +
        '   Or set TEST_EMAIL or SMTP_USER in .env.'
      );
      process.exit(1);
    }

    showConfigSummary();

    const transporter = buildTransporter();

    // 1) Verify transport first — catches auth/port/host issues early
    process.stdout.write('Verifying SMTP connection... ');
    await transporter.verify();
    console.log('✅ OK');

    // 2) Send a test mail
    const fromName  = process.env.MAIL_FROM_NAME || 'LoventiaApp';
    const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@localhost';
    const from = `"${fromName}" <${fromEmail}>`;

    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Loventia • SMTP test',
      text:
        'This is a test email from Loventia server.\n' +
        'If you received this, SMTP is configured correctly.',
      html: `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.5">
          <h2>SMTP test from <em>Loventia</em></h2>
          <p>If you can read this, your SMTP settings work 🎉</p>
          <p><small>Time: ${new Date().toISOString()}</small></p>
        </div>
      `,
    });

    console.log('📨 Message sent. ID:', info.messageId || '(n/a)');
    if (info.accepted?.length) {
      console.log('✅ Accepted for:', info.accepted.join(', '));
    }
    if (info.rejected?.length) {
      console.warn('⚠️  Rejected:', info.rejected.join(', '));
    }

    console.log('\nDone. You can now test the real Forgot Password flow in the app.');
  } catch (err) {
    // Give actionable hints for common Gmail issues
    const msg = err?.message || String(err);
    console.error('\n❌ Mail error:', msg);

    if (/invalid login|auth|authentication/i.test(msg)) {
      console.error(
        '\nHints:\n' +
        '  • For Gmail, use a Google App Password (not your normal password).\n' +
        '  • Check 2-Step Verification is enabled on your Google account.\n' +
        '  • Ensure SMTP_USER matches the mailbox you want to send from.\n'
      );
    } else if (/self signed certificate/i.test(msg)) {
      console.error(
        '\nHint: If you are on a corporate network MITM proxy, try setting a proper CA or test with another network.\n'
      );
    } else if (/getaddrinfo|ENOTFOUND/i.test(msg)) {
      console.error(
        '\nHint: Hostname resolution failed. Check SMTP_HOST and your internet connection.\n'
      );
    }

    process.exit(1);
  }
}

main();
// --- REPLACE END ---
