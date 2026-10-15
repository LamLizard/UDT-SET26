const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const PLACEHOLDER_SECRET = 'replace_with_a_long_random_secret';

let cached = null;

// Reads and validates environment variables once. Never prints secret values.
function loadConfig() {
  if (cached) return cached;

  const env = process.env;
  const problems = [];

  const required = [
    'JWT_SECRET',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_APP_PASSWORD',
    'APP_BASE_URL',
  ];
  const missing = required.filter((key) => !env[key] || !env[key].trim());
  if (missing.length > 0) {
    problems.push(`Missing environment variables: ${missing.join(', ')}`);
  }

  if (env.JWT_SECRET && (env.JWT_SECRET === PLACEHOLDER_SECRET || env.JWT_SECRET.length < 32)) {
    problems.push('JWT_SECRET must be a real random value of at least 32 characters');
  }

  const jwtExpiresDays = Number(env.JWT_EXPIRES_DAYS || '3');
  if (!Number.isFinite(jwtExpiresDays) || jwtExpiresDays <= 0) {
    problems.push('JWT_EXPIRES_DAYS must be a positive number');
  }

  const port = Number(env.PORT || '3000');
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    problems.push('PORT must be an integer between 0 and 65535');
  }

  const smtpPort = Number(env.SMTP_PORT);
  if (env.SMTP_PORT && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
    problems.push('SMTP_PORT must be an integer between 1 and 65535');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
  }

  cached = {
    port,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresDays,
    smtpHost: env.SMTP_HOST,
    smtpPort,
    smtpUser: env.SMTP_USER,
    smtpAppPassword: env.SMTP_APP_PASSWORD,
    appBaseUrl: env.APP_BASE_URL.replace(/\/+$/, ''),
    // DB_DIR is optional and mainly used by automated tests.
    dbDir: env.DB_DIR || path.join(ROOT_DIR, 'backend', 'db'),
    frontendDir: path.join(ROOT_DIR, 'frontend'),
  };
  return cached;
}

module.exports = { loadConfig };
