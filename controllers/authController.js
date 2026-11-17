const crypto = require('crypto');
const User = require('../models/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { ok } = require('../utils/response');
const { signToken } = require('../utils/jwt');
const { cleanText, isEmail, requirePassword } = require('../utils/validate');
const { LIMITS, OTP } = require('../config/constants');
const { normalizeUsername, checkUsernameFormat, generateUsername } = require('../utils/username');
const { verifyGoogleToken, isGoogleConfigured } = require('../utils/google');
const { sendOtpEmail } = require('../utils/email');
const { deleteUserData } = require('../utils/cascade');
const { formatSelf } = require('../utils/serialize');

const FORGOT_MESSAGE = 'لو الإيميل ده مسجّل عندنا، هيوصله كود التحقق خلال دقايق';

// بيعمل hash للـ OTP (HMAC بالسر بتاع السيرفر) عشان الكود نفسه مايتخزنش
const hashOtp = (otp) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(otp)).digest('hex');

const readEmail = (value) => {
  const email = cleanText(value, { label: 'الإيميل', required: true, max: 254 }).toLowerCase();
  if (!isEmail(email)) throw new AppError('الإيميل مش صالح', 400);
  return email;
};

// الرد بعد تسجيل ناجح: توكن + بياناتي
const authResponse = (res, user, message, status = 200) =>
  ok(res, { token: signToken(user), user: formatSelf(user) }, message, status);

// ========== تسجيل حساب جديد ==========
// بياخد name, email, password, username (اختياري - لو مش مبعوت بيتولّد من الإيميل)
exports.register = catchAsync(async (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name, { label: 'الاسم', required: true, min: 2, max: LIMITS.NAME_MAX });
  const email = readEmail(body.email);
  const password = requirePassword(body.password);

  let username = null;
  const autoGenerate = body.username === undefined || body.username === null || body.username === '';
  if (!autoGenerate) {
    if (typeof body.username !== 'string') throw new AppError('الـ username لازم يكون نص', 400);
    username = normalizeUsername(body.username);
    const problem = checkUsernameFormat(username);
    if (problem === 'invalid') throw new AppError('الـ username لازم يكون 3-20 حرف إنجليزي صغير أو رقم أو _', 400);
    if (problem === 'reserved') throw new AppError('الـ username ده محجوز، اختار غيره', 400);
  }

  if (await User.exists({ email })) throw new AppError('الإيميل ده متسجل قبل كده', 409);

  // لو الـ username اتولّد تلقائي وحصل تعارض نادر، نجرب تاني
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (autoGenerate) username = await generateUsername(email.split('@')[0]);
    try {
      const user = await User.create({ name, email, password, username });
      return authResponse(res, user, 'تم إنشاء الحساب بنجاح', 201);
    } catch (err) {
      if (err.code === 11000) {
        const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : '';
        if (field === 'username') {
          if (autoGenerate) continue;
          throw new AppError('الـ username ده متاخد', 409);
        }
        throw new AppError('الإيميل ده متسجل قبل كده', 409);
      }
      throw err;
    }
  }
  throw new AppError('معرفناش نولّد username، جرّب تاني', 500);
});

// ========== تسجيل الدخول ==========
exports.login = catchAsync(async (req, res) => {
  const body = req.body || {};
  const email = readEmail(body.email);
  if (typeof body.password !== 'string' || !body.password) throw new AppError('الباسورد مطلوب', 400);

  const user = await User.findOne({ email }).select('+password +tokenVersion');
  // رسالة واحدة لكل الحالات عشان محدش يعرف مين مسجل
  if (!user || user.isDeleted || !user.password || !(await user.comparePassword(body.password))) {
    throw new AppError('الإيميل أو الباسورد غلط', 401);
  }
  return authResponse(res, user, 'تم تسجيل الدخول');
});

// ========== تسجيل الدخول بجوجل ==========
// الفرونت بيبعت idToken من Google Sign-In. لو GOOGLE_CLIENT_ID مش موجود بيرجع 501.
exports.googleLogin = catchAsync(async (req, res) => {
  const body = req.body || {};
  const payload = await verifyGoogleToken(body.idToken);
  const email = payload.email.toLowerCase();

  let user = await User.findOne({ googleId: payload.sub }).select('+tokenVersion');
  if (!user) user = await User.findOne({ email }).select('+tokenVersion');

  if (user) {
    if (user.isDeleted) throw new AppError('الحساب ده مش موجود', 401);
    if (!user.googleId) {
      user.googleId = payload.sub; // ربط الحساب الموجود بجوجل (الإيميل متأكد منه)
      await user.save();
    }
  } else {
    const name = (payload.name || email.split('@')[0]).slice(0, LIMITS.NAME_MAX);
    user = await User.create({
      name: name.length >= 2 ? name : `${name}_`,
      email,
      googleId: payload.sub,
      username: await generateUsername(email.split('@')[0]),
    });
  }
  return authResponse(res, user, 'تم تسجيل الدخول بجوجل');
});

// ========== تسجيل الخروج ==========
// بيزوّد tokenVersion فالتوكن القديم بيتبطل فعليًا (على كل الأجهزة). ولو deviceToken اتبعت بيتمسح.
exports.logout = catchAsync(async (req, res) => {
  const update = { $inc: { tokenVersion: 1 } };
  const deviceToken = req.body && req.body.deviceToken;
  if (typeof deviceToken === 'string' && deviceToken.trim()) update.$pull = { deviceTokens: deviceToken.trim() };

  await User.updateOne({ _id: req.user._id }, update);
  return ok(res, null, 'تم تسجيل الخروج');
});

