const mongoose = require('mongoose');
const mediaSchema = require('./mediaSchema');
const { LIMITS } = require('../config/constants');

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, trim: true, maxlength: LIMITS.POST_TEXT_MAX, default: '' },
    media: { type: [mediaSchema], default: [] },
    reactionsCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 }, // التعليقات والردود كلها
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }, // soft delete
  },
  { timestamps: true }
);

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
