const nodemailer = require('nodemailer');
const { loadConfig } = require('../config');

let transport = null;

function getTransport() {
  if (!transport) {
    const config = loadConfig();
    transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465, // 465 = implicit TLS, 587 = STARTTLS
      auth: { user: config.smtpUser, pass: config.smtpAppPassword }
    });
  }
  return transport;
}

// Lets automated tests replace the real SMTP connection.
function setTransport(customTransport) {
  transport = customTransport;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Resolves only after the SMTP server accepted the message; rejects otherwise.
async function sendVerificationEmail({ to, name, token }) {
  const config = loadConfig();
  const link = `${config.appBaseUrl}/api/verify-email?token=${encodeURIComponent(token)}`;

  await getTransport().sendMail({
    from: `"Todo list" <${config.smtpUser}>`,
    to,
    subject: 'Verify your email for Todo list',
    text: `Hello ${name},\n\nPlease verify your email by opening this link (valid for 15 minutes):\n${link}\n\nIf you did not create this account, you can ignore this email.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Please verify your email by clicking the link below (valid for 15 minutes):</p><p><a href="${escapeHtml(link)}">Verify my email</a></p><p>If you did not create this account, you can ignore this email.</p>`,
  });
}

module.exports = { sendVerificationEmail, setTransport };
