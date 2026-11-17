// رفع الملفات بـ multer (في الذاكرة، وبعدين الكنترولر بيرفعها على Cloudinary).
// فيه حدود لعدد الملفات وحجمها ونوعها (mimetype).
const multer = require('multer');
const AppError = require('../utils/appError');
const { UPLOAD } = require('../config/constants');

const IMAGE_FIELDS = ['images', 'avatar', 'cover'];

// بيقبل بس الأنواع المسموحة حسب اسم الحقل (صور في images/avatar/cover، فيديو في الباقي)
const fileFilter = (req, file, cb) => {
  const allowed = IMAGE_FIELDS.includes(file.fieldname) ? UPLOAD.IMAGE_MIMES : UPLOAD.VIDEO_MIMES;
  if (!allowed.includes(file.mimetype)) {
    return cb(new AppError(`نوع الملف (${file.mimetype}) مش مسموح في الحقل ${file.fieldname}`, 400));
  }
  return cb(null, true);
};

const make = (maxBytes, maxFiles) =>
  multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: maxBytes, files: maxFiles } });

// multer بيدّينا حد حجم واحد لكل الحقول، فالصور (الأصغر) بنراجعها يدويًا
const enforceImageSize = (req, res, next) => {
  const files = (req.files && req.files.images) || [];
  const tooBig = files.find((f) => f.size > UPLOAD.IMAGE_MAX_BYTES);
  if (tooBig) {
    return next(new AppError(`الصورة ${tooBig.originalname} أكبر من ${UPLOAD.IMAGE_MAX_BYTES / 1024 / 1024}MB`, 400));
  }
  return next();
};

// بوست: images (لحد 10) و videos (لحد 3)
exports.uploadPostMedia = [
  make(UPLOAD.POST_VIDEO_MAX_BYTES, UPLOAD.POST_IMAGES_MAX_COUNT + UPLOAD.POST_VIDEOS_MAX_COUNT).fields([
    { name: 'images', maxCount: UPLOAD.POST_IMAGES_MAX_COUNT },
    { name: 'videos', maxCount: UPLOAD.POST_VIDEOS_MAX_COUNT },
  ]),
  enforceImageSize,
];

// تعليق: فيديو واحد في الحقل video
exports.uploadCommentVideo = make(UPLOAD.COMMENT_VIDEO_MAX_BYTES, 1).single('video');

// الصورة الشخصية والغلاف
exports.uploadAvatar = make(UPLOAD.PROFILE_IMAGE_MAX_BYTES, 1).single('avatar');
exports.uploadCover = make(UPLOAD.PROFILE_IMAGE_MAX_BYTES, 1).single('cover');