// ========== بياناتي ==========
exports.getMe = catchAsync(async (req, res) => ok(res, formatSelf(req.user)));

// ========== تغيير الباسورد ==========
// القديم + الجديد. بيزوّد tokenVersion (باقي الأجهزة بتتطرد) وبيرجّع توكن جديد للجهاز الحالي.
exports.changePassword = catchAsync(async (req, res) => {
  const body = req.body || {};
  if (typeof body.oldPassword !== 'string' || !body.oldPassword) throw new AppError('الباسورد القديم مطلوب', 400);
  const newPassword = requirePassword(body.newPassword, 'الباسورد الجديد');
  if (newPassword === body.oldPassword) throw new AppError('الباسورد الجديد لازم يكون مختلف عن القديم', 400);

  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!user.password) throw new AppError('الحساب ده مسجل بجوجل ومفيش له باسورد. استخدم "نسيت الباسورد" لو عايز تحط باسورد', 400);
  // 400 مش 401: عشان الفرونت ميفتكرش إن الجلسة خلصت
  if (!(await user.comparePassword(body.oldPassword))) throw new AppError('الباسورد القديم غلط', 400);

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  return authResponse(res, user, 'تم تغيير الباسورد');
});

// ========== نسيت الباسورد ==========
// بيبعت كود 6 أرقام. الرد واحد سواء الإيميل موجود أو لأ.
exports.forgotPassword = catchAsync(async (req, res) => {
  const email = readEmail((req.body || {}).email);
  const user = await User.findOne({ email, isDeleted: { $ne: true } }).select('+otpSentAt');

  if (user) {
    const sentRecently = user.otpSentAt && Date.now() - user.otpSentAt.getTime() < OTP.RESEND_SECONDS * 1000;
    // لو لسه مبعوت كود من أقل من 60 ثانية بنتجاهل (ومنرجّعش خطأ عشان منكشفش إن الإيميل موجود)
    if (!sentRecently) {
      const otp = String(crypto.randomInt(10 ** (OTP.LENGTH - 1), 10 ** OTP.LENGTH));
      user.otpHash = hashOtp(otp);
      user.otpExpires = new Date(Date.now() + OTP.EXPIRES_MINUTES * 60 * 1000);
      user.otpAttempts = 0;
      user.otpSentAt = new Date();
      await user.save();
      sendOtpEmail(user.email, otp).catch(() => {}); // من غير await عشان التوقيت ميكشفش حاجة
    }
  }
  return ok(res, null, FORGOT_MESSAGE);
});

// ========== إعادة تعيين الباسورد بالكود ==========
// email + otp + newPassword في ريكوست واحد. حد أقصى 5 محاولات غلط وبعدها الكود يتبطل.
exports.resetPassword = catchAsync(async (req, res) => {
  const body = req.body || {};
  const email = readEmail(body.email);
  const newPassword = requirePassword(body.newPassword, 'الباسورد الجديد');
  if (typeof body.otp !== 'string' && typeof body.otp !== 'number') throw new AppError('الكود مطلوب', 400);
  const otp = String(body.otp).trim();

  const invalid = () => new AppError('الكود غلط أو منتهي، اطلب كود جديد', 400);

  const user = await User.findOne({ email, isDeleted: { $ne: true } }).select(
    '+otpHash +otpExpires +otpAttempts +tokenVersion'
  );
  if (!user || !user.otpHash || !user.otpExpires || user.otpExpires < new Date() || (user.otpAttempts || 0) >= OTP.MAX_ATTEMPTS) {
    throw invalid();
  }

  const expected = Buffer.from(user.otpHash);
  const actual = Buffer.from(hashOtp(otp));
  const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!match) {
    const update = { $inc: { otpAttempts: 1 } };
    // لو دي المحاولة الأخيرة نبطّل الكود
    if ((user.otpAttempts || 0) + 1 >= OTP.MAX_ATTEMPTS) update.$unset = { otpHash: 1, otpExpires: 1 };
    await User.updateOne({ _id: user._id }, update);
    throw invalid();
  }

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;
  await user.save();

  return ok(res, null, 'تم تغيير الباسورد، سجّل دخول بالباسورد الجديد');
});

// ========== حذف الحساب ==========
// بيطلب الباسورد. لو الحساب جوجل ومفيهوش باسورد: بيطلب idToken جديد من جوجل. وبعدين بيمسح كل أثر ليه.
exports.deleteAccount = catchAsync(async (req, res) => {
  const body = req.body || {};
  const user = await User.findById(req.user._id).select('+password');

  if (user.password) {
    if (typeof body.password !== 'string' || !body.password) throw new AppError('لازم تكتب الباسورد عشان تحذف الحساب', 400);
    if (!(await user.comparePassword(body.password))) throw new AppError('الباسورد غلط', 400);
  } else {
    if (!isGoogleConfigured()) throw new AppError('حذف حساب جوجل محتاج GOOGLE_CLIENT_ID متظبط على السيرفر', 501);
    const payload = await verifyGoogleToken(body.idToken);
    if (payload.sub !== user.googleId) throw new AppError('حساب جوجل ده مش بتاع الحساب ده', 403);
  }

  await deleteUserData(user._id);
  return ok(res, null, 'تم حذف الحساب وكل بياناته');
});
