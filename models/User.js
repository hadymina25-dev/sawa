const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const mediaSchema = require('./mediaSchema');
const { LIMITS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'الاسم مطلوب'], trim: true, minlength: 2, maxlength: LIMITS.NAME_MAX },
    username: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]{3,20}$/, 'الـ username لازم يكون 3-20 حرف إنجليزي صغير أو رقم أو _'],
    },
    email: { type: String, required: [true, 'الإيميل مطلوب'], lowercase: true, trim: true },
    password: { type: String, select: false }, // مش موجود لحسابات جوجل
    googleId: { type: String },

    bio: { type: String, trim: true, maxlength: LIMITS.BIO_MAX, default: '' },
    from: { type: String, trim: true, maxlength: LIMITS.FROM_MAX, default: '' },
    college: { type: String, trim: true, maxlength: LIMITS.COLLEGE_MAX, default: '' },
    avatar: { type: mediaSchema, default: undefined },
    cover: { type: mediaSchema, default: undefined },

    isLocked: { type: Boolean, default: false }, // البروفايل المقفول
    isDeleted: { type: Boolean, default: false },

    // نسخة التوكن: بتتزود عند logout / change password / reset password فالتوكنات القديمة تتبطل
    tokenVersion: { type: Number, default: 0, select: false },

    // توكنات الأجهزة للـ push (FCM)
    deviceTokens: { type: [String], default: [], select: false },

    // كود استعادة الباسورد (متخزن hashed)
    otpHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpSentAt: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
// unique بس على اللي عنده username (عشان المستخدمين القدام من غير username مايتعارضوش)
userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } });
userSchema.index({ deviceTokens: 1 });

// بيعمل hash للباسورد قبل الحفظ لو اتغير
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// بيقارن باسورد مكتوب بالـ hash المخزن (لازم تعمل select('+password') قبلها)
userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

// حماية إضافية: مفيش أسرار تطلع في أي JSON
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.tokenVersion;
    delete ret.deviceTokens;
    delete ret.otpHash;
    delete ret.otpExpires;
    delete ret.otpAttempts;
    delete ret.otpSentAt;
    delete ret.googleId;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
