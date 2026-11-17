// خطأ "متوقع" بنرميه بنفسنا برسالة وكود حالة (400, 404, ...). معالج الأخطاء بيحوّله لرد JSON.
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
