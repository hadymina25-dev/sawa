const express = require('express');
const auth = require('../controllers/authController');
const protect = require('../middlewares/protect');
const { loginLimiter, registerLimiter, forgotPasswordLimiter, resetPasswordLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/register', registerLimiter, auth.register);
router.post('/login', loginLimiter, auth.login);
router.post('/google', loginLimiter, auth.googleLogin);
router.post('/forgot-password', forgotPasswordLimiter, auth.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, auth.resetPassword);

router.post('/logout', protect, auth.logout);
router.post('/change-password', protect, auth.changePassword);
router.route('/me').get(protect, auth.getMe).delete(protect, auth.deleteAccount);

module.exports = router;
