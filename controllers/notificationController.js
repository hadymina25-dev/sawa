const Notification = require('../models/Notification');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { ok } = require('../utils/response');
const { requireId } = require('../utils/validate');
const { getPagination, buildPagination } = require('../utils/pagination');
const { getBlockedUserIds } = require('../utils/relations');
const { buildText } = require('../utils/notify');
const { userBrief, BRIEF_FIELDS } = require('../utils/serialize');

// ========== قايمة إشعاراتي ==========
// الأحدث الأول، actor مختصر، ونص عربي جاهز. إشعارات المحظورين متخفية. ?unread=true للغير مقروء بس.
exports.getNotifications = catchAsync(async (req, res) => {
  const me = req.user._id;
  const { page, limit, skip } = getPagination(req.query);
  const blocked = await getBlockedUserIds(me);

  const filter = { recipient: me, actor: { $nin: blocked } };
  if (req.query.unread === 'true') filter.isRead = false;

  const [rows, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate('actor', BRIEF_FIELDS).lean(),
    Notification.countDocuments(filter),
  ]);

  const data = rows
    .filter((n) => n.actor)
    .map((n) => ({
      _id: n._id,
      type: n.type,
      targetType: n.targetType,
      targetId: n.targetId,
      postId: n.postId || null,
      actor: userBrief(n.actor),
      text: buildText(n.type, n.actor.name),
      reaction: n.reactionType ? { kind: n.reactionKind, type: n.reactionType } : null,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));

  return ok(res, data, 'الإشعارات', 200, { pagination: buildPagination(page, limit, total) });
});

// ========== عدد الغير مقروء ==========
exports.getUnreadCount = catchAsync(async (req, res) => {
  const blocked = await getBlockedUserIds(req.user._id);
  const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false, actor: { $nin: blocked } });
  return ok(res, { count });
});

// ========== تعليم إشعار كمقروء (صاحبه بس) ==========
exports.markAsRead = catchAsync(async (req, res) => {
  const id = requireId(req.params.id, 'معرّف الإشعار');
  const result = await Notification.updateOne({ _id: id, recipient: req.user._id }, { $set: { isRead: true } });
  if (!result.matchedCount) throw new AppError('الإشعار مش موجود', 404);
  return ok(res, null, 'تم تعليم الإشعار كمقروء');
});

// ========== تعليم الكل كمقروء ==========
exports.markAllAsRead = catchAsync(async (req, res) => {
  const result = await Notification.updateMany({ recipient: req.user._id, isRead: false }, { $set: { isRead: true } });
  return ok(res, { updated: result.modifiedCount }, 'تم تعليم كل الإشعارات كمقروءة');
});

// ========== حذف إشعار (صاحبه بس) ==========
exports.deleteNotification = catchAsync(async (req, res) => {
  const id = requireId(req.params.id, 'معرّف الإشعار');
  const result = await Notification.deleteOne({ _id: id, recipient: req.user._id });
  if (!result.deletedCount) throw new AppError('الإشعار مش موجود', 404);
  return ok(res, null, 'تم حذف الإشعار');
});
