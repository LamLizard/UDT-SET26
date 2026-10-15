const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const DUMMY_SALT = 'dummy-salt-for-unknown-users';

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return { salt, hash: derived.toString('hex') };
}

async function verifyPassword(password, salt, storedHash) {
  const derived = await scrypt(password, salt, KEY_LENGTH);
  const stored = Buffer.from(storedHash, 'hex');
  // timingSafeEqual throws if lengths differ, so check first.
  if (stored.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

// Spends the same time as a real check so login timing does not reveal
// whether an email exists.
async function verifyDummy(password) {
  await scrypt(password, DUMMY_SALT, KEY_LENGTH);
  return false;
}

module.exports = { hashPassword, verifyPassword, verifyDummy };
