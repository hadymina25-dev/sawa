// الحذف المتسلسل كله هنا. كله iterative (بنمشي مستوى مستوى بـ $in على دفعات) مش recursive،
// ومترتب بحيث لو وقف في النص تقدر تشغّله تاني بأمان (idempotent). مفيش transactions عشان تشتغل على أي داتابيز.
// ميديا Cloudinary بتتمسح بعد الداتابيز، ولو فشلت بتتسجل في الـ log (publicId) وبتكمّل.
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Reaction = require('../models/Reaction');
const Notification = require('../models/Notification');
const Friendship = require('../models/Friendship');
const Block = require('../models/Block');
const Report = require('../models/Report');
const User = require('../models/User');
const { deleteMediaList } = require('./media');
const { incCounter } = require('./counters');

const BATCH = 500;

const chunk = (arr, size = BATCH) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// بيمسح الريأكشنز والإشعارات المتعلقة بمجموعة تعليقات
const cleanupCommentSideData = async (commentIds) => {
  for (const part of chunk(commentIds)) {
    await Reaction.deleteMany({ targetType: 'comment', targetId: { $in: part } });
    await Notification.deleteMany({ targetType: 'comment', targetId: { $in: part } });
  }
};

// بيمسح تعليق + كل الأحفاد (ردود بكل المستويات) + ريأكشناتهم + إشعاراتهم + الفيديوهات، ويعدّل العدادات.
// بيمشي من أعمق مستوى لفوق (الجذر آخر حاجة) عشان لو وقف في النص مايسيبش ردود يتيمة.
exports.deleteCommentTree = async (commentId) => {
  const root = await Comment.findById(commentId).select('post parentComment video').lean();
  if (!root) return { deletedCount: 0 };

  // 1) نجمع الأحفاد مستوى بمستوى
  const levels = [[root]];
  const seen = new Set([String(root._id)]);
  let current = [root];
  while (current.length) {
    const next = [];
    for (const part of chunk(current.map((c) => c._id))) {
      const kids = await Comment.find({ parentComment: { $in: part } })
        .select('post parentComment video')
        .lean();
      kids.forEach((kid) => {
        if (!seen.has(String(kid._id))) {
          seen.add(String(kid._id));
          next.push(kid);
        }
      });
    }
    if (next.length) levels.push(next);
    current = next;
  }

  // 2) نمسح من الأعمق للجذر
  let deletedCount = 0;
  const mediaToDelete = [];
  for (let i = levels.length - 1; i >= 0; i -= 1) {
    const ids = levels[i].map((c) => c._id);
    await cleanupCommentSideData(ids);

    let levelDeleted = 0;
    for (const part of chunk(ids)) {
      const result = await Comment.deleteMany({ _id: { $in: part } });
      levelDeleted += result.deletedCount;
    }
    deletedCount += levelDeleted;
    levels[i].forEach((c) => c.video && mediaToDelete.push(c.video));

    // عداد البوست بينقص بعد كل مستوى اتمسح فعلًا
    if (levelDeleted) await incCounter(Post, root.post, 'commentsCount', -levelDeleted);
  }

  // 3) الأب المباشر للجذر (لو الجذر كان ردّ) repliesCount بتاعه ينقص 1
  if (root.parentComment) await incCounter(Comment, root.parentComment, 'repliesCount', -1);

  // 4) ميديا الفيديو بعد الداتابيز (بيسجّل الفاشل في الـ log)
  await deleteMediaList(mediaToDelete);
  return { deletedCount };
};

