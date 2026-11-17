// سكريبت لمرة واحدة: بيولّد username للمستخدمين القدام اللي مفيش عندهم.
// الـ username بيتولّد من بداية الإيميل + رقم عشوائي لو اتكرر.
// التشغيل:  npm run backfill:usernames   (بعد ما تظبط MONGO_URI في .env)
// آمن تشغّله أكتر من مرة: بيعدّي على اللي عنده username أصلاً.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { generateUsername } = require('../utils/username');

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI مش موجود في .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  const filter = { $or: [{ username: { $exists: false } }, { username: null }, { username: '' }] };
  const total = await User.countDocuments(filter);
  console.log(`لقيت ${total} يوزر من غير username`);

  let done = 0;
  const cursor = User.find(filter).select('email').cursor();
  for (let user = await cursor.next(); user; user = await cursor.next()) {
    const username = await generateUsername(String(user.email || '').split('@')[0]);
    // $set مباشر عشان نتفادى أي validation على باقي الحقول القديمة
    await User.updateOne({ _id: user._id }, { $set: { username } });
    done += 1;
    console.log(`  ${user.email} -> ${username}`);
  }

  console.log(`✅ خلصت: ${done} username اتولّد`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('❌ فشل السكريبت:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
