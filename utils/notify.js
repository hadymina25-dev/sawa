// خدمة الإشعارات: بتحفظ الإشعار وتبعت push. مبترميش exception أبدًا، وفشلها ميوقعش الريكوست الأساسي.
const Notification = require('../models/Notification');
const User = require('../models/User');
const { getFcm } = require('../config/firebase');
const { isBlockedEitherWay } = require('./relations');

const TITLE = 'سوا';

// نص الإشعار بالعربي حسب النوع (بيتستخدم في الـ push وفي قايمة الإشعارات)
exports.buildText = (type, actorName) => {
  const name = actorName || 'حد';
  switch (type) {
    case 'reaction_post': return `${name} تفاعل مع بوستك`;
    case 'reaction_comment': return `${name} تفاعل مع تعليقك`;
    case 'comment_post': return `${name} علّق على بوستك`;
    case 'reply_comment': return `${name} رد على تعليقك`;
    case 'friend_request': return `${name} بعتلك طلب صداقة`;
    case 'friend_accepted': return `${name} قبل طلب صداقتك`;
    default: return `${name} عمل نشاط جديد`;
  }
};

const INVALID_TOKEN_CODES = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

// بيبعت الـ push لأجهزة المستلم. لو Firebase مش متظبط بيتجاهل بهدوء.
const sendPush = async (notification) => {
  const fcm = getFcm();
  if (!fcm) return;

  const recipient = await User.findById(notification.recipient).select('+deviceTokens').lean();
  const tokens = (recipient && recipient.deviceTokens) || [];
  if (!tokens.length) return;

  const actor = await User.findById(notification.actor).select('name').lean();

  // كل قيم data لازم تبقى strings
  const response = await fcm.sendEachForMulticast({
    tokens,
    notification: { title: TITLE, body: exports.buildText(notification.type, actor && actor.name) },
    data: {
      type: String(notification.type),
      targetType: String(notification.targetType),
      targetId: String(notification.targetId),
      postId: notification.postId ? String(notification.postId) : '',
      notificationId: String(notification._id),
    },
  });

  // نشيل التوكنات الميتة من اليوزر
  const dead = [];
  response.responses.forEach((r, i) => {
    if (!r.success && r.error && INVALID_TOKEN_CODES.includes(r.error.code)) dead.push(tokens[i]);
  });
  if (dead.length) await User.updateOne({ _id: notification.recipient }, { $pull: { deviceTokens: { $in: dead } } });
};

// مفتاح منع التكرار لإشعارات الريأكشن
exports.reactionDedupeKey = ({ recipient, actor, type, targetId }) => `${recipient}:${actor}:${type}:${targetId}`;

// بتنادي عليها من أي كنترولر من غير await (بترجّع Promise مبتترفضش أبدًا).
// - بتتجاهل لو المستلم هو الفاعل أو في حظر بينهم.
// - الريأكشن: إشعار واحد لكل (recipient, actor, type, targetId)؛ لو موجود بيتحدّث (من غير push جديد).
exports.notify = async ({ recipient, actor, type, targetType, targetId, postId, reactionKind, reactionType }) => {
  try {
    if (!recipient || !actor || String(recipient) === String(actor)) return null;
    if (await isBlockedEitherWay(recipient, actor)) return null;

    const doc = { recipient, actor, type, targetType, targetId };
    if (postId) doc.postId = postId;

    if (type === 'reaction_post' || type === 'reaction_comment') {
      doc.reactionKind = reactionKind;
      doc.reactionType = reactionType;
      doc.dedupeKey = exports.reactionDedupeKey({ recipient, actor, type, targetId });

      const existing = await Notification.findOne({ dedupeKey: doc.dedupeKey });
      if (existing) {
        existing.reactionKind = reactionKind;
        existing.reactionType = reactionType;
        await existing.save();
        return existing; // تحديث بس، من غير push تاني
      }
    }

    let notification;
    try {
      notification = await Notification.create(doc);
    } catch (err) {
      if (err && err.code === 11000) return null; // سباق ريكوستين: التاني كسب
      throw err;
    }

    sendPush(notification).catch((err) => console.error(`[push] فشل إرسال الـ push: ${err.message}`));
    return notification;
  } catch (err) {
    console.error(`[notify] فشل إنشاء الإشعار: ${err.message}`);
    return null;
  }
};

// بيمسح إشعار الريأكشن (لما اليوزر يشيل الريأكشن). مبيرميش خطأ.
exports.removeReactionNotification = async ({ recipient, actor, type, targetId }) => {
  try {
    await Notification.deleteOne({ dedupeKey: exports.reactionDedupeKey({ recipient, actor, type, targetId }) });
  } catch (err) {
    console.error(`[notify] فشل مسح إشعار الريأكشن: ${err.message}`);
  }
};

// بيمسح إشعار طلب الصداقة (عند الرفض أو الإلغاء). مبيرميش خطأ.
exports.removeFriendRequestNotification = async ({ recipient, actor }) => {
  try {
    await Notification.deleteMany({ recipient, actor, type: 'friend_request' });
  } catch (err) {
    console.error(`[notify] فشل مسح إشعار طلب الصداقة: ${err.message}`);
  }
};
