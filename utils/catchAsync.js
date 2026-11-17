// بيلف أي كنترولر async عشان أي خطأ يروح لمعالج الأخطاء من غير try/catch في كل مكان.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
