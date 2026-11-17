const Post = require('../models/Post');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { ok } = require('../utils/response');
const { cleanText, requireId } = require('../utils/validate');
const { LIMITS } = require('../config/constants');
const { getPagination, buildPagination } = require('../utils/pagination');
const { getFriendIds, getBlockedUserIds } = require('../utils/relations');
const { assertCanViewPost, assertCanViewAuthorContent } = require('../utils/postAccess');
const { uploadMany, deleteMediaList } = require('../utils/media');
const { deletePostCascade } = require('../utils/cascade');
const { getMyReactions } = require('../utils/myReaction');
const { formatPost, BRIEF_FIELDS } = require('../utils/serialize');

const AUTHOR_POPULATE = { path: 'author', select: BRIEF_FIELDS };

// بيجهّز صفحة بوستات: شكل موحد + myReaction الحقيقية بـ query واحدة
const formatPosts = async (posts, userId) => {
  const myReactions = await getMyReactions(userId, 'post', posts.map((p) => p._id));
  return posts.map((p) => formatPost(p, myReactions.get(String(p._id)) || null));
};

// ========== نشر بوست ==========
// route واحد: نص + صور (images) + فيديوهات (videos). multipart أو JSON لو نص بس.
// لو الرفع فشل في النص الأخير بنمسح اللي اترفع (rollback).
exports.createPost = catchAsync(async (req, res) => {
  const text = cleanText((req.body || {}).text, { label: 'النص', max: LIMITS.POST_TEXT_MAX }) || '';
  const images = (req.files && req.files.images) || [];
  const videos = (req.files && req.files.videos) || [];

  if (!text && images.length + videos.length === 0) {
    throw new AppError('لازم تكتب نص أو ترفع صورة/فيديو', 400);
  }

  const uploaded = await uploadMany(
    [
      ...images.map((file) => ({ file, resourceType: 'image' })),
      ...videos.map((file) => ({ file, resourceType: 'video' })),
    ],
    'posts'
  );

  let post;
  try {
    post = await Post.create({ author: req.user._id, text, media: uploaded });
  } catch (err) {
    await deleteMediaList(uploaded);
    throw err;
  }

  const full = await Post.findById(post._id).populate(AUTHOR_POPULATE).lean();
  return ok(res, formatPost(full, null), 'تم نشر البوست', 201);
});

// ========== عرض بوست واحد ==========
exports.getPost = catchAsync(async (req, res) => {
  const id = requireId(req.params.id, 'معرّف البوست');
  const post = await Post.findById(id).populate(AUTHOR_POPULATE).lean();
  await assertCanViewPost(req.user._id, post);

  const [formatted] = await formatPosts([post], req.user._id);
  return ok(res, formatted);
});

// ========== الفيد الرئيسي ==========
// بوستات أصدقائي + بوستاتي، غير المحذوفة، من غير المحظورين، الأحدث الأول.
exports.getFeed = catchAsync(async (req, res) => {
  const me = req.user._id;
  const { page, limit, skip } = getPagination(req.query);

  const [friendIds, blocked] = await Promise.all([getFriendIds(me), getBlockedUserIds(me)]);
  const blockedSet = new Set(blocked.map(String));
  const authors = [me, ...friendIds.filter((id) => !blockedSet.has(String(id)))];

  const filter = { author: { $in: authors }, isDeleted: false };
  const [posts, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(AUTHOR_POPULATE).lean(),
    Post.countDocuments(filter),
  ]);

  return ok(res, await formatPosts(posts, me), 'الفيد', 200, { pagination: buildPagination(page, limit, total) });
});

// ========== بوستات صاحب بروفايل ==========
// بروفايل مقفول ومش صديقه → 403 (مش قايمة فاضية). حظر → 404.
exports.getUserPosts = catchAsync(async (req, res) => {
  const me = req.user._id;
  const targetId = requireId(req.params.id, 'معرّف اليوزر');
  const { page, limit, skip } = getPagination(req.query);

  await assertCanViewAuthorContent(me, targetId);

  const filter = { author: targetId, isDeleted: false };
  const [posts, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(AUTHOR_POPULATE).lean(),
    Post.countDocuments(filter),
  ]);

  return ok(res, await formatPosts(posts, me), 'بوستات اليوزر', 200, { pagination: buildPagination(page, limit, total) });
});

// ========== تعديل بوست (صاحبه بس) ==========
// النص بس (مفيش تعديل للميديا). بيضبط isEdited لو النص اتغير فعلًا.
exports.updatePost = catchAsync(async (req, res) => {
  const me = req.user._id;
  const id = requireId(req.params.id, 'معرّف البوست');
  const post = await Post.findById(id);
  await assertCanViewPost(me, post);
  if (String(post.author) !== String(me)) throw new AppError('مش مسموح لك تعدل بوست حد تاني', 403);

  const text = cleanText((req.body || {}).text, { label: 'النص', required: true, max: LIMITS.POST_TEXT_MAX });
  if (post.media.length === 0 && !text) throw new AppError('البوست من غير ميديا لازم يكون فيه نص', 400);

  if (text !== post.text) {
    post.text = text;
    post.isEdited = true;
    await post.save();
  }

  const full = await Post.findById(id).populate(AUTHOR_POPULATE).lean();
  const [formatted] = await formatPosts([full], me);
  return ok(res, formatted, 'تم تعديل البوست');
});

// ========== حذف بوست (صاحبه بس) ==========
// soft delete + مسح التعليقات والريأكشنز والإشعارات والميديا فعليًا (شوف utils/cascade.js).
exports.deletePost = catchAsync(async (req, res) => {
  const me = req.user._id;
  const id = requireId(req.params.id, 'معرّف البوست');
  const post = await Post.findById(id).lean();
  await assertCanViewPost(me, post);
  if (String(post.author) !== String(me)) throw new AppError('مش مسموح لك تمسح بوست حد تاني', 403);

  await deletePostCascade(id);
  return ok(res, null, 'تم حذف البوست');
});
