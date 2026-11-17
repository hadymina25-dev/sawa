// المصدر الوحيد لمنطق العلاقات بين اليوزرز: الحظر (في الاتجاهين) والصداقة.
// أي كنترولر محتاج يعرف في حظر أو صداقة يستخدم الدوال دي ومتكررش المنطق.
const mongoose = require('mongoose');
const Block = require('../models/Block');
const Friendship = require('../models/Friendship');

// مفتاح الزوج: الـ idين مرتبين ومتوصلين (نفس المفتاح للاتجاهين)
exports.pairKeyOf = (a, b) => [String(a), String(b)].sort().join('_');

// كل اليوزرز اللي بيني وبينهم حظر في أي اتجاه (أنا حظرته أو هو حظرني). بيرجّع ObjectIds.
exports.getBlockedUserIds = async (userId) => {
  const rows = await Block.find({ $or: [{ blocker: userId }, { blocked: userId }] })
    .select('blocker blocked')
    .lean();
  const ids = new Set();
  rows.forEach((row) => {
    const other = String(row.blocker) === String(userId) ? row.blocked : row.blocker;
    ids.add(String(other));
  });
  return [...ids].map((id) => new mongoose.Types.ObjectId(id));
};

// هل في حظر بين a و b في أي اتجاه؟
exports.isBlockedEitherWay = async (a, b) =>
  Boolean(await Block.exists({ $or: [{ blocker: a, blocked: b }, { blocker: b, blocked: a }] }));

// هل a و b أصدقاء (طلب مقبول)؟
exports.areFriends = async (a, b) =>
  Boolean(await Friendship.exists({ pairKey: exports.pairKeyOf(a, b), status: 'accepted' }));

// ids كل أصحاب يوزر معين (ObjectIds)
exports.getFriendIds = async (userId) => {
  const rows = await Friendship.find({
    status: 'accepted',
    $or: [{ requester: userId }, { recipient: userId }],
  })
    .select('requester recipient')
    .lean();
  return rows.map((row) => (String(row.requester) === String(userId) ? row.recipient : row.requester));
};

exports.countFriends = (userId) =>
  Friendship.countDocuments({ status: 'accepted', $or: [{ requester: userId }, { recipient: userId }] });

// حالة الصداقة بيني وبين مجموعة يوزرز بـ query واحدة.
// بيرجّع Map: idString -> { status: 'friend'|'request_sent'|'request_received'|'none', requestId }
exports.getFriendshipStatusMap = async (me, otherIds) => {
  const map = new Map();
  otherIds.forEach((id) => map.set(String(id), { status: 'none', requestId: null }));
  if (!otherIds.length) return map;

  const keys = otherIds.map((id) => exports.pairKeyOf(me, id));
  const rows = await Friendship.find({ pairKey: { $in: keys } }).lean();

  rows.forEach((row) => {
    const iAmRequester = String(row.requester) === String(me);
    const other = iAmRequester ? row.recipient : row.requester;
    let status = 'friend';
    if (row.status === 'pending') status = iAmRequester ? 'request_sent' : 'request_received';
    map.set(String(other), { status, requestId: row._id });
  });
  return map;
};
