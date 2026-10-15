const authController = require('../controllers/authController');

module.exports = [
  { method: 'POST', path: '/api/signup', handler: authController.signup },
  { method: 'POST', path: '/api/login', handler: authController.login },
  { method: 'POST', path: '/api/logout', protect: true, handler: authController.logout },
  { method: 'GET', path: '/api/verify-email', handler: authController.verifyEmail },
  { method: 'POST', path: '/api/resend-verification', handler: authController.resendVerification },
  { method: 'GET', path: '/api/me', protect: true, handler: authController.me },
];
