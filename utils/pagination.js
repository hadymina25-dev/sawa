// pagination موحد: page (الافتراضي 1)، limit (الافتراضي 10، الأقصى 50).
const AppError = require('./appError');

// بيقرا page و limit من الـ query ويرجّع { page, limit, skip }
exports.getPagination = (query = {}) => {
  const page = query.page === undefined ? 1 : Number(query.page);
  let limit = query.limit === undefined ? 10 : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) throw new AppError('page لازم يكون رقم صحيح من 1 وطالع', 400);
  if (!Number.isInteger(limit) || limit < 1) throw new AppError('limit لازم يكون رقم صحيح من 1 وطالع', 400);
  if (limit > 50) limit = 50;

  return { page, limit, skip: (page - 1) * limit };
};

// شكل الـ pagination اللي بيرجع جنب data في كل list
exports.buildPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
