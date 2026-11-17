const User = require('../models/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { ok } = require('../utils/response');
const { cleanText, isValidId, escapeRegex } = require('../utils/validate');
const { LIMITS, MAX_DEVICE_TOKENS } = require('../config/constants');
const { uploadBuffer, deleteMedia } = require('../utils/media');
const { getPagination, buildPagination } = require('../utils/pagination');
const {
  getBlockedUserIds,
  isBlockedEitherWay,
  countFriends,
  getFriendshipStatusMap,
} = require('../utils/relations');
const {
  USERNAME_REGEX,
  normalizeUsername,
  checkUsernameFormat,
  isUsernameTaken,
} = require('../utils/username');
const { formatSelf, formatProfile, formatLockedProfile, userBrief, BRIEF_FIELDS } = require('../utils/serialize');

// ========== عرض بروفايل ==========
// :idOrUsername ممكن يبقى ObjectId أو username أو "me". حظر في أي اتجاه = 404.
// صاحب البروفايل وأصحابه بيشوفوا كل حاجة. الغريب على بروفايل مقفول بيشوف بيانات مختصرة بس.
exports.getProfile = catchAsync(async (req, res) => {
  const me = req.user._id;
  const param = String(req.params.idOrUsername || '');

  let target;
  if (param.toLowerCase() === 'me') {
    target = req.user;
  } else if (isValidId(param)) {
    target = await User.findOne({ _id: param, isDeleted: { $ne: true } });
  } else if (USERNAME_REGEX.test(param.toLowerCase())) {
    target = await User.findOne({ username: param.toLowerCase(), isDeleted: { $ne: true } });
  } else {
    throw new AppError('معرّف اليوزر غلط', 400);
  }
  if (!target) throw new AppError('اليوزر مش موجود', 404);

  const isSelf = String(target._id) === String(me);
  if (!isSelf && (await isBlockedEitherWay(me, target._id))) throw new AppError('اليوزر مش موجود', 404);

  const friendshipMap = await getFriendshipStatusMap(me, isSelf ? [] : [target._id]);
  const friendship = friendshipMap.get(String(target._id)) || { status: 'none', requestId: null };

  // غريب على بروفايل مقفول → بيانات مختصرة
  if (!isSelf && target.isLocked && friendship.status !== 'friend') {
    return ok(res, formatLockedProfile(target, friendship));
  }

  const friendsCount = await countFriends(target._id);
  return ok(res, formatProfile(target, { isSelf, friendship, friendsCount }));
});

// ========== تعديل بياناتي ==========
// name, bio, from, college, isLocked (الـ username له endpoint لوحده). لازم حقل واحد على الأقل.
exports.updateProfile = catchAsync(async (req, res) => {
  const body = req.body || {};
  const updates = {};

  const name = cleanText(body.name, { label: 'الاسم', min: 2, max: LIMITS.NAME_MAX });
  if (name !== undefined) {
    if (!name) throw new AppError('الاسم مينفعش يبقى فاضي', 400);
    updates.name = name;
  }
  const bio = cleanText(body.bio, { label: 'النبذة', max: LIMITS.BIO_MAX });
  if (bio !== undefined) updates.bio = bio;
  const from = cleanText(body.from, { label: 'منين', max: LIMITS.FROM_MAX });
  if (from !== undefined) updates.from = from;
  const college = cleanText(body.college, { label: 'الكلية', max: LIMITS.COLLEGE_MAX });
  if (college !== undefined) updates.college = college;

  if (body.isLocked !== undefined) {
    if (typeof body.isLocked !== 'boolean') throw new AppError('isLocked لازم يكون true أو false', 400);
    updates.isLocked = body.isLocked;
  }

  if (!Object.keys(updates).length) throw new AppError('ابعت حقل واحد على الأقل للتعديل', 400);

  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { returnDocument: 'after', runValidators: true });
  return ok(res, formatSelf(user), 'تم تحديث البروفايل');
});

// ========== تغيير الـ username ==========
// بيتخزن lowercase. 409 لو متاخد. مفيش cooldown.
exports.updateUsername = catchAsync(async (req, res) => {
  const raw = (req.body || {}).username;
  if (typeof raw !== 'string' || !raw.trim()) throw new AppError('الـ username مطلوب', 400);

  const username = normalizeUsername(raw);
  const problem = checkUsernameFormat(username);
  if (problem === 'invalid') throw new AppError('الـ username لازم يكون 3-20 حرف إنجليزي صغير أو رقم أو _', 400);
  if (problem === 'reserved') throw new AppError('الـ username ده محجوز، اختار غيره', 400);
  if (await isUsernameTaken(username, req.user._id)) throw new AppError('الـ username ده متاخد', 409);

  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { username } }, { returnDocument: 'after' });
    return ok(res, formatSelf(user), 'تم تغيير الـ username');
  } catch (err) {
    if (err.code === 11000) throw new AppError('الـ username ده متاخد', 409);
    throw err;
  }
});

