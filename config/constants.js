// كل الثوابت في مكان واحد. الفرونت محتاج قايمة الريأكشن وأسباب البلاغ (موجودين في ENDPOINTS.md).

module.exports = {
  // أنواع الريأكشن. ملحوظة: sad موجودة في القايمتين، عشان كده لازم نبعت kind + type مع بعض.
  REACTION_TYPES: {
    regular: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
    sign: ['love_you', 'sad', 'strongly_agree', 'thank_you', 'please', 'hello', 'sorry', 'congrats'],
  },

  REPORT_REASONS: ['spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'fake_account', 'other'],
  REPORT_TARGET_TYPES: ['user', 'post', 'comment'],

  NOTIFICATION_TYPES: [
    'reaction_post',
    'reaction_comment',
    'comment_post',
    'reply_comment',
    'friend_request',
    'friend_accepted',
  ],

  // كلمات ممنوع حد ياخدها كـ username (أسماء مسارات وكلمات رسمية)
  RESERVED_USERNAMES: [
    'admin', 'administrator', 'support', 'sawa', 'me', 'api', 'root', 'system', 'help',
    'moderator', 'mod', 'staff', 'official', 'security', 'settings', 'login', 'logout',
    'register', 'signup', 'signin', 'auth', 'user', 'users', 'post', 'posts', 'comment',
    'comments', 'reaction', 'reactions', 'friend', 'friends', 'block', 'blocks', 'report',
    'reports', 'notification', 'notifications', 'search', 'home', 'feed', 'profile', 'about',
    'contact', 'terms', 'privacy', 'www', 'mail', 'email', 'test', 'null', 'undefined',
    'anonymous', 'deleted', 'sawa_official', 'sawa_support',
  ],

  // حدود الحقول (أقصى طول)
  LIMITS: {
    NAME_MAX: 50,
    BIO_MAX: 150,
    FROM_MAX: 60,
    COLLEGE_MAX: 80,
    POST_TEXT_MAX: 5000,
    COMMENT_TEXT_MAX: 1000,
    REPORT_DETAILS_MAX: 500,
    PASSWORD_MIN: 8,
    PASSWORD_MAX: 72, // bcrypt بيقص بعد 72 بايت
  },

  // حدود الرفع
  UPLOAD: {
    POST_IMAGES_MAX_COUNT: 10,
    POST_VIDEOS_MAX_COUNT: 3,
    IMAGE_MAX_BYTES: 8 * 1024 * 1024, // 8MB للصورة
    POST_VIDEO_MAX_BYTES: 50 * 1024 * 1024, // 50MB للفيديو في البوست
    COMMENT_VIDEO_MAX_BYTES: 30 * 1024 * 1024, // 30MB لفيديو التعليق
    PROFILE_IMAGE_MAX_BYTES: 5 * 1024 * 1024, // 5MB للصورة الشخصية والغلاف
    IMAGE_MIMES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    VIDEO_MIMES: ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-matroska'],
  },

  OTP: {
    LENGTH: 6,
    EXPIRES_MINUTES: 10,
    MAX_ATTEMPTS: 5,
    RESEND_SECONDS: 60,
  },

  MAX_DEVICE_TOKENS: 10,
};
