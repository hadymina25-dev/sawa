// معالج الأخطاء الوحيد. أي خطأ في أي مكان بيطلع بنفس الشكل: { success: false, message }
const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'حجم الملف أكبر من المسموح',
  LIMIT_FILE_COUNT: 'عدد الملفات أكبر من المسموح',
  LIMIT_UNEXPECTED_FILE: 'اسم حقل الملف غلط أو عدد الملفات زيادة عن المسموح',
  LIMIT_PART_COUNT: 'عدد الحقول كبير زيادة',
};

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'حصل خطأ';

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'الـ JSON المبعوت غلط';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'حجم الريكوست كبير زيادة';
  } else if (err.name === 'CastError') {
    status = 400;
    message = `قيمة غلط في الحقل ${err.path}`;
  } else if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('، ');
  } else if (err.code === 11000) {
    status = 409;
    const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : '';
    message = field === 'email' ? 'الإيميل ده متسجل قبل كده' : field === 'username' ? 'الـ username ده متاخد' : 'القيمة دي موجودة قبل كده';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'الجلسة منتهية أو التوكن غلط، سجّل دخول تاني';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = MULTER_MESSAGES[err.code] || err.message;
  }

  if (status >= 500) {
    console.error('❌', err);
    if (process.env.NODE_ENV === 'production') message = 'حصل خطأ في السيرفر';
  }

  res.status(status).json({ success: false, message });
};
