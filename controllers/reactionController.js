const mongoose = require('mongoose');
const Reaction = require('../models/Reaction');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { ok } = require('../utils/response');
const { requireId } = require('../utils/validate');
const { REACTION_TYPES } = require('../config/constants');
const { getPagination, buildPagination } = require('../utils/pagination');
const { getBlockedUserIds, isBlockedEitherWay } = require('../utils/relations');
const { loadViewablePost } = require('../utils/postAccess');
const { incCounter } = require('../utils/counters');
const { notify, removeReactionNotification } = require('../utils/notify');
const { userBrief, BRIEF_FIELDS } = require('../utils/serialize');

const TARGET_TYPES = ['post', 'comment'];

// بيتأكد إن kind موجود و type ضمن قايمته (sad موجودة في القايمتين عشان كده لازم الاتنين)
const isKind = (kind) => kind === 'regular' || kind === 'sign';

const assertValidReaction = (kind, type) => {
  if (!isKind(kind)) throw new AppError(`kind لازم يكون واحد من: ${Object.keys(REACTION_TYPES).join(', ')}`, 400);
  if (typeof type !== 'string' || !REACTION_TYPES[kind].includes(type)) {
    throw new AppError(`type مش مسموح في ${kind}. المسموح: ${REACTION_TYPES[kind].join(', ')}`, 400);
  }
};

// بيجيب الهدف (بوست أو تعليق) ويتأكد إني أقدر أشوفه ومفيش حظر بيني وبين صاحبه
const resolveTarget = async (me, targetType, rawTargetId) => {
  if (!TARGET_TYPES.includes(targetType)) throw new AppError(`targetType لازم يكون واحد من: ${TARGET_TYPES.join(', ')}`, 400);
  const targetId = requireId(rawTargetId, 'targetId');

  if (targetType === 'post') {
    const post = await loadViewablePost(me, targetId);
    return { targetId, Model: Post, ownerId: post.author, postId: post._id };
  }

  const comment = await Comment.findById(targetId).select('post author').lean();
  if (!comment) throw new AppError('التعليق مش موجود', 404);
  const post = await loadViewablePost(me, comment.post);
  if (await isBlockedEitherWay(me, comment.author)) throw new AppError('التعليق مش موجود', 404);
  return { targetId, Model: Comment, ownerId: comment.author, postId: post._id };
};

// ========== toggle ريأكشن ==========
// مفيش ريأكشن → يتعمل (+1). نوع مختلف → يتحدّث (العداد زي ما هو). نفس النوع → يتشال (-1).
exports.toggleReaction = catchAsync(async (req, res) => {
  const me = req.user._id;
  const { targetType, targetId: rawId, kind, type } = req.body || {};
  assertValidReaction(kind, type);
  const { targetId, Model, ownerId, postId } = await resolveTarget(me, targetType, rawId);

  const notifType = targetType === 'post' ? 'reaction_post' : 'reaction_comment';
  let outcome = null;

  // محاولتين: لو ريكوستين جم مع بعض والـ unique index (E11000) رفض واحد، بنعيد القراءة بدل ما نرجّع 500
  for (let attempt = 0; attempt < 2 && !outcome; attempt += 1) {
    const existing = await Reaction.findOne({ targetType, targetId, user: me });

    if (!existing) {
      try {
        await Reaction.create({ targetType, targetId, user: me, kind, type });
      } catch (err) {
        if (err.code === 11000) continue;
        throw err;
      }
      await incCounter(Model, targetId, 'reactionsCount', 1);
      outcome = 'created';
    } else if (existing.kind === kind && existing.type === type) {
      const result = await Reaction.deleteOne({ _id: existing._id });
      if (result.deletedCount) await incCounter(Model, targetId, 'reactionsCount', -1);
      outcome = 'removed';
    } else {
      existing.kind = kind;
      existing.type = type;
      await existing.save();
      outcome = 'changed';
    }
  }
  if (!outcome) throw new AppError('حصل تعارض مع ريكوست تاني، جرّب تاني', 409);

  // الإشعارات: جديد/متغيّر بيعمل أو بيحدّث الإشعار، والإزالة بتمسحه
  if (outcome === 'removed') {
    await removeReactionNotification({ recipient: ownerId, actor: me, type: notifType, targetId });
  } else {
    notify({
      recipient: ownerId, actor: me, type: notifType, targetType, targetId, postId,
      reactionKind: kind, reactionType: type,
    });
  }

  const target = await Model.findById(targetId).select('reactionsCount').lean();
  return ok(
    res,
    {
      targetType,
      targetId,
      myReaction: outcome === 'removed' ? null : { kind, type },
      reactionsCount: target ? target.reactionsCount : 0,
    },
    outcome === 'removed' ? 'تم شيل الريأكشن' : 'تم الريأكشن'
  );
});

// ========== مين عمل إيه ريأكشن ==========
// query: targetType, targetId, kind (اختياري), type (اختياري). بيرجّع ملخص summary بعدد كل نوع.
exports.listReactions = catchAsync(async (req, res) => {
  const me = req.user._id;
  const { targetType, targetId: rawId, kind, type } = req.query;
  const { targetId } = await resolveTarget(me, targetType, rawId);
  const { page, limit, skip } = getPagination(req.query);

  const filter = { targetType, targetId };
  if (kind !== undefined) {
    if (!isKind(kind)) throw new AppError(`kind لازم يكون واحد من: ${Object.keys(REACTION_TYPES).join(', ')}`, 400);
    filter.kind = kind;
  }
  if (type !== undefined) {
    const all = new Set([...REACTION_TYPES.regular, ...REACTION_TYPES.sign]);
    if (typeof type !== 'string' || !all.has(type)) throw new AppError('type مش معروف', 400);
    if (kind !== undefined && !REACTION_TYPES[kind].includes(type)) throw new AppError(`type مش مسموح في ${kind}`, 400);
    filter.type = type;
  }

  const blocked = await getBlockedUserIds(me);
  const listFilter = { ...filter, user: { $nin: blocked } };

  const [rows, total, summaryRows] = await Promise.all([
    Reaction.find(listFilter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate('user', BRIEF_FIELDS).lean(),
    Reaction.countDocuments(listFilter),
    Reaction.aggregate([
      { $match: { targetType, targetId: new mongoose.Types.ObjectId(targetId) } },
      { $group: { _id: { kind: '$kind', type: '$type' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const data = rows
    .filter((r) => r.user)
    .map((r) => ({ _id: r._id, user: userBrief(r.user), kind: r.kind, type: r.type, createdAt: r.createdAt }));
  const summary = summaryRows.map((s) => ({ kind: s._id.kind, type: s._id.type, count: s.count }));

  return ok(res, data, 'الريأكشنز', 200, { pagination: buildPagination(page, limit, total), summary });
});
