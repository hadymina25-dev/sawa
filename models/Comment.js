const mongoose = require('mongoose');
const mediaSchema = require('./mediaSchema');
const { LIMITS } = require('../config/constants');

// تعليق أو رد. الرد = تعليق parentComment بتاعه مش null. مفيش حد أقصى لعمق الردود.
const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    text: { type: String, trim: true, maxlength: LIMITS.COMMENT_TEXT_MAX, default: '' },
    video: { type: mediaSchema, default: undefined }, // فيديو لغة إشارة (اختياري)
    repliesCount: { type: Number, default: 0, min: 0 },
    reactionsCount: { type: Number, default: 0, min: 0 },
    isEdited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, parentComment: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1, createdAt: 1 });
commentSchema.index({ author: 1 });

module.exports = mongoose.model('Comment', commentSchema);
