const Report = require('../models/Report');
const User = require('../models/User');
const Comment = require('../models/Comment');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { created } = require('../utils/response');
const { requireId, cleanText } = require('../utils/validate');
const { REPORT_REASONS, REPORT_TARGET_TYPES, LIMITS } = require('../config/constants');
const { isBlockedEitherWay } = require('../utils/relations');
const { loadViewablePost } = require('../utils/postAccess');

// ========== إبلاغ ==========
// targetType: user | post | comment. مينفعش أبلغ عن نفسي أو عن بوست/تعليق بتاعي (400). الإبلاغ المكرر 409.
exports.createReport = catchAsync(async (req, res) => {
  const me = req.user._id;
  const body = req.body || {};

  if (!REPORT_TARGET_TYPES.includes(body.targetType)) {
    throw new AppError(`targetType لازم يكون واحد من: ${REPORT_TARGET_TYPES.join(', ')}`, 400);
  }
  if (!REPORT_REASONS.includes(body.reason)) {
    throw new AppError(`reason لازم يكون واحد من: ${REPORT_REASONS.join(', ')}`, 400);
  }
  const targetId = requireId(body.targetId, 'targetId');
  const details = cleanText(body.details, { label: 'التفاصيل', max: LIMITS.REPORT_DETAILS_MAX }) || '';

  // بنتأكد إن الهدف موجود وإني أقدر أشوفه (حسب نوعه)
  switch (body.targetType) {
    case 'user': {
      if (String(me) === targetId) throw new AppError('مينفعش تبلّغ عن نفسك', 400);
      const user = await User.findOne({ _id: targetId, isDeleted: { $ne: true } }).select('_id');
      if (!user || (await isBlockedEitherWay(me, targetId))) throw new AppError('اليوزر مش موجود', 404);
      break;
    }
    case 'post': {
      const post = await loadViewablePost(me, targetId); // 404/403 حسب الحالة
      if (String(post.author) === String(me)) throw new AppError('مينفعش تبلّغ عن بوست بتاعك', 400);
      break;
    }
    case 'comment': {
      const comment = await Comment.findById(targetId).select('post author').lean();
      if (!comment) throw new AppError('التعليق مش موجود', 404);
      await loadViewablePost(me, comment.post);
      if (String(comment.author) === String(me)) throw new AppError('مينفعش تبلّغ عن تعليق بتاعك', 400);
      if (await isBlockedEitherWay(me, comment.author)) throw new AppError('التعليق مش موجود', 404);
      break;
    }
    default:
      break;
  }

  try {
    const report = await Report.create({ reporter: me, targetType: body.targetType, targetId, reason: body.reason, details });
    return created(res, { _id: report._id, status: report.status }, 'تم إرسال البلاغ، شكرًا');
  } catch (err) {
    if (err.code === 11000) throw new AppError('إنت بلّغت عن ده قبل كده', 409);
    throw err;
  }
});
