const Friendship = require('../models/Friendship');
const User = require('../models/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { ok, created } = require('../utils/response');
const { requireId } = require('../utils/validate');
const { getPagination, buildPagination } = require('../utils/pagination');
const { getBlockedUserIds, isBlockedEitherWay, pairKeyOf } = require('../utils/relations');
const { assertCanViewAuthorContent } = require('../utils/postAccess');
const { notify, removeFriendRequestNotification } = require('../utils/notify');
const { userBrief, BRIEF_FIELDS } = require('../utils/serialize');

// قايمة أصحاب يوزر (ownerId) كما بيشوفها viewerId (بتستبعد المحظورين بالنسبة للمشاهد)
const listFriendsOf = async (ownerId, viewerId, query) => {
  const { page, limit, skip } = getPagination(query);
  const blocked = await getBlockedUserIds(viewerId);
  const filter = {
    status: 'accepted',
    $or: [
      { requester: ownerId, recipient: { $nin: blocked } },
      { recipient: ownerId, requester: { $nin: blocked } },
    ],
  };

  const [rows, total] = await Promise.all([
    Friendship.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate('requester recipient', BRIEF_FIELDS)
      .lean(),
    Friendship.countDocuments(filter),
  ]);

  const data = rows
    .map((row) => {
      const ownerIsRequester = row.requester && String(row.requester._id) === String(ownerId);
      return userBrief(ownerIsRequester ? row.recipient : row.requester);
    })
    .filter(Boolean);

  return { data, pagination: buildPagination(page, limit, total) };
};

// ========== إرسال طلب صداقة ==========
// 400 لنفسي، 404 لو اليوزر مش موجود أو في حظر، 409 لو في طلب أو صداقة أصلاً.
exports.sendRequest = catchAsync(async (req, res) => {
  const me = req.user._id;
  const targetId = requireId(req.params.userId, 'معرّف اليوزر');

  if (String(me) === targetId) throw new AppError('مينفعش تبعت طلب صداقة لنفسك', 400);

  const target = await User.findOne({ _id: targetId, isDeleted: { $ne: true } }).select('_id');
  if (!target) throw new AppError('اليوزر مش موجود', 404);
  if (await isBlockedEitherWay(me, targetId)) throw new AppError('اليوزر مش موجود', 404);

  const pairKey = pairKeyOf(me, targetId);
  const existing = await Friendship.findOne({ pairKey });
  if (existing) {
    if (existing.status === 'accepted') throw new AppError('إنتوا أصحاب أصلاً', 409);
    if (String(existing.requester) === String(me)) throw new AppError('إنت بعتله طلب صداقة قبل كده', 409);
    throw new AppError('هو باعتلك طلب صداقة، اقبله من الطلبات الواردة', 409);
  }

  let friendship;
  try {
    friendship = await Friendship.create({ requester: me, recipient: targetId, status: 'pending', pairKey });
  } catch (err) {
    if (err.code === 11000) throw new AppError('في طلب صداقة بينكم أصلاً', 409);
    throw err;
  }

  notify({ recipient: targetId, actor: me, type: 'friend_request', targetType: 'user', targetId: me });

  return created(res, { requestId: friendship._id, status: 'request_sent' }, 'تم إرسال طلب الصداقة');
});

// ========== قبول طلب (للمستلم بس) ==========
exports.acceptRequest = catchAsync(async (req, res) => {
  const me = req.user._id;
  const requestId = requireId(req.params.requestId, 'معرّف الطلب');

  const friendship = await Friendship.findOne({ _id: requestId, recipient: me, status: 'pending' });
  if (!friendship) throw new AppError('طلب الصداقة مش موجود', 404);
  if (await isBlockedEitherWay(me, friendship.requester)) throw new AppError('طلب الصداقة مش موجود', 404);

  friendship.status = 'accepted';
  await friendship.save();

  notify({ recipient: friendship.requester, actor: me, type: 'friend_accepted', targetType: 'user', targetId: me });

  return ok(res, { requestId: friendship._id, status: 'friend' }, 'تم قبول طلب الصداقة');
});

// ========== رفض طلب (للمستلم بس) ==========
// بنمسح الـ document (مش status) عشان يقدر يبعت طلب جديد بعدين، وبنمسح إشعار الطلب.
exports.rejectRequest = catchAsync(async (req, res) => {
  const me = req.user._id;
  const requestId = requireId(req.params.requestId, 'معرّف الطلب');

  const friendship = await Friendship.findOneAndDelete({ _id: requestId, recipient: me, status: 'pending' });
  if (!friendship) throw new AppError('طلب الصداقة مش موجود', 404);

  await removeFriendRequestNotification({ recipient: me, actor: friendship.requester });
  return ok(res, null, 'تم رفض طلب الصداقة');
});

// ========== إلغاء طلب أنا بعته (للمرسل بس) ==========
exports.cancelRequest = catchAsync(async (req, res) => {
  const me = req.user._id;
  const requestId = requireId(req.params.requestId, 'معرّف الطلب');

  const friendship = await Friendship.findOneAndDelete({ _id: requestId, requester: me, status: 'pending' });
  if (!friendship) throw new AppError('طلب الصداقة مش موجود', 404);

  await removeFriendRequestNotification({ recipient: friendship.recipient, actor: me });
  return ok(res, null, 'تم إلغاء طلب الصداقة');
});

// ========== إزالة صديق ==========
exports.removeFriend = catchAsync(async (req, res) => {
  const me = req.user._id;
  const otherId = requireId(req.params.userId, 'معرّف اليوزر');

  const result = await Friendship.deleteOne({ pairKey: pairKeyOf(me, otherId), status: 'accepted' });
  if (!result.deletedCount) throw new AppError('إنتوا مش أصحاب', 404);
  return ok(res, null, 'تم إزالة الصديق');
});

// ========== قايمة أصدقائي ==========
exports.getMyFriends = catchAsync(async (req, res) => {
  const { data, pagination } = await listFriendsOf(req.user._id, req.user._id, req.query);
  return ok(res, data, 'قايمة الأصدقاء', 200, { pagination });
});

// ========== قايمة أصدقاء يوزر تاني ==========
// بروفايل مقفول ومش صديقه → 403. حظر → 404.
exports.getUserFriends = catchAsync(async (req, res) => {
  const targetId = requireId(req.params.id, 'معرّف اليوزر');
  await assertCanViewAuthorContent(req.user._id, targetId);

  const { data, pagination } = await listFriendsOf(targetId, req.user._id, req.query);
  return ok(res, data, 'قايمة الأصدقاء', 200, { pagination });
});

// دالة مشتركة لقايمتين الطلبات (الواردة والمرسلة)
const listRequests = async (req, res, direction) => {
  const me = req.user._id;
  const { page, limit, skip } = getPagination(req.query);
  const blocked = await getBlockedUserIds(me);

  const mineField = direction === 'received' ? 'recipient' : 'requester';
  const otherField = direction === 'received' ? 'requester' : 'recipient';
  const filter = { status: 'pending', [mineField]: me, [otherField]: { $nin: blocked } };

  const [rows, total] = await Promise.all([
    Friendship.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(otherField, BRIEF_FIELDS).lean(),
    Friendship.countDocuments(filter),
  ]);

  const data = rows
    .filter((row) => row[otherField])
    .map((row) => ({ requestId: row._id, user: userBrief(row[otherField]), createdAt: row.createdAt }));

  return ok(res, data, direction === 'received' ? 'الطلبات الواردة' : 'الطلبات اللي بعتها', 200, {
    pagination: buildPagination(page, limit, total),
  });
};

exports.getReceivedRequests = catchAsync((req, res) => listRequests(req, res, 'received'));
exports.getSentRequests = catchAsync((req, res) => listRequests(req, res, 'sent'));