// ========== هل الـ username متاح؟ ==========
// عام (من غير login) عشان الفرونت يستخدمه وهو بيكتب. بيرجّع available + reason لو مش متاح.
exports.usernameAvailable = catchAsync(async (req, res) => {
  const username = normalizeUsername(req.params.username);
  const problem = checkUsernameFormat(username);
  if (problem) return ok(res, { username, available: false, reason: problem });

  const taken = await isUsernameTaken(username);
  return ok(res, { username, available: !taken, reason: taken ? 'taken' : null });
});

// دالة مشتركة لرفع الصورة الشخصية أو الغلاف: بيرفع الجديدة، يحدّث اليوزر، وبعدين يمسح القديمة من Cloudinary
const makeImageUploader = (field, folder) =>
  catchAsync(async (req, res) => {
    if (!req.file) throw new AppError(`لازم ترفع صورة في الحقل ${field}`, 400);

    const media = await uploadBuffer(req.file.buffer, { folder, resourceType: 'image' });
    const old = req.user[field];

    let user;
    try {
      user = await User.findByIdAndUpdate(req.user._id, { $set: { [field]: media } }, { returnDocument: 'after' });
    } catch (err) {
      await deleteMedia(media); // rollback: متسيبش الصورة الجديدة يتيمة
      throw err;
    }

    if (old && old.publicId) await deleteMedia(old); // مسح القديمة (لو فشل بيتسجل ومبيوقعش الريكوست)
    return ok(res, formatSelf(user), field === 'avatar' ? 'تم تغيير الصورة الشخصية' : 'تم تغيير صورة الغلاف');
  });

exports.uploadAvatar = makeImageUploader('avatar', 'avatars');
exports.uploadCover = makeImageUploader('cover', 'covers');

// ========== بحث عن مستخدمين ==========
// q بحد أدنى حرفين (بالاسم أو الـ username). بيستبعد: أنا، المحذوفين، أي حد بيني وبينه حظر.
exports.searchUsers = catchAsync(async (req, res) => {
  const me = req.user._id;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) throw new AppError('كلمة البحث لازم تكون حرفين على الأقل', 400);
  if (q.length > 50) throw new AppError('كلمة البحث طويلة زيادة', 400);

  const { page, limit, skip } = getPagination(req.query);
  const blocked = await getBlockedUserIds(me);
  const regex = new RegExp(escapeRegex(q), 'i');
  const filter = {
    _id: { $nin: [me, ...blocked] },
    isDeleted: { $ne: true },
    $or: [{ name: regex }, { username: regex }],
  };

  const [users, total] = await Promise.all([
    User.find(filter).select(BRIEF_FIELDS).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const statusMap = await getFriendshipStatusMap(me, users.map((u) => u._id));
  const data = users.map((u) => {
    const f = statusMap.get(String(u._id));
    return { ...userBrief(u), friendshipStatus: f.status, friendRequestId: f.requestId };
  });

  return ok(res, data, 'نتايج البحث', 200, { pagination: buildPagination(page, limit, total) });
});

// ========== توكن الجهاز (FCM) ==========
// بيسجّل توكن الجهاز لليوزر. لو التوكن كان على يوزر تاني (نفس الموبايل بحساب مختلف) بيتشال منه.
exports.registerDeviceToken = catchAsync(async (req, res) => {
  const token = cleanText((req.body || {}).deviceToken, { label: 'deviceToken', required: true, min: 10, max: 4096 });
  const me = req.user._id;

  await User.updateMany({ deviceTokens: token, _id: { $ne: me } }, { $pull: { deviceTokens: token } });
  await User.updateOne({ _id: me }, { $pull: { deviceTokens: token } });
  await User.updateOne({ _id: me }, { $push: { deviceTokens: { $each: [token], $slice: -MAX_DEVICE_TOKENS } } });

  return ok(res, null, 'تم تسجيل توكن الجهاز');
});

// بيمسح توكن الجهاز (عند اللوج أوت)
exports.removeDeviceToken = catchAsync(async (req, res) => {
  const token = cleanText((req.body || {}).deviceToken, { label: 'deviceToken', required: true, max: 4096 });
  await User.updateOne({ _id: req.user._id }, { $pull: { deviceTokens: token } });
  return ok(res, null, 'تم مسح توكن الجهاز');
});
