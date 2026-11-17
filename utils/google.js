// التحقق من Google ID token اللي الفرونت بيبعته. المكتبة بتتحمّل وقت الاستخدام بس.
const AppError = require('./appError');

exports.isGoogleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID);

// بيرجّع payload التوكن (sub, email, name, ...) أو بيرمي 401
exports.verifyGoogleToken = async (idToken) => {
  if (!exports.isGoogleConfigured()) {
    throw new AppError('تسجيل الدخول بجوجل لسه مش متفعّل (GOOGLE_CLIENT_ID ناقص في .env)', 501);
  }
  if (typeof idToken !== 'string' || !idToken) throw new AppError('idToken مطلوب', 400);

  const { OAuth2Client } = require('google-auth-library');
  const audience = process.env.GOOGLE_CLIENT_ID.split(',').map((id) => id.trim()).filter(Boolean);
  const client = new OAuth2Client();

  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email || !payload.email_verified) {
      throw new Error('payload ناقص أو الإيميل مش متأكد منه');
    }
    return payload;
  } catch (err) {
    throw new AppError('Google token غلط أو منتهي', 401);
  }
};
