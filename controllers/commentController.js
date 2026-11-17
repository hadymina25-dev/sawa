const Comment = require('../models/Comment');
const Post = require('../models/Post');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { ok } = require('../utils/response');
const { cleanText, requireId } = require('../utils/validate');
const { LIMITS } = require('../config/constants');
const { getPagination, buildPagination } = require('../utils/pagination');
const { getBlockedUserIds, isBlockedEitherWay } = require('../utils/relations');
const { loadViewablePost } = require('../utils/postAccess');
const { uploadBuffer, deleteMedia } = require('../utils/media');
const { incCounter } = require('../utils/counters');
const { deleteCommentTree } = require('../utils/cascade');
const { notify } = require('../utils/notify');
const { getMyReactions } = require('../utils/myReaction');
const { formatComment, BRIEF_FIELDS } = require('../utils/serialize');

const AUTHOR_POPULATE = { path: 'author', select: BRIEF_FIELDS };

// بيجهّز صفحة تعليقات: شكل موحد + myReaction الحقيقية بـ query واحدة
const formatComments = async (comments, userId) => {
  const myReactions = await getMyReactions(userId, 'comment', comments.map((c) => c._id));
  return comments.map((c) => formatComment(c, myReactions.get(String(c._id)) || null));
};

// بيجيب تعليق + بوسته ويتأكد إني أقدر أشوفه (canViewPost) ومفيش حظر بيني وبين صاحب التعليق
const loadViewableComment = async (userId, commentId) => {
  const id = requireId(commentId, 'معرّف التعليق');
  const comment = await Comment.findById(id).lean();
  if (!comment) throw new AppError('التعليق مش موجود', 404);
  const post = await loadViewablePost(userId, comment.post);
  if (await isBlockedEitherWay(userId, comment.author)) throw new AppError('التعليق مش موجود', 404);
  return { comment, post };
};

// ========== إنشاء تعليق أو رد ==========
// نفس الـ endpoint: لو parentComment اتبعت يبقى رد (على تعليق أو على رد، من غير حد أقصى للعمق).
// لازم نص (ممكن إيموجي) أو فيديو إشارة أو الاتنين.
exports.createComment = catchAsync(async (req, res) => {
  const me = req.user._id;
  const post = await loadViewablePost(me, req.params.postId);

  const body = req.body || {};
  const text = cleanText(body.text, { label: 'التعليق', max: LIMITS.COMMENT_TEXT_MAX }) || '';
  const file = req.file;
  if (!text && !file) throw new AppError('لازم تكتب نص أو ترفع فيديو', 400);

  // لو ده رد: الأب لازم يكون موجود وتابع لنفس البوست ومفيش حظر بيني وبين صاحبه
  let parent = null;
  if (body.parentComment !== undefined && body.parentComment !== null && body.parentComment !== '') {
    const parentId = requireId(body.parentComment, 'parentComment');
    parent = await Comment.findById(parentId).select('post author').lean();
    if (!parent) throw new AppError('التعليق اللي بترد عليه مش موجود', 404);
    if (String(parent.post) !== String(post._id)) throw new AppError('التعليق ده مش تابع للبوست ده', 400);
    if (await isBlockedEitherWay(me, parent.author)) throw new AppError('التعليق اللي بترد عليه مش موجود', 404);
  }

  let video = null;
  if (file) video = await uploadBuffer(file.buffer, { folder: 'comment-videos', resourceType: 'video' });

  let comment;
  try {
    comment = await Comment.create({
      post: post._id,
      author: me,
      parentComment: parent ? parent._id : null,
      text,
      ...(video ? { video } : {}),
    });
  } catch (err) {
    if (video) await deleteMedia(video);
    throw err;
  }

  // العدادات: التعليق/الرد يزوّد commentsCount بتاع البوست، والرد يزوّد repliesCount بتاع الأب
  await incCounter(Post, post._id, 'commentsCount', 1);
  if (parent) await incCounter(Comment, parent._id, 'repliesCount', 1);

  // الإشعار: الرد لصاحب التعليق الأب بس، والتعليق المباشر لصاحب البوست
  if (parent) {
    notify({ recipient: parent.author, actor: me, type: 'reply_comment', targetType: 'comment', targetId: comment._id, postId: post._id });
  } else {
    notify({ recipient: post.author, actor: me, type: 'comment_post', targetType: 'comment', targetId: comment._id, postId: post._id });
  }

  const full = await Comment.findById(comment._id).populate(AUTHOR_POPULATE).lean();
  return ok(res, formatComment(full, null), parent ? 'تم إضافة الرد' : 'تم إضافة التعليق', 201);
});

