const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../config/constants');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    targetType: { type: String, enum: ['post', 'comment', 'user'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }, // عشان الفرونت يفتح البوست للحاجات المتعلقة بتعليق
    isRead: { type: Boolean, default: false },

    // للريأكشن بس: بيتحدّث لو اليوزر غيّر نوع الريأكشن (إشعار واحد لكل recipient+actor+type+target)
    reactionKind: { type: String },
    reactionType: { type: String },
    dedupeKey: { type: String },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ targetType: 1, targetId: 1 });
notificationSchema.index({ postId: 1 });
notificationSchema.index({ actor: 1 });
// بيمنع تكرار إشعار الريأكشن (dedupeKey موجود بس في إشعارات الريأكشن)
notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

module.exports = mongoose.model('Notification', notificationSchema);
