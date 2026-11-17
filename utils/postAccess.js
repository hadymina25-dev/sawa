// المصدر الوحيد لقرار "مين يشوف إيه". مفيش كنترولر يقرر لوحده.
// القاعدة: المحتوى بيتشاف لو صاحبه أنا، أو صديقي، أو بروفايله مش مقفول.
//   - حظر في أي اتجاه / بوست محذوف / يوزر مش موجود  → 404
//   - بروفايل مقفول وأنا مش صديقه                    → 403
// حالة القفل بتتقرا وقت الطلب (مش متخزنة في البوست)، فلو البروفايل اتقفل البوستات القديمة بتتقفل فورًا.
const Post = require('../models/Post');
const User = require('../models/User');
const AppError = require('./appError');
const { requireId } = require('./validate');
const { isBlockedEitherWay, areFriends } = require('./relations');

const NOT_FOUND = { allowed: false, statusCode: 404, message: 'مش موجود' };

// هل أنا (viewerId) أقدر أشوف محتوى صاحب الـ authorId (بوستاته، قايمة أصحابه)؟
exports.canViewAuthorContent = async (viewerId, authorId) => {
  if (String(viewerId) === String(authorId)) return { allowed: true };
  if (await isBlockedEitherWay(viewerId, authorId)) return NOT_FOUND;

  const author = await User.findById(authorId).select('isLocked isDeleted').lean();
  if (!author || author.isDeleted) return NOT_FOUND;
  if (!author.isLocked) return { allowed: true };
  if (await areFriends(viewerId, authorId)) return { allowed: true };

  return { allowed: false, statusCode: 403, message: 'البروفايل ده مقفول' };
};

// قرار رؤية بوست. بيرجّع { allowed, statusCode?, message? }
exports.canViewPost = async (userId, post) => {
  if (!post || post.isDeleted) return { allowed: false, statusCode: 404, message: 'البوست مش موجود' };
  const authorId = post.author && post.author._id ? post.author._id : post.author;
  const result = await exports.canViewAuthorContent(userId, authorId);
  if (!result.allowed && result.statusCode === 404) return { allowed: false, statusCode: 404, message: 'البوست مش موجود' };
  return result;
};

// نفس canViewPost بس بيرمي AppError بدل ما يرجّع نتيجة
exports.assertCanViewPost = async (userId, post) => {
  const result = await exports.canViewPost(userId, post);
  if (!result.allowed) throw new AppError(result.message, result.statusCode);
};

exports.assertCanViewAuthorContent = async (viewerId, authorId) => {
  const result = await exports.canViewAuthorContent(viewerId, authorId);
  if (!result.allowed) throw new AppError(result.message === 'مش موجود' ? 'اليوزر مش موجود' : result.message, result.statusCode);
};

// بيجيب بوست (غير محذوف) ويتأكد إني أقدر أشوفه. بيرجّع البوست lean.
exports.loadViewablePost = async (userId, postId) => {
  const id = requireId(String(postId), 'معرّف البوست');
  const post = await Post.findById(id).lean();
  await exports.assertCanViewPost(userId, post);
  return post;
};
