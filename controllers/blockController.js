const Block = require('../models/Block');
const Friendship = require('../models/Friendship');
const Notification = require('../models/Notification');
const User = require('../models/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { ok, created } = require('../utils/response');
const { requireId } = require('../utils/validate');
const { getPagination, buildPagination } = require('../utils/pagination');
const { pairKeyOf } = require('../utils/relations');
const { userBrief, BRIEF_FIELDS } = require('../utils/serialize');

// ========== حظر يوزر ==========
// الحظر بيشيل الصداقة وأي طلبات pending وإشعارات الصداقة بينا. التعليقات والريأكشنز القديمة متتمسحش، بتتخفي بس.
exports.blockUser = catchAsync(async (req, res) => {
  const me = req.user._id;
  const targetId = requireId(req.params.userId, 'معرّف اليوزر');

  if (String(me) === targetId) throw new AppError('مينفعش تحظر نفسك', 400);
  const target = await User.findOne({ _id: targetId, isDeleted: { $ne: true } }).select('_id');
  if (!target) throw new AppError('اليوزر مش موجود', 404);

  try {
    await Block.create({ blocker: me, blocked: targetId });
  } catch (err) {
    if (err.code === 11000) throw new AppError('إنت حاظر اليوزر ده قبل كده', 409);
    throw err;
  }

  // نشيل الصداقة/الطلبات بين الاتنين
  await Friendship.deleteOne({ pairKey: pairKeyOf(me, targetId) });
  // ونمسح إشعارات الصداقة بينهم في الاتجاهين
  await Notification.deleteMany({
    type: { $in: ['friend_request', 'friend_accepted'] },
    $or: [
      { recipient: me, actor: targetId },
      { recipient: targetId, actor: me },
    ],
  });

  return created(res, null, 'تم حظر اليوزر');
});

// ========== فك الحظر ==========
exports.unblockUser = catchAsync(async (req, res) => {
  const targetId = requireId(req.params.userId, 'معرّف اليوزر');
  const result = await Block.deleteOne({ blocker: req.user._id, blocked: targetId });
  if (!result.deletedCount) throw new AppError('اليوزر ده مش محظور', 404);
  return ok(res, null, 'تم فك الحظر');
});

// ========== قايمة المحظورين (اللي أنا حظرتهم) ==========
exports.getBlockedUsers = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { blocker: req.user._id };

  const [rows, total] = await Promise.all([
    Block.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate('blocked', BRIEF_FIELDS).lean(),
    Block.countDocuments(filter),
  ]);

  const data = rows
    .filter((row) => row.blocked)
    .map((row) => ({ ...userBrief(row.blocked), blockedAt: row.createdAt }));

  return ok(res, data, 'قايمة المحظورين', 200, { pagination: buildPagination(page, limit, total) });
});
