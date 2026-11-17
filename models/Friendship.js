const mongoose = require('mongoose');

// pairKey = id الاتنين مرتبين ومتوصلين، والـ unique index عليه بيمنع طلب مكرر أو متعاكس (A→B و B→A).
// رفض/إلغاء/إزالة = حذف الـ document (مش status تاني)، عشان نقدر نبعت طلب جديد بعدين.
const friendshipSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
    pairKey: { type: String, required: true },
  },
  { timestamps: true }
);

friendshipSchema.index({ pairKey: 1 }, { unique: true });
friendshipSchema.index({ requester: 1, status: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });

module.exports = mongoose.model('Friendship', friendshipSchema);
