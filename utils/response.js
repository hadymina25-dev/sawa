// شكل الرد الموحد في كل الـ API:
//   نجاح: { success: true, message, data, pagination? , summary? }
//   خطأ:  { success: false, message }   (بيتبعت من middlewares/errorHandler.js)

// meta: حقول إضافية جنب data (زي pagination في الـ lists)
exports.ok = (res, data = null, message = 'تمام', status = 200, meta = {}) =>
  res.status(status).json({ success: true, message, data, ...meta });

exports.created = (res, data = null, message = 'تم الإنشاء بنجاح', meta = {}) =>
  exports.ok(res, data, message, 201, meta);
