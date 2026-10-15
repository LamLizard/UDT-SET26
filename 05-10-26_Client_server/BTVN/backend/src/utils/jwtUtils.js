const jwt = require('jsonwebtoken');
const { loadConfig } = require('../config');

const ALGORITHM = 'HS256';

function signToken(userId) {
  const { jwtSecret, jwtExpiresDays } = loadConfig();
  return jwt.sign({}, jwtSecret, {
    subject: userId, // standard "sub" claim
    expiresIn: Math.round(jwtExpiresDays * 24 * 60 * 60), // seconds
    algorithm: ALGORITHM,
  });
}

// Throws if the signature is wrong or the token is expired.
function verifyToken(token) {
  const { jwtSecret } = loadConfig();
  return jwt.verify(token, jwtSecret, { algorithms: [ALGORITHM] });
}

module.exports = { signToken, verifyToken };
