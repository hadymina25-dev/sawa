// بيحمي الـ routes: يتحقق من الـ JWT، ويتأكد إن اليوزر لسه موجود، ويقارن نسخة التوكن (tv).
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

module.exports = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError('لازم تسجل دخول الأول', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw new AppError('الجلسة منتهية أو التوكن غلط، سجّل دخول تاني', 401);
  }

  const user = await User.findById(decoded.id).select('+tokenVersion');
  if (!user || user.isDeleted) throw new AppError('الحساب ده مش موجود', 401);

  // توكن قديم من غير tv بيتعامل كأنه 0
  if ((decoded.tv || 0) !== (user.tokenVersion || 0)) {
    throw new AppError('الجلسة انتهت، سجّل دخول تاني', 401);
  }

  req.user = user;
  next();
});
