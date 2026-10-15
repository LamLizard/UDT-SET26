const crypto = require('node:crypto');
const userStore = require('../store/userStore');
const { hashPassword, verifyPassword, verifyDummy } = require('../utils/passwordUtils');
const { signToken } = require('../utils/jwtUtils');
const { HttpError } = require('../utils/responseUtils');
const { validateEmail, validateName, validatePassword, normalizeEmail } = require('../utils/validationUtils');
const emailService = require('./emailService');

const VERIFICATION_LIFETIME_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function generateVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

// Plain SHA-256 is fine here: the token is 256 bits of random data, not a human password.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toSafeUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

// Sends the email after the response is already on its way. Success is only logged
// after Nodemailer confirms; failures are logged without the token.
function sendEmailInBackground(user, token) {
  emailService
    .sendVerificationEmail({ to: user.email, name: user.name, token })
    .then(() => console.log(`Verification email accepted by SMTP server for user ${user.id}`))
    .catch((err) => console.error(`Failed to send verification email for user ${user.id}: ${err.message}`));
}

async function signup({ name, email, password }) {
  const cleanName = validateName(name);
  const cleanEmail = validateEmail(email);
  validatePassword(password);

  // Fast rejection using the in-memory index (no file read at all).
  if (userStore.getByEmail(cleanEmail)) {
    throw new HttpError(409, 'This email is already registered');
  }

  const { salt, hash } = await hashPassword(password);
  const { token, tokenHash } = generateVerificationToken();
  const now = Date.now();

  // add() is synchronous, so the duplicate check and id allocation happen atomically
  // (single-threaded JS). The id is the smallest unused integer.
  const user = userStore.add({
    email: cleanEmail,
    passwordSalt: salt,
    passwordHash: hash,
    name: cleanName,
    status: 'pending',
    verificationTokenHash: tokenHash,
    verificationExpiresAt: new Date(now + VERIFICATION_LIFETIME_MS).toISOString(),
    verificationSentAt: new Date(now).toISOString(),
    createdAt: new Date(now).toISOString(),
  });
  if (!user) throw new HttpError(409, 'This email is already registered');

  // Persist with a single append. No full-file rewrite, so cost does not grow with user count.
  await userStore.persist(user);

  // Account is saved. Do not wait for SMTP.
  sendEmailInBackground(user, token);
  return toSafeUser(user);
}

async function verifyEmail(token) {
  if (typeof token !== 'string' || token.length === 0 || token.length > 200) {
    throw new HttpError(400, 'Invalid or already used verification link');
  }
  const tokenHash = hashToken(token);

  const user = userStore.find((u) => u.verificationTokenHash !== '' && u.verificationTokenHash === tokenHash);
  if (!user) {
    throw new HttpError(400, 'Invalid or already used verification link');
  }
  if (new Date(user.verificationExpiresAt).getTime() < Date.now()) {
    throw new HttpError(400, 'This verification link has expired. Please request a new one.');
  }
  user.status = 'active';
  user.verificationTokenHash = '';
  user.verificationExpiresAt = '';
  await userStore.save(user);
}

// Always looks the same from the outside, except for the rate limit (429).
async function resendVerification(email) {
  const cleanEmail = validateEmail(email);
  const user = userStore.getByEmail(cleanEmail);
  if (!user || user.status !== 'pending') {
    return;
  }
  const lastSent = new Date(user.verificationSentAt).getTime();
  if (Number.isFinite(lastSent) && Date.now() - lastSent < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
    throw new HttpError(429, `Please wait ${wait} seconds before requesting another email`);
  }
  const { token, tokenHash } = generateVerificationToken();
  const now = Date.now();
  user.verificationTokenHash = tokenHash;
  user.verificationExpiresAt = new Date(now + VERIFICATION_LIFETIME_MS).toISOString();
  user.verificationSentAt = new Date(now).toISOString();
  await userStore.save(user);
  sendEmailInBackground({ ...user }, token);
}

async function login({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || typeof password !== 'string' || password.length === 0 || password.length > 200) {
    throw new HttpError(400, 'Email and password are required');
  }

  const user = userStore.getByEmail(cleanEmail);

  if (!user) {
    await verifyDummy(password);
    throw new HttpError(401, 'Invalid email or password');
  }
  const passwordOk = await verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!passwordOk) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (user.status !== 'active') {
    // Only reached with the correct password, so this does not leak to strangers.
    throw new HttpError(403, 'Please verify your email before logging in', { code: 'EMAIL_NOT_VERIFIED' });
  }

  return { token: signToken(user.id), user: toSafeUser(user) };
}

async function getActiveUserById(id) {
  if (typeof id !== 'string' || !id) return null;
  const user = userStore.getById(id);
  return user && user.status === 'active' ? toSafeUser(user) : null;
}

module.exports = { signup, verifyEmail, resendVerification, login, getActiveUserById };
