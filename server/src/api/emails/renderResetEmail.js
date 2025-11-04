// PATH: server/src/api/emails/renderResetEmail.js
// Purpose: simple HTML/text renderer for password reset emails (ESM).

export default function renderResetEmail({ appName, resetUrl }) {
  const subject = `${appName} password reset`;
  const text = [
    'You requested a password reset.',
    '',
    'Click the link to set a new password:',
    resetUrl,
    '',
    "If you didn't request this, you can ignore this email.",
  ].join('\n');

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.4;color:#111">
    <h2 style="margin:0 0 12px">${appName} password reset</h2>
    <p>You requested a password reset.</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;border:1px solid #222">Click here to set a new password</a></p>
    <!-- The replacement region is marked so you can verify exactly what changed -->
    // --- REPLACE START: copy tweaks (UTF/quotes) ---
    <p>If you didn't request this, you can ignore this email.</p>
    // --- REPLACE END ---
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
    <p style="font-size:12px;color:#666">This link will expire shortly for your security.</p>
  </div>
  `.trim();

  return { subject, text, html };
}
