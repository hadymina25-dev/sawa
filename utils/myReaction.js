// بيجيب ريأكشناتي أنا على صفحة كاملة (بوستات أو تعليقات) بـ query واحدة $in، مش N+1.
const Reaction = require('../models/Reaction');

// بيرجّع Map: idString -> { kind, type }
exports.getMyReactions = async (userId, targetType, targetIds) => {
  const map = new Map();
  if (!targetIds.length) return map;
  const rows = await Reaction.find({ user: userId, targetType, targetId: { $in: targetIds } })
    .select('targetId kind type')
    .lean();
  rows.forEach((r) => map.set(String(r.targetId), { kind: r.kind, type: r.type }));
  return map;
};
