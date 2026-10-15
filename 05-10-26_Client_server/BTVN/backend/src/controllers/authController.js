const authService = require('../services/authService');
const { HttpError, sendOk, sendHtml } = require('../utils/responseUtils');

// Simple in-memory limit per IP for the resend endpoint (resets when the server restarts).
const RESEND_WINDOW_MS = 10 * 60 * 1000;
const RESEND_MAX_PER_WINDOW = 5;
const resendHits = new Map();

function checkResendRateLimit(ip) {
  const now = Date.now();
  if (resendHits.size > 1000) resendHits.clear(); // keep memory bounded
  const recent = (resendHits.get(ip) || []).filter((t) => now - t < RESEND_WINDOW_MS);
  if (recent.length >= RESEND_MAX_PER_WINDOW) {
    resendHits.set(ip, recent);
    throw new HttpError(429, 'Too many requests. Please try again later.');
  }
  recent.push(now);
  resendHits.set(ip, recent);
}

async function signup({ res, body }) {
  const user = await authService.signup(body);
  sendOk(
    res,
    'Account created. Email verification is required: a verification email is being sent. Open the link in it (valid for 15 minutes), then log in.',
    { email: user.email },
    201
  );
}

async function login({ res, body }) {
  const result = await authService.login(body);
  sendOk(res, 'Login successful', result);
}

async function logout({ res }) {
  // Stateless JWT: the browser deletes its token, but a copied token stays valid until it expires.
  sendOk(res, 'Logged out on this device. (The token itself is not revoked on the server.)');
}

async function me({ res, user }) {
  sendOk(res, 'OK', user);
}

async function resendVerification({ req, res, body }) {
  checkResendRateLimit(req.socket.remoteAddress || 'unknown');
  await authService.resendVerification(body.email);
  sendOk(res, 'If a pending account exists for this email, a new verification email is being sent.');
}

function resultPage(title, message, ok) {
  const color = ok ? '#1a7f37' : '#c62828';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{font-family:Arial,sans-serif;background:#f4f6f8;display:flex;justify-content:center;padding-top:80px}
.box{background:#fff;padding:32px 40px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:420px;text-align:center}
h1{color:${color};font-size:22px}a{color:#1565c0}</style></head>
<body><div class="box"><h1>${title}</h1><p>${message}</p><p><a href="/page/login.html">Go to Login</a></p></div></body></html>`;
}

async function verifyEmail({ res, query }) {
  try {
    await authService.verifyEmail(query.token);
    sendHtml(res, 200, resultPage('Email verified', 'Your account is now active. You can log in.', true));
  } catch (err) {
    if (err instanceof HttpError) {
      sendHtml(res, err.statusCode, resultPage('Verification failed', err.message, false));
      return;
    }
    throw err;
  }
}

module.exports = { signup, login, logout, me, resendVerification, verifyEmail };
