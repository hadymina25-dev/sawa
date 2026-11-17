// حدود عدد الريكوستات على الـ endpoints الحساسة. لما تعدّي الحد بيرجع 429 بنفس شكل الرد الموحد.
const rateLimit = require('express-rate-limit');

const make = (limit, minutes, message) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ success: false, message }),
  });

exports.loginLimiter = make(10, 15, 'محاولات دخول كتير، جرّب تاني بعد 15 دقيقة');
exports.registerLimiter = make(20, 60, 'محاولات تسجيل كتير، جرّب تاني بعد ساعة');
exports.forgotPasswordLimiter = make(5, 15, 'طلبات استعادة باسورد كتير، جرّب تاني بعد 15 دقيقة');
exports.resetPasswordLimiter = make(10, 15, 'محاولات كتير، جرّب تاني بعد 15 دقيقة');
