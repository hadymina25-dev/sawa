// تجهيز الأشكال اللي بترجع للفرونت (بنخفي publicId وأي حاجة داخلية).
const { thumbUrl } = require('./media');

// الحقول اللي بنعملها populate لما محتاجين اليوزر المختصر
exports.BRIEF_FIELDS = 'name username avatar';

const urlOf = (media) => (media && media.url ? media.url : null);

// يوزر مختصر: _id, name, username, avatar (رابط)
exports.userBrief = (user) =>
  user ? { _id: user._id, name: user.name, username: user.username || null, avatar: urlOf(user.avatar) } : null;

exports.mediaOut = (media) => (media ? { url: media.url, resourceType: media.resourceType } : null);

// بياناتي أنا (فيها الإيميل)
exports.formatSelf = (user) => ({
  _id: user._id,
  name: user.name,
  username: user.username || null,
  email: user.email,
  bio: user.bio || '',
  from: user.from || '',
  college: user.college || '',
  avatar: urlOf(user.avatar),
  cover: urlOf(user.cover),
  isLocked: Boolean(user.isLocked),
  createdAt: user.createdAt,
});

// بروفايل كامل (لصاحبه أو لصديقه أو لو مش مقفول). الإيميل لصاحبه بس.
exports.formatProfile = (user, { isSelf, friendship, friendsCount }) => {
  const data = {
    _id: user._id,
    name: user.name,
    username: user.username || null,
    bio: user.bio || '',
    from: user.from || '',
    college: user.college || '',
    avatar: urlOf(user.avatar),
    cover: urlOf(user.cover),
    isLocked: Boolean(user.isLocked),
    createdAt: user.createdAt,
    friendsCount,
    friendshipStatus: isSelf ? 'self' : friendship.status,
    friendRequestId: isSelf ? null : friendship.requestId || null,
  };
  if (isSelf) data.email = user.email;
  return data;
};

// بروفايل مقفول بيشوفه غريب: بيانات مختصرة وصورة مصغرة بس
exports.formatLockedProfile = (user, friendship) => ({
  _id: user._id,
  name: user.name,
  username: user.username || null,
  isLocked: true,
  avatar: thumbUrl(urlOf(user.avatar), 200),
  friendshipStatus: friendship.status,
  friendRequestId: friendship.requestId || null,
});

// بوست (لازم author يكون populated و lean)
exports.formatPost = (post, myReaction = null) => ({
  _id: post._id,
  author: exports.userBrief(post.author),
  text: post.text || '',
  media: (post.media || []).map(exports.mediaOut),
  reactionsCount: post.reactionsCount || 0,
  commentsCount: post.commentsCount || 0,
  isEdited: Boolean(post.isEdited),
  myReaction,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
});

// تعليق أو رد (lean + author populated)
exports.formatComment = (comment, myReaction = null) => ({
  _id: comment._id,
  post: comment.post,
  parentComment: comment.parentComment || null,
  author: exports.userBrief(comment.author),
  text: comment.text || '',
  video: exports.mediaOut(comment.video),
  repliesCount: comment.repliesCount || 0,
  reactionsCount: comment.reactionsCount || 0,
  isEdited: Boolean(comment.isEdited),
  myReaction,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
});
