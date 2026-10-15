const { verifyToken } = require('../utils/jwtUtils');
const { HttpError } = require('../utils/responseUtils');
const { getActiveUserById } = require('../services/authService');

// Returns the current active user or throws 401.
async function authenticate(req) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!match) {
    throw new HttpError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = verifyToken(match[1].trim());
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  // The token can be valid while the account no longer is, so check every time.
  const user = await getActiveUserById(payload.sub);
  if (!user) {
    throw new HttpError(401, 'Account not found or not active');
  }
  return user;
}

module.exports = { authenticate };