// بيمسح بوست: يعمله isDeleted (soft) + يمسح تعليقاته وردوده وريأكشناته وإشعاراته وميديا بتاعته.
// hard=true بيمسح الـ document نفسه (بنستخدمها في حذف الحساب بس).
exports.deletePostCascade = async (postId, { hard = false } = {}) => {
  const post = await Post.findById(postId).select('media isDeleted').lean();
  if (!post) return false;

  // أول حاجة نخفيه فورًا
  if (!post.isDeleted) await Post.updateOne({ _id: postId }, { $set: { isDeleted: true } });

  // كل تعليقات البوست (بكل المستويات) بالـ post مباشرة على دفعات
  for (;;) {
    const batch = await Comment.find({ post: postId }).select('_id video').limit(BATCH).lean();
    if (!batch.length) break;
    const ids = batch.map((c) => c._id);
    await cleanupCommentSideData(ids);
    await Comment.deleteMany({ _id: { $in: ids } });
    await deleteMediaList(batch.map((c) => c.video));
  }

  await Reaction.deleteMany({ targetType: 'post', targetId: postId });
  await Notification.deleteMany({ $or: [{ targetType: 'post', targetId: postId }, { postId }] });

  // ميديا البوست آخر حاجة (لو فشل مسح ملف، publicId بتاعه بيتسجل في الـ log)
  await deleteMediaList(post.media);

  if (hard) {
    await Post.deleteOne({ _id: postId });
  } else {
    await Post.updateOne({ _id: postId }, { $set: { media: [], commentsCount: 0, reactionsCount: 0 } });
  }
  return true;
};

// بيمسح كل أثر ليوزر (حذف الحساب). الترتيب مهم، وآخر حاجة مسح الـ user نفسه.
exports.deleteUserData = async (userId) => {
  const user = await User.findById(userId).select('avatar cover').lean();
  const profileMedia = user ? [user.avatar, user.cover] : [];

  // 1) كل بوستاته (hard)
  for (;;) {
    const posts = await Post.find({ author: userId }).select('_id').limit(100).lean();
    if (!posts.length) break;
    for (const p of posts) await exports.deletePostCascade(p._id, { hard: true });
  }

  // 2) تعليقاته وردوده على بوستات الناس (بكل اللي تحتها) مع تعديل العدادات
  for (;;) {
    const comments = await Comment.find({ author: userId }).select('_id').limit(100).lean();
    if (!comments.length) break;
    for (const c of comments) await exports.deleteCommentTree(c._id);
  }

  // 3) ريأكشناته على حاجات الناس: ننقص العداد وبعدين نمسحها
  for (;;) {
    const reactions = await Reaction.find({ user: userId }).limit(BATCH).lean();
    if (!reactions.length) break;
    const ops = { post: [], comment: [] };
    reactions.forEach((r) => {
      ops[r.targetType].push({
        updateOne: {
          filter: { _id: r.targetId, reactionsCount: { $gt: 0 } },
          update: { $inc: { reactionsCount: -1 } },
        },
      });
    });
    if (ops.post.length) await Post.bulkWrite(ops.post);
    if (ops.comment.length) await Comment.bulkWrite(ops.comment);
    await Reaction.deleteMany({ _id: { $in: reactions.map((r) => r._id) } });
  }

  // 4) الصداقات وطلبات الصداقة (الاتجاهين)
  await Friendship.deleteMany({ $or: [{ requester: userId }, { recipient: userId }] });
  // 5) سجلات الحظر (الاتجاهين)
  await Block.deleteMany({ $or: [{ blocker: userId }, { blocked: userId }] });
  // 6) بلاغاته هو (البلاغات اللي عليه بتفضل)
  await Report.deleteMany({ reporter: userId });
  // 7) الإشعارات (كـ recipient أو actor)
  await Notification.deleteMany({
    $or: [{ recipient: userId }, { actor: userId }, { targetType: 'user', targetId: userId }],
  });

  // 8) صورته وغلافه من Cloudinary (بعد الداتابيز، وبـ try/catch جوه deleteMedia)
  await deleteMediaList(profileMedia);

  // 9) الأخير: مسح الـ user نفسه (hard). كده protect هيرجّع 401 لأي توكن قديم.
  await User.deleteOne({ _id: userId });
  return true;
};
