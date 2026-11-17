// تعديل العدادات (reactionsCount, commentsCount, repliesCount) بـ $inc، ومبتنزلش تحت صفر.

// by موجب = زيادة، by سالب = نقصان (بحد أدنى صفر)
exports.incCounter = async (Model, id, field, by = 1) => {
  if (!by) return;

  if (by > 0) {
    await Model.updateOne({ _id: id }, { $inc: { [field]: by } });
    return;
  }

  const amount = -by;
  // لو العداد كبير كفاية ننقص عادي
  const result = await Model.updateOne({ _id: id, [field]: { $gte: amount } }, { $inc: { [field]: by } });
  // لو أقل من المطلوب (بيانات قديمة مش مظبوطة) نصفّره بدل ما ينزل بالسالب
  if (result.modifiedCount === 0) {
    await Model.updateOne({ _id: id, [field]: { $lt: amount } }, { $set: { [field]: 0 } });
  }
};
