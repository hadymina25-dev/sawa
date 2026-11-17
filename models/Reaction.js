const mongoose = require('mongoose');
const { REACTION_TYPES } = require('../config/constants');

// ريأكشن واحد لكل يوزر على كل هدف (بوست أو تعليق). الـ unique index هو اللي بيمنع التكرار حتى لو ريكوستين جم مع بعض.
const reactionSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['post', 'comment'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['regular', 'sign'], required: true },
    type: {
      type: String,
      required: true,
      validate: {
        validator(value) {
          return Boolean(REACTION_TYPES[this.kind] && REACTION_TYPES[this.kind].includes(value));
        },
        message: 'نوع الريأكشن مش ضمن قايمة الـ kind ده',
      },
    },
  },
  { timestamps: true }
);

reactionSchema.index({ targetType: 1, targetId: 1, user: 1 }, { unique: true });
reactionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
reactionSchema.index({ user: 1 });

module.exports = mongoose.model('Reaction', reactionSchema);
