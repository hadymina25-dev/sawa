// سكريبت لمرة واحدة: بيحوّل ميديا البوستات القديمة لشكل { url, publicId, resourceType }.
// بيتعامل مع: مصفوفة روابط (strings)، أو object فيه url من غير publicId.
// الـ publicId بيتستخرج من رابط Cloudinary نفسه. أي رابط مش Cloudinary بيتسجل ويتعدّى (من غير ما يتمسح).
// التشغيل:  npm run migrate:post-media          (تجربة بس من غير تعديل: DRY=1 npm run migrate:post-media)
// آمن تشغّله أكتر من مرة. اعمل backup للداتابيز قبل ما تشغله على داتا حقيقية.
require('dotenv').config();
const mongoose = require('mongoose');

// بيستخرج publicId و resourceType من رابط Cloudinary
// مثال: https://res.cloudinary.com/<cloud>/image/upload/v123/folder/name.jpg
//        -> { publicId: 'folder/name', resourceType: 'image' }
const parseCloudinaryUrl = (url) => {
  const type = /\/(image|video|raw)\/upload\//.exec(url || '');
  if (!type) return null;
  // الأول نحاول نلاقي رقم النسخة (v123/) وناخد اللي بعده، وإلا ناخد كل اللي بعد upload/
  const rest = url.split('/upload/')[1].split('?')[0];
  const versioned = /(?:^|\/)v\d+\/(.+)$/.exec(rest);
  const withExt = versioned ? versioned[1] : rest;
  const publicId = withExt.replace(/\.[a-zA-Z0-9]+$/, '');
  return { resourceType: type[1] === 'video' ? 'video' : 'image', publicId };
};

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI مش موجود في .env');
    process.exit(1);
  }
  const dry = process.env.DRY === '1';
  await mongoose.connect(process.env.MONGO_URI);
  const posts = mongoose.connection.db.collection('posts'); // بنقرا الـ collection مباشرة عشان الشكل القديم مايتعملوش cast

  let changed = 0;
  let skipped = 0;
  const cursor = posts.find({ media: { $exists: true, $ne: [] } });
  for (let post = await cursor.next(); post; post = await cursor.next()) {
    let dirty = false;
    const media = [];
    for (const item of post.media) {
      const url = typeof item === 'string' ? item : item && item.url;
      if (!url) { skipped += 1; continue; }
      if (typeof item === 'object' && item.publicId && item.resourceType) { media.push(item); continue; }

      const parsed = parseCloudinaryUrl(url);
      if (!parsed) {
        console.warn(`  ⚠️ رابط مش Cloudinary (اتعدّى): post ${post._id} -> ${url}`);
        skipped += 1;
        continue;
      }
      media.push({
        url,
        publicId: (typeof item === 'object' && item.publicId) || parsed.publicId,
        resourceType: (typeof item === 'object' && item.resourceType) || parsed.resourceType,
      });
      dirty = true;
    }
    if (dirty) {
      changed += 1;
      console.log(`  post ${post._id}: ${media.length} ميديا اتحوّلت`);
      if (!dry) await posts.updateOne({ _id: post._id }, { $set: { media } });
    }
  }

  console.log(`${dry ? '(تجربة) ' : ''}✅ خلصت: ${changed} بوست اتعدّل، ${skipped} عنصر اتعدّى`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('❌ فشل السكريبت:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