// ========== تعليقات بوست (المباشرة بس) ==========
// الأحدث الأول. فيها repliesCount و myReaction. تعليقات المحظورين متخفية.
exports.getPostComments = catchAsync(async (req, res) => {
  const me = req.user._id;
  const post = await loadViewablePost(me, req.params.postId);
  const { page, limit, skip } = getPagination(req.query);
  const blocked = await getBlockedUserIds(me);

  const filter = { post: post._id, parentComment: null, author: { $nin: blocked } };
  const [comments, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(AUTHOR_POPULATE).lean(),
    Comment.countDocuments(filter),
  ]);

  return ok(res, await formatComments(comments, me), 'التعليقات', 200, { pagination: buildPagination(page, limit, total) });
});

// ========== ردود تعليق (على أي مستوى) ==========
// الأقدم الأول.
exports.getReplies = catchAsync(async (req, res) => {
  const me = req.user._id;
  const { comment } = await loadViewableComment(me, req.params.id);
  const { page, limit, skip } = getPagination(req.query);
  const blocked = await getBlockedUserIds(me);

  const filter = { parentComment: comment._id, author: { $nin: blocked } };
  const [replies, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit).populate(AUTHOR_POPULATE).lean(),
    Comment.countDocuments(filter),
  ]);

  return ok(res, await formatComments(replies, me), 'الردود', 200, { pagination: buildPagination(page, limit, total) });
});

// ========== تعديل تعليق (صاحبه بس) ==========
// النص بس. لو التعليق من غير فيديو لازم النص يفضل مش فاضي.
exports.updateComment = catchAsync(async (req, res) => {
  const me = req.user._id;
  const id = requireId(req.params.id, 'معرّف التعليق');
  const comment = await Comment.findById(id);
  if (!comment) throw new AppError('التعليق مش موجود', 404);
  await loadViewablePost(me, comment.post);
  if (String(comment.author) !== String(me)) throw new AppError('مش مسموح لك تعدل تعليق حد تاني', 403);

  const text = cleanText((req.body || {}).text, { label: 'التعليق', required: true, max: LIMITS.COMMENT_TEXT_MAX });
  if (!comment.video && !text) throw new AppError('التعليق من غير فيديو لازم يكون فيه نص', 400);

  if (text !== comment.text) {
    comment.text = text;
    comment.isEdited = true;
    await comment.save();
  }

  const full = await Comment.findById(id).populate(AUTHOR_POPULATE).lean();
  const [formatted] = await formatComments([full], me);
  return ok(res, formatted, 'تم تعديل التعليق');
});

// ========== حذف تعليق (صاحبه بس) ==========
// بيمسح التعليق وكل اللي تحته (ردود بكل المستويات) والعدادات بتتظبط.
exports.deleteComment = catchAsync(async (req, res) => {
  const me = req.user._id;
  const id = requireId(req.params.id, 'معرّف التعليق');
  const comment = await Comment.findById(id).lean();
  if (!comment) throw new AppError('التعليق مش موجود', 404);
  await loadViewablePost(me, comment.post);
  if (String(comment.author) !== String(me)) throw new AppError('مش مسموح لك تمسح تعليق حد تاني', 403);

  const { deletedCount } = await deleteCommentTree(id);
  return ok(res, { deletedCount }, 'تم حذف التعليق');
});
