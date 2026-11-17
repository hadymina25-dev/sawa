// أدوات الـ validation اليدوية (من غير مكتبات). كلها بترمي AppError 400 لو فيه مشكلة.
const AppError = require('./appError');

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

// هل النص ده ObjectId صالح؟
exports.isValidId = (id) => typeof id === 'string' && OBJECT_ID_REGEX.test(id);

// بيتأكد إن المعرّف صالح (وإلا 400) ويرجّعه كنص
exports.requireId = (id, label = 'المعرّف') => {
  if (!exports.isValidId(id)) throw new AppError(`${label} غلط`, 400);
  return id;
};

// بينضّف حقل نصي ويتأكد من النوع والطول. لو الحقل مش مبعوت بيرجّع undefined.
exports.cleanText = (value, { label, min = 0, max, required = false }) => {
  if (value === undefined || value === null) {
    if (required) throw new AppError(`${label} مطلوب`, 400);
    return undefined;
  }
  if (typeof value !== 'string') throw new AppError(`${label} لازم يكون نص`, 400);
  const trimmed = value.trim();
  if (required && !trimmed) throw new AppError(`${label} مطلوب`, 400);
  if (trimmed.length < min) throw new AppError(`${label} لازم يكون ${min} حروف على الأقل`, 400);
  if (max && trimmed.length > max) throw new AppError(`${label} لازم ميزيدش عن ${max} حرف`, 400);
  return trimmed;
};

exports.isEmail = (email) => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// بيهرّب الرموز الخاصة في الـ regex عشان اليوزر مايعملش regex injection في البحث
exports.escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// بيتأكد من الباسورد (طول بس)
exports.requirePassword = (value, label = 'الباسورد', { min = 8, max = 72 } = {}) => {
  if (typeof value !== 'string' || !value) throw new AppError(`${label} مطلوب`, 400);
  if (value.length < min) throw new AppError(`${label} لازم يكون ${min} حروف على الأقل`, 400);
  if (value.length > max) throw new AppError(`${label} لازم ميزيدش عن ${max} حرف`, 400);
  return value;
};
