// نقطة بداية السيرفر: بيحمّل الـ .env الأول، وبعدين يوصل بالداتابيز، وبعدين يشغّل الـ app.
require('dotenv').config();

const missing = ['MONGO_URI', 'JWT_SECRET'].filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`❌ ناقص في ملف .env: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️  JWT_SECRET قصير. الأفضل 32 حرف على الأقل.');
}

const connectDB = require('./config/db');
const app = require('./app');
const { isCloudinaryConfigured } = require('./config/cloudinary');
const { getFcm } = require('./config/firebase');

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err && err.message ? err.message : err);
});

const start = async () => {
  await connectDB();

  // تنبيهات بالحاجات الاختيارية اللي لسه مش متظبطة (مش بتوقّع السيرفر)
  if (!isCloudinaryConfigured) console.warn('⚠️  Cloudinary مش متظبط: رفع الصور/الفيديوهات هيرجع 503.');
  if (!process.env.GOOGLE_CLIENT_ID) console.warn('⚠️  GOOGLE_CLIENT_ID مش موجود: /auth/google هيرجع 501.');
  getFcm(); // بيطبع "FCM disabled" مرة واحدة لو Firebase مش متظبط

  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`✅ السيرفر شغال على بورت ${port}`));
};

start().catch((err) => {
  console.error('❌ السيرفر مقدرش يقوم:', err.message);
  process.exit(1);
});
