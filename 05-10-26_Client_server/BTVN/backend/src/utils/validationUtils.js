const { HttpError } = require('./responseUtils');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validateEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    throw new HttpError(400, 'Please enter a valid email address');
  }
  return normalized;
}

function validateName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw new HttpError(400, 'Name must be between 1 and 50 characters');
  }
  return trimmed;
}

// Returns a list of broken rules (empty list = valid password).
function getPasswordProblems(password) {
  const problems = [];
  if (typeof password !== 'string') return ['be provided'];
  if (password.length < 8 || password.length > 20) {
    problems.push('be 8 to 20 characters long');
  }
  if (!/[A-Z]/.test(password)) problems.push('contain an uppercase letter');
  if (!/[a-z]/.test(password)) problems.push('contain a lowercase letter');
  if (!/[^A-Za-z0-9\s]/.test(password)) problems.push('contain a special character');
  return problems;
}

function validatePassword(password) {
  const problems = getPasswordProblems(password);
  if (problems.length > 0) {
    throw new HttpError(400, `Password must ${problems.join(', ')}`);
  }
}

// Counts Unicode characters (not UTF-16 units), so an emoji counts as 1.
function validateTaskContent(content) {
  const trimmed = typeof content === 'string' ? content.trim() : '';
  const length = Array.from(trimmed).length;
  if (length < 1 || length > 100) {
    throw new HttpError(400, 'Task content must be between 1 and 100 characters');
  }
  return trimmed;
}

module.exports = {
  normalizeEmail,
  validateEmail,
  validateName,
  validatePassword,
  validateTaskContent,
};
