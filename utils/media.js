// التعامل مع Cloudinary: رفع، مسح، وعمل صورة مصغرة. أي ملف بيتخزن { url, publicId, resourceType }.
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const AppError = require('./appError');

// بيرفع ملف (buffer) على Cloudinary ويرجّع { url, publicId, resourceType }
exports.uploadBuffer = (buffer, { folder, resourceType = 'image' }) =>
  new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured) {
      return reject(new AppError('رفع الميديا مش متفعّل: بيانات Cloudinary ناقصة في .env', 503));
    }
    const stream = cloudinary.uploader.upload_stream(
      { folder: `sawa/${folder}`, resource_type: resourceType },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary رجّع رد فاضي'));
        return resolve({ url: result.secure_url, publicId: result.public_id, resourceType });
      }
    );
    stream.end(buffer);
  });

// بيرفع كذا ملف مع بعض. لو واحد فشل بيمسح اللي اترفع (rollback) ويرمي خطأ.
// items: [{ file, resourceType }]
exports.uploadMany = async (items, folder) => {
  const settled = await Promise.allSettled(
    items.map((item) => exports.uploadBuffer(item.file.buffer, { folder, resourceType: item.resourceType }))
  );

  const uploaded = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  const failed = settled.find((s) => s.status === 'rejected');

  if (failed) {
    await exports.deleteMediaList(uploaded);
    if (failed.reason instanceof AppError) throw failed.reason;
    console.error('[cloudinary] فشل الرفع:', failed.reason && failed.reason.message);
    throw new AppError('فشل رفع الميديا، جرّب تاني', 502);
  }
  return uploaded; // نفس ترتيب items
};

// بيمسح ملف واحد من Cloudinary. مبيرميش خطأ أبدًا (بيسجّل publicId لو فشل). بيرجّع true لو نجح.
exports.deleteMedia = async (media) => {
  if (!media || !media.publicId) return true;
  if (!isCloudinaryConfigured) {
    console.error(`[cloudinary] مش متظبط، الملف متمسحش: ${media.publicId}`);
    return false;
  }
  try {
    const result = await cloudinary.uploader.destroy(media.publicId, {
      resource_type: media.resourceType || 'image',
      invalidate: true,
    });
    if (result && (result.result === 'ok' || result.result === 'not found')) return true;
    console.error(`[cloudinary] مسح غير ناجح (${result && result.result}): ${media.publicId}`);
    return false;
  } catch (err) {
    console.error(`[cloudinary] فشل مسح ${media.publicId}: ${err.message}`);
    return false;
  }
};

// بيمسح قايمة ملفات، ويرجّع الملفات اللي فشل مسحها
exports.deleteMediaList = async (list) => {
  const items = (list || []).filter(Boolean);
  const results = await Promise.all(items.map((m) => exports.deleteMedia(m)));
  return items.filter((_, i) => !results[i]);
};

// صورة مصغرة من رابط Cloudinary (للبروفايل المقفول)
exports.thumbUrl = (url, size = 200) => {
  if (typeof url !== 'string' || !url.includes('/upload/')) return url || null;
  return url.replace('/upload/', `/upload/w_${size},h_${size},c_fill,q_auto/`);
};
