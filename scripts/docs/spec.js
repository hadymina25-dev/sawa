// مصدر التوثيق الوحيد: منه بيتولّد ENDPOINTS.md و Sawa.postman_collection.json (npm run docs).
// لو غيّرت endpoint في الكود، عدّل هنا وشغّل: npm run docs
// الأمثلة مكتوبة من قراءة الكنترولرز (utils/serialize.js) مش من ريكوستات حية، فجرّبها في Postman.

const ID = (n) => `6560a1b2c3d4e5f6071829${String(n).padStart(2, '0')}`;
const BRIEF = { _id: ID(1), name: 'هادي عطالله', username: 'hady', avatar: 'https://res.cloudinary.com/demo/image/upload/v1/sawa/avatars/hady.jpg' };
const BRIEF2 = { _id: ID(2), name: 'سارة أحمد', username: 'sara_ahmed', avatar: null };
const SELF = {
  _id: ID(1), name: 'هادي عطالله', username: 'hady', email: 'hady@example.com', bio: 'مطور باك إند',
  from: 'القاهرة', college: 'حاسبات ومعلومات', avatar: BRIEF.avatar, cover: null, isLocked: false, createdAt: '2026-11-01T10:00:00.000Z',
};
const MEDIA_IMG = { url: 'https://res.cloudinary.com/demo/image/upload/v1/sawa/posts/p1.jpg', resourceType: 'image' };
const POST = {
  _id: ID(10), author: BRIEF, text: 'أول بوست في سوا 👋', media: [MEDIA_IMG], reactionsCount: 3, commentsCount: 2,
  isEdited: false, myReaction: { kind: 'regular', type: 'love' }, createdAt: '2026-11-10T12:00:00.000Z', updatedAt: '2026-11-10T12:00:00.000Z',
};
const COMMENT = {
  _id: ID(20), post: ID(10), parentComment: null, author: BRIEF2, text: 'مبروك!', video: null, repliesCount: 1,
  reactionsCount: 0, isEdited: false, myReaction: null, createdAt: '2026-11-10T12:05:00.000Z', updatedAt: '2026-11-10T12:05:00.000Z',
};
const PAG = { page: 1, limit: 10, total: 25, totalPages: 3 };
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

const f = (name, type, required, desc) => ({ name, type, required, desc });
const PAGE_Q = [f('page', 'number', false, 'رقم الصفحة (الافتراضي 1)'), f('limit', 'number', false, 'عدد العناصر (الافتراضي 10، الأقصى 50)')];
const E400ID = [400, 'المعرّف غلط (ObjectId مش صالح)'];

const spec = [];
const add = (folder, e) => spec.push({ folder, auth: true, params: [], query: [], body: [], form: [], errors: [], notes: [], vars: {}, ...e });

// ===================== Auth =====================
const AUTH = 'Auth';
add(AUTH, {
  name: 'تسجيل حساب جديد', desc: 'بيعمل حساب جديد ويرجّع توكن. الـ username اختياري، ولو مش مبعوت بيتولّد من الإيميل.',
  method: 'POST', path: '/auth/register', auth: false,
  body: [f('name', 'string', true, '2-50 حرف'), f('email', 'string', true, 'إيميل صالح'), f('password', 'string', true, '8-72 حرف'), f('username', 'string', false, '3-20 حرف: a-z و 0-9 و _ (بيتخزن lowercase)')],
  example: { name: 'هادي عطالله', email: 'hady@example.com', password: 'Passw0rd!123', username: 'hady' },
  status: 201, message: 'تم إنشاء الحساب بنجاح', response: { token: TOKEN, user: SELF },
  errors: [[400, 'مدخلات غلط (اسم/إيميل/باسورد/username غلط أو محجوز)'], [409, 'الإيميل أو الـ username متسجل قبل كده'], [429, 'محاولات تسجيل كتير']],
  tests: 'saveToken',
  notes: ['احفظ `data.token` وابعته في كل ريكوست بعد كده.'],
});
add(AUTH, {
  name: 'تسجيل الدخول', desc: 'إيميل وباسورد، بيرجّع توكن.', method: 'POST', path: '/auth/login', auth: false,
  body: [f('email', 'string', true, ''), f('password', 'string', true, '')],
  example: { email: 'hady@example.com', password: 'Passw0rd!123' },
  message: 'تم تسجيل الدخول', response: { token: TOKEN, user: SELF },
  errors: [[400, 'إيميل/باسورد ناقص'], [401, 'الإيميل أو الباسورد غلط (رسالة واحدة لكل الحالات)'], [429, 'محاولات كتير (10 كل 15 دقيقة)']],
  tests: 'saveToken',
});
add(AUTH, {
  name: 'تسجيل الدخول بجوجل', desc: 'الفرونت بيبعت Google ID token. لو الإيميل موجود الحساب بيتربط، ولو لأ بيتعمل حساب جديد.',
  method: 'POST', path: '/auth/google', auth: false,
  body: [f('idToken', 'string', true, 'Google ID token من Google Sign-In')],
  example: { idToken: 'GOOGLE_ID_TOKEN' }, message: 'تم تسجيل الدخول بجوجل', response: { token: TOKEN, user: SELF },
  errors: [[400, 'idToken ناقص'], [401, 'Google token غلط أو منتهي'], [501, 'GOOGLE_CLIENT_ID لسه مش متظبط على السيرفر']],
  tests: 'saveToken', notes: ['لسه مش متجرب بتوكن حقيقي (محتاج GOOGLE_CLIENT_ID من صاحبك).'],
});
add(AUTH, {
  name: 'تسجيل الخروج', desc: 'بيبطّل التوكن فعليًا (على كل الأجهزة) بزيادة tokenVersion. ولو بعت deviceToken بيتمسح.',
  method: 'POST', path: '/auth/logout', body: [f('deviceToken', 'string', false, 'توكن FCM بتاع الجهاز الحالي')],
  example: { deviceToken: 'FCM_DEVICE_TOKEN' }, message: 'تم تسجيل الخروج', response: null,
  errors: [[401, 'مفيش login / توكن منتهي']],
  notes: ['أي توكن قديم بيرجع 401 بعد اللوج أوت، حتى لو لسه مخلصش مدته.', 'اللوج أوت من جهاز بيطرد كل الأجهزة (قرار تصميم).'],
});
add(AUTH, {
  name: 'بياناتي', desc: 'بيرجّع بيانات اليوزر الحالي (فيها الإيميل).', method: 'GET', path: '/auth/me',
  response: SELF, errors: [[401, 'مفيش login / توكن منتهي']],
});
add(AUTH, {
  name: 'تغيير الباسورد', desc: 'الباسورد القديم + الجديد. باقي الأجهزة بتتطرد، والجهاز الحالي بياخد توكن جديد.',
  method: 'POST', path: '/auth/change-password',
  body: [f('oldPassword', 'string', true, ''), f('newPassword', 'string', true, '8-72 حرف ومختلف عن القديم')],
  example: { oldPassword: 'Passw0rd!123', newPassword: 'NewPassw0rd!456' }, message: 'تم تغيير الباسورد', response: { token: TOKEN, user: SELF },
  errors: [[400, 'الباسورد القديم غلط / الجديد زي القديم / حساب جوجل من غير باسورد'], [401, 'مفيش login']],
  tests: 'saveToken', notes: ['لازم الفرونت يستبدل التوكن المحفوظ بالتوكن الجديد، لأن القديم بطل.', 'الباسورد القديم الغلط بيرجع 400 (مش 401) عشان الفرونت ميفتكرش إن الجلسة خلصت.'],
});
add(AUTH, {
  name: 'نسيت الباسورد', desc: 'بيبعت كود 6 أرقام على الإيميل (صلاحيته 10 دقايق). الرد واحد سواء الإيميل موجود أو لأ.',
  method: 'POST', path: '/auth/forgot-password', auth: false, body: [f('email', 'string', true, '')],
  example: { email: 'hady@example.com' }, message: 'لو الإيميل ده مسجّل عندنا، هيوصله كود التحقق خلال دقايق', response: null,
  errors: [[400, 'إيميل غير صالح'], [429, 'طلبات كتير (5 كل 15 دقيقة)']],
  notes: ['منع إعادة الإرسال قبل 60 ثانية بيتم بهدوء (نفس الرد). خلّي زرار "إعادة الإرسال" يستنى 60 ثانية.', 'وإنت بتجرب من غير إيميل متظبط: الكود بيتطبع في تيرمنال السيرفر (وضع التطوير بس).'],
});
add(AUTH, {
  name: 'إعادة تعيين الباسورد', desc: 'الإيميل + الكود + الباسورد الجديد في ريكوست واحد. حد أقصى 5 محاولات غلط وبعدها الكود يتبطل.',
  method: 'POST', path: '/auth/reset-password', auth: false,
  body: [f('email', 'string', true, ''), f('otp', 'string', true, 'الكود (6 أرقام)'), f('newPassword', 'string', true, '8-72 حرف')],
  example: { email: 'hady@example.com', otp: '123456', newPassword: 'NewPassw0rd!456' }, message: 'تم تغيير الباسورد، سجّل دخول بالباسورد الجديد', response: null,
  errors: [[400, 'الكود غلط أو منتهي أو المحاولات خلصت (رسالة واحدة)'], [429, 'محاولات كتير']],
  notes: ['بعد النجاح كل الأجهزة بتتطرد واليوزر لازم يسجّل دخول من جديد.'],
});
add(AUTH, {
  name: 'حذف الحساب', desc: 'بيمسح الحساب وكل بياناته نهائيًا (بوستات، تعليقات، ريأكشنز، صداقات، حظر، إشعارات، صور). لا رجعة فيه.',
  method: 'DELETE', path: '/auth/me',
  body: [f('password', 'string', false, 'مطلوب لو الحساب ليه باسورد'), f('idToken', 'string', false, 'مطلوب لو الحساب جوجل من غير باسورد (Google ID token جديد)')],
  example: { password: 'Passw0rd!123' }, message: 'تم حذف الحساب وكل بياناته', response: null,
  errors: [[400, 'الباسورد ناقص أو غلط'], [401, 'مفيش login / Google token غلط'], [403, 'حساب جوجل ده مش بتاع الحساب'], [501, 'حساب جوجل ومفيش GOOGLE_CLIENT_ID']],
  notes: ['البلاغات اللي اتعملت ضده بتفضل (قرار تصميم).'],
});

// ===================== Profile =====================
const PROF = 'Profile';
add(PROF, {
  name: 'عرض بروفايل', desc: 'بروفايل أي يوزر. :idOrUsername ممكن يبقى id أو username أو `me`.',
  method: 'GET', path: '/users/:idOrUsername', vars: { idOrUsername: 'userId' },
  params: [f('idOrUsername', 'string', true, 'ObjectId أو username أو me')],
  response: { _id: ID(2), name: 'سارة أحمد', username: 'sara_ahmed', bio: '', from: 'الإسكندرية', college: 'طب', avatar: null, cover: null, isLocked: false, createdAt: '2026-11-02T09:00:00.000Z', friendsCount: 12, friendshipStatus: 'none', friendRequestId: null },
  errors: [[400, 'معرّف غلط'], [401, 'مفيش login'], [404, 'اليوزر مش موجود أو في حظر بينكم (في أي اتجاه)']],
  notes: [
    '`friendshipStatus`: `self` | `friend` | `request_sent` | `request_received` | `none`. و`friendRequestId` ده id الطلب لو في طلب (تستخدمه في قبول/رفض/إلغاء).',
    '**بروفايل مقفول وإنت غريب:** بيرجع بيانات مختصرة بس: `_id, name, username, isLocked:true, avatar` (صورة مصغرة 200px) + `friendshipStatus` + `friendRequestId`. من غير bio/from/college/cover/friendsCount. **امنع تحميل/تكبير الصورة في الفرونت.**',
    'الإيميل بيرجع لصاحب البروفايل بس.',
  ],
});
add(PROF, {
  name: 'تعديل بياناتي', desc: 'الاسم، النبذة، منين، الكلية، وقفل/فتح البروفايل. ابعت اللي عايز تغيّره بس (حقل واحد على الأقل).',
  method: 'PATCH', path: '/users/me',
  body: [f('name', 'string', false, '2-50'), f('bio', 'string', false, 'حتى 150'), f('from', 'string', false, 'حتى 60'), f('college', 'string', false, 'حتى 80'), f('isLocked', 'boolean', false, 'true لقفل البروفايل')],
  example: { bio: 'مطور باك إند', from: 'القاهرة', college: 'حاسبات ومعلومات', isLocked: false }, message: 'تم تحديث البروفايل', response: SELF,
  errors: [[400, 'مفيش حقول / قيمة غلط أو طويلة'], [401, 'مفيش login']],
});
add(PROF, {
  name: 'تغيير الـ username', desc: 'بيتخزن lowercase. مفيش cooldown.', method: 'PATCH', path: '/users/me/username',
  body: [f('username', 'string', true, '^[a-z0-9_]{3,20}$ ومش من الكلمات المحجوزة (admin, support, sawa, me, api...)')],
  example: { username: 'hady_dev' }, message: 'تم تغيير الـ username', response: { ...SELF, username: 'hady_dev' },
  errors: [[400, 'شكل غلط أو كلمة محجوزة'], [401, 'مفيش login'], [409, 'متاخد']],
});
add(PROF, {
  name: 'هل الـ username متاح؟', desc: 'للفرونت وهو بيكتب. من غير login. بيرجع دايمًا 200.',
  method: 'GET', path: '/users/username-available/:username', auth: false, vars: { username: 'username' },
  params: [f('username', 'string', true, 'اللي اليوزر بيكتبه')], response: { username: 'hady', available: false, reason: 'taken' },
  errors: [],
  notes: ['`available:true` لو متاح. لو لأ بيرجع `reason`: `invalid` (شكل غلط) | `reserved` (محجوز) | `taken` (متاخد).'],
});
add(PROF, {
  name: 'تغيير الصورة الشخصية', desc: 'بيرفع صورة جديدة على Cloudinary ويمسح القديمة.', method: 'PUT', path: '/users/me/avatar',
  form: [f('avatar', 'file', true, 'صورة jpeg/png/webp/gif، أقصى 5MB')], message: 'تم تغيير الصورة الشخصية', response: { ...SELF },
  errors: [[400, 'مفيش ملف / نوع أو حجم غلط'], [401, 'مفيش login'], [503, 'Cloudinary مش متظبط']],
  notes: ['Content-Type: multipart/form-data (الفرونت بيظبطه لوحده مع FormData).'],
});
add(PROF, {
  name: 'تغيير صورة الغلاف', desc: 'نفس الصورة الشخصية بس للغلاف.', method: 'PUT', path: '/users/me/cover',
  form: [f('cover', 'file', true, 'صورة jpeg/png/webp/gif، أقصى 5MB')], message: 'تم تغيير صورة الغلاف', response: { ...SELF },
  errors: [[400, 'مفيش ملف / نوع أو حجم غلط'], [401, 'مفيش login'], [503, 'Cloudinary مش متظبط']],
});
add(PROF, {
  name: 'تسجيل توكن الجهاز (FCM)', desc: 'بيسجل توكن الجهاز عشان الـ push. لو التوكن كان على يوزر تاني بيتشال منه. (حد أقصى 10 أجهزة لليوزر).',
  method: 'POST', path: '/users/device-token', body: [f('deviceToken', 'string', true, 'توكن Firebase بتاع الجهاز')],
  example: { deviceToken: 'FCM_DEVICE_TOKEN_STRING' }, message: 'تم تسجيل توكن الجهاز', response: null,
  errors: [[400, 'توكن ناقص'], [401, 'مفيش login']],
  notes: ['نادي عليه بعد كل تسجيل دخول، وكل ما FCM يجدد التوكن.'],
});
add(PROF, {
  name: 'مسح توكن الجهاز', desc: 'عند اللوج أوت (ممكن تبعته في /auth/logout بدل ده).', method: 'DELETE', path: '/users/device-token',
  body: [f('deviceToken', 'string', true, '')], example: { deviceToken: 'FCM_DEVICE_TOKEN_STRING' }, message: 'تم مسح توكن الجهاز', response: null,
  errors: [[400, 'توكن ناقص'], [401, 'مفيش login']],
});
add(PROF, {
  name: 'بوستات صاحب بروفايل', desc: 'بوستات يوزر معين، الأحدث الأول.', method: 'GET', path: '/users/:id/posts', vars: { id: 'userId' },
  params: [f('id', 'string', true, 'id اليوزر')], query: PAGE_Q, message: 'بوستات اليوزر', response: [POST], pagination: PAG,
  errors: [E400ID, [401, 'مفيش login'], [403, 'البروفايل ده مقفول وإنت مش صديقه'], [404, 'اليوزر مش موجود أو في حظر']],
  notes: ['البروفايل المقفول بيرجع **403** (مش قايمة فاضية). اعرض رسالة "البروفايل ده مقفول".'],
});

// ===================== Posts =====================
const POSTS = 'Posts';
add(POSTS, {
  name: 'نشر بوست', desc: 'نص و/أو صور و/أو فيديوهات في ريكوست واحد.', method: 'POST', path: '/posts',
  form: [f('text', 'string', false, 'حتى 5000 حرف'), f('images', 'file[]', false, 'لحد 10 صور (jpeg/png/webp/gif) كل واحدة أقصاها 8MB'), f('videos', 'file[]', false, 'لحد 3 فيديوهات (mp4/mov/webm/3gp/mkv) كل واحد أقصاه 50MB')],
  example: { text: 'أول بوست في سوا 👋' }, status: 201, message: 'تم نشر البوست', response: { ...POST, myReaction: null, reactionsCount: 0, commentsCount: 0 },
  errors: [[400, 'لازم نص أو ميديا / نوع أو حجم أو عدد ملفات غلط'], [401, 'مفيش login'], [502, 'فشل الرفع على Cloudinary (اللي اترفع بيتمسح)'], [503, 'Cloudinary مش متظبط']],
  tests: 'savePostId',
  notes: ['لو نص بس ممكن تبعت JSON عادي `{ "text": "..." }`.', 'ملحوظة للميديا: الرد بيرجع `{ url, resourceType }` (مفيش publicId).'],
});
add(POSTS, {
  name: 'الفيد الرئيسي', desc: 'بوستات أصدقائي + بوستاتي، الأحدث الأول. من غير المحظورين والمحذوفين.', method: 'GET', path: '/posts/feed',
  query: PAGE_Q, message: 'الفيد', response: [POST], pagination: PAG, errors: [[400, 'page/limit غلط'], [401, 'مفيش login']],
  notes: ['كل بوست فيه `author` مختصر و`myReaction` (`null` أو `{kind,type}`).'],
});
add(POSTS, {
  name: 'عرض بوست', desc: 'بوست واحد.', method: 'GET', path: '/posts/:id', vars: { id: 'postId' }, params: [f('id', 'string', true, 'id البوست')],
  response: POST, errors: [E400ID, [401, 'مفيش login'], [403, 'صاحب البوست بروفايله مقفول وإنت مش صديقه'], [404, 'مش موجود / محذوف / في حظر']],
});
add(POSTS, {
  name: 'تعديل بوست', desc: 'النص بس (صاحبه بس). مفيش تعديل للميديا.', method: 'PATCH', path: '/posts/:id', vars: { id: 'postId' },
  params: [f('id', 'string', true, '')], body: [f('text', 'string', true, 'حتى 5000. لو البوست من غير ميديا مينفعش يبقى فاضي')],
  example: { text: 'النص بعد التعديل' }, message: 'تم تعديل البوست', response: { ...POST, text: 'النص بعد التعديل', isEdited: true },
  errors: [[400, 'نص غلط'], [401, 'مفيش login'], [403, 'مش بوستك'], [404, 'مش موجود']],
});
add(POSTS, {
  name: 'حذف بوست', desc: 'صاحبه بس. بيمسح التعليقات والريأكشنز والإشعارات والصور/الفيديوهات.', method: 'DELETE', path: '/posts/:id', vars: { id: 'postId' },
  params: [f('id', 'string', true, '')], message: 'تم حذف البوست', response: null, errors: [E400ID, [401, 'مفيش login'], [403, 'مش بوستك'], [404, 'مش موجود']],
});

// ===================== Comments =====================
const COMM = 'Comments';
add(COMM, {
  name: 'إضافة تعليق أو رد', desc: 'نفس الـ endpoint للتعليق والرد. لو بعت `parentComment` يبقى رد (على تعليق أو على رد، من غير حد أقصى للعمق).',
  method: 'POST', path: '/posts/:postId/comments', vars: { postId: 'postId' }, params: [f('postId', 'string', true, 'id البوست')],
  form: [f('text', 'string', false, 'حتى 1000 حرف (ممكن إيموجي)'), f('video', 'file', false, 'فيديو لغة إشارة (mp4/mov/webm/3gp/mkv) أقصاه 30MB'), f('parentComment', 'string', false, 'id التعليق/الرد اللي بترد عليه')],
  example: { text: 'مبروك!' }, status: 201, message: 'تم إضافة التعليق', response: COMMENT,
  errors: [[400, 'لازم نص أو فيديو / parentComment مش تابع للبوست'], [401, 'مفيش login'], [403, 'بروفايل مقفول'], [404, 'البوست أو التعليق الأب مش موجود أو في حظر'], [503, 'Cloudinary مش متظبط']],
  tests: 'saveCommentId', notes: ['لازم نص أو فيديو أو الاتنين. ممكن تبعت JSON لو من غير فيديو.'],
});
add(COMM, {
  name: 'تعليقات بوست', desc: 'التعليقات المباشرة بس، الأحدث الأول.', method: 'GET', path: '/posts/:postId/comments', vars: { postId: 'postId' },
  params: [f('postId', 'string', true, '')], query: PAGE_Q, message: 'التعليقات', response: [COMMENT], pagination: PAG,
  errors: [E400ID, [401, 'مفيش login'], [403, 'بروفايل مقفول'], [404, 'البوست مش موجود']],
  notes: ['`repliesCount` عدد الردود المباشرة. هات الردود من endpoint الردود.', 'تعليقات المحظورين متخفية (فممكن عدد العناصر يبقى أقل من repliesCount).'],
});
add(COMM, {
  name: 'ردود تعليق', desc: 'ردود أي تعليق أو رد (أي مستوى). الأقدم الأول.', method: 'GET', path: '/comments/:id/replies', vars: { id: 'commentId' },
  params: [f('id', 'string', true, 'id التعليق أو الرد')], query: PAGE_Q, message: 'الردود', response: [{ ...COMMENT, _id: ID(21), parentComment: ID(20), text: 'شكرًا ❤️', repliesCount: 0 }], pagination: PAG,
  errors: [E400ID, [401, 'مفيش login'], [403, 'بروفايل مقفول'], [404, 'مش موجود أو في حظر']],
});
add(COMM, {
  name: 'تعديل تعليق', desc: 'النص بس (صاحبه بس).', method: 'PATCH', path: '/comments/:id', vars: { id: 'commentId' }, params: [f('id', 'string', true, '')],
  body: [f('text', 'string', true, 'حتى 1000. لو التعليق من غير فيديو مينفعش يبقى فاضي')], example: { text: 'مبروك يا هادي!' },
  message: 'تم تعديل التعليق', response: { ...COMMENT, text: 'مبروك يا هادي!', isEdited: true },
  errors: [[400, 'نص غلط'], [401, 'مفيش login'], [403, 'مش تعليقك'], [404, 'مش موجود']],
});
add(COMM, {
  name: 'حذف تعليق', desc: 'صاحبه بس. بيمسح التعليق وكل الردود اللي تحته بكل المستويات، والعدادات بتتظبط.', method: 'DELETE', path: '/comments/:id', vars: { id: 'commentId' },
  params: [f('id', 'string', true, '')], message: 'تم حذف التعليق', response: { deletedCount: 4 }, errors: [E400ID, [401, 'مفيش login'], [403, 'مش تعليقك'], [404, 'مش موجود']],
  notes: ['`deletedCount` = عدد التعليقات والردود اللي اتمسحت كلها (بيقلل `commentsCount` بتاع البوست بنفس العدد).'],
});

// ===================== Reactions =====================
const REACT = 'Reactions';
add(REACT, {
  name: 'ريأكشن (toggle)', desc: 'على بوست أو تعليق أو رد. مفيش ريأكشن → يتعمل. نوع مختلف → يتغيّر. نفس النوع → يتشال.',
  method: 'POST', path: '/reactions',
  body: [f('targetType', 'string', true, '`post` أو `comment`'), f('targetId', 'string', true, 'id الهدف'), f('kind', 'string', true, '`regular` أو `sign`'), f('type', 'string', true, 'من قايمة الـ kind (شوف الثوابت)')],
  example: { targetType: 'post', targetId: ID(10), kind: 'regular', type: 'love' }, message: 'تم الريأكشن',
  response: { targetType: 'post', targetId: ID(10), myReaction: { kind: 'regular', type: 'love' }, reactionsCount: 4 },
  errors: [[400, 'kind/type/targetType غلط'], [401, 'مفيش login'], [403, 'بروفايل مقفول'], [404, 'الهدف مش موجود أو في حظر'], [409, 'تعارض ريكوستات في نفس اللحظة (جرّب تاني)']],
  notes: ['`myReaction: null` في الرد = الريأكشن اتشال.', '`sad` موجودة في القايمتين (regular و sign) عشان كده لازم تبعت `kind` و`type` مع بعض.'],
});
add(REACT, {
  name: 'مين عمل ريأكشن', desc: 'قايمة الريأكشنز على هدف + ملخص بعدد كل نوع.', method: 'GET', path: '/reactions',
  query: [f('targetType', 'string', true, 'post | comment'), f('targetId', 'string', true, ''), f('kind', 'string', false, 'فلتر'), f('type', 'string', false, 'فلتر'), ...PAGE_Q],
  message: 'الريأكشنز', response: [{ _id: ID(30), user: BRIEF2, kind: 'regular', type: 'love', createdAt: '2026-11-10T12:10:00.000Z' }], pagination: PAG,
  summary: [{ kind: 'regular', type: 'love', count: 2 }, { kind: 'sign', type: 'love_you', count: 1 }],
  errors: [[400, 'مدخلات غلط'], [401, 'مفيش login'], [403, 'بروفايل مقفول'], [404, 'الهدف مش موجود أو في حظر']],
  notes: ['`summary` بيرجع جنب `pagination` وبيعد كل الأنواع (من غير فلتر).'],
});

// ===================== Friends =====================
const FR = 'Friends';
add(FR, {
  name: 'إرسال طلب صداقة', desc: 'بيبعت طلب (pending) ويبعت إشعار للمستلم.', method: 'POST', path: '/friends/requests/:userId', vars: { userId: 'otherUserId' },
  params: [f('userId', 'string', true, 'id اليوزر اللي هتبعتله')], status: 201, message: 'تم إرسال طلب الصداقة', response: { requestId: ID(40), status: 'request_sent' },
  errors: [[400, 'طلب لنفسك'], [401, 'مفيش login'], [404, 'اليوزر مش موجود أو في حظر'], [409, 'في طلب أو صداقة أصلاً']], tests: 'saveRequestId',
});
add(FR, {
  name: 'قبول طلب', desc: 'للمستلم بس.', method: 'POST', path: '/friends/requests/:requestId/accept', vars: { requestId: 'requestId' },
  params: [f('requestId', 'string', true, 'id الطلب (الـ requestId)')], message: 'تم قبول طلب الصداقة', response: { requestId: ID(40), status: 'friend' },
  errors: [E400ID, [401, 'مفيش login'], [404, 'الطلب مش موجود (أو مش ليك)']],
});
add(FR, {
  name: 'رفض طلب', desc: 'للمستلم بس. بيمسح الطلب (عشان يقدر يبعت جديد بعدين) وإشعاره.', method: 'POST', path: '/friends/requests/:requestId/reject', vars: { requestId: 'requestId' },
  params: [f('requestId', 'string', true, '')], message: 'تم رفض طلب الصداقة', response: null, errors: [E400ID, [401, 'مفيش login'], [404, 'الطلب مش موجود']],
});
add(FR, {
  name: 'إلغاء طلب أنا بعته', desc: 'للمرسل بس.', method: 'DELETE', path: '/friends/requests/:requestId', vars: { requestId: 'requestId' },
  params: [f('requestId', 'string', true, '')], message: 'تم إلغاء طلب الصداقة', response: null, errors: [E400ID, [401, 'مفيش login'], [404, 'الطلب مش موجود']],
});
add(FR, {
  name: 'إزالة صديق', desc: 'بيشيل الصداقة.', method: 'DELETE', path: '/friends/:userId', vars: { userId: 'otherUserId' },
  params: [f('userId', 'string', true, 'id الصديق')], message: 'تم إزالة الصديق', response: null, errors: [E400ID, [401, 'مفيش login'], [404, 'إنتوا مش أصحاب']],
});
add(FR, {
  name: 'قايمة أصدقائي', desc: 'أصدقائي (مختصرين).', method: 'GET', path: '/friends', query: PAGE_Q, message: 'قايمة الأصدقاء', response: [BRIEF2], pagination: PAG,
  errors: [[401, 'مفيش login']],
});
add(FR, {
  name: 'الطلبات الواردة', desc: 'طلبات صداقة جاتلي.', method: 'GET', path: '/friends/requests/received', query: PAGE_Q, message: 'الطلبات الواردة',
  response: [{ requestId: ID(40), user: BRIEF2, createdAt: '2026-11-11T08:00:00.000Z' }], pagination: PAG, errors: [[401, 'مفيش login']],
});
add(FR, {
  name: 'الطلبات اللي بعتها', desc: 'طلبات أنا بعتها ولسه pending.', method: 'GET', path: '/friends/requests/sent', query: PAGE_Q, message: 'الطلبات اللي بعتها',
  response: [{ requestId: ID(41), user: BRIEF2, createdAt: '2026-11-11T08:00:00.000Z' }], pagination: PAG, errors: [[401, 'مفيش login']],
});
add(FR, {
  name: 'أصدقاء يوزر تاني', desc: 'قايمة أصدقاء يوزر معين.', method: 'GET', path: '/users/:id/friends', vars: { id: 'userId' }, params: [f('id', 'string', true, '')], query: PAGE_Q,
  message: 'قايمة الأصدقاء', response: [BRIEF2], pagination: PAG, errors: [E400ID, [401, 'مفيش login'], [403, 'بروفايل مقفول وإنت مش صديقه'], [404, 'مش موجود أو في حظر']],
});
add(FR, {
  name: 'بحث عن مستخدمين', desc: 'بالاسم أو الـ username. بيستبعدني والمحذوفين وأي حد بينا حظر.', method: 'GET', path: '/users/search',
  query: [f('q', 'string', true, 'حرفين على الأقل (حتى 50)'), ...PAGE_Q], message: 'نتايج البحث',
  response: [{ ...BRIEF2, friendshipStatus: 'none', friendRequestId: null }], pagination: PAG,
  errors: [[400, 'كلمة البحث أقل من حرفين'], [401, 'مفيش login']],
  notes: ['`friendshipStatus` في كل نتيجة: `friend` | `request_sent` | `request_received` | `none`.', 'النتيجة بيانات مختصرة بس.'],
});

// ===================== Block & Report =====================
const BR = 'Block & Report';
add(BR, {
  name: 'حظر يوزر', desc: 'بيشيل الصداقة والطلبات وإشعاراتها. الحظر بيشتغل في الاتجاهين: كل واحد مبيشوفش التاني.', method: 'POST', path: '/blocks/:userId', vars: { userId: 'otherUserId' },
  params: [f('userId', 'string', true, '')], status: 201, message: 'تم حظر اليوزر', response: null,
  errors: [[400, 'حظر نفسك'], [401, 'مفيش login'], [404, 'اليوزر مش موجود'], [409, 'حاظره قبل كده']],
  notes: ['بعد الحظر: بروفايله بيرجع 404، ويختفي من البحث والفيد والقوايم والتعليقات والإشعارات. التعليقات القديمة متتمسحش، بتتخفي بس.'],
});
add(BR, {
  name: 'فك الحظر', desc: '', method: 'DELETE', path: '/blocks/:userId', vars: { userId: 'otherUserId' }, params: [f('userId', 'string', true, '')],
  message: 'تم فك الحظر', response: null, errors: [E400ID, [401, 'مفيش login'], [404, 'اليوزر ده مش محظور']],
});
add(BR, {
  name: 'قايمة المحظورين', desc: 'اللي أنا حظرتهم.', method: 'GET', path: '/blocks', query: PAGE_Q, message: 'قايمة المحظورين',
  response: [{ ...BRIEF2, blockedAt: '2026-11-12T09:00:00.000Z' }], pagination: PAG, errors: [[401, 'مفيش login']],
});
add(BR, {
  name: 'إبلاغ', desc: 'عن يوزر أو بوست أو تعليق.', method: 'POST', path: '/reports',
  body: [f('targetType', 'string', true, 'user | post | comment'), f('targetId', 'string', true, ''), f('reason', 'string', true, 'spam | harassment | hate_speech | violence | nudity | fake_account | other'), f('details', 'string', false, 'حتى 500 حرف')],
  example: { targetType: 'post', targetId: ID(10), reason: 'spam', details: 'إعلان مزعج' }, status: 201, message: 'تم إرسال البلاغ، شكرًا', response: { _id: ID(50), status: 'pending' },
  errors: [[400, 'مدخلات غلط / إبلاغ عن نفسك أو عن حاجة بتاعتك'], [401, 'مفيش login'], [403, 'بروفايل مقفول'], [404, 'الهدف مش موجود'], [409, 'بلّغت عن ده قبل كده']],
});

// ===================== Notifications =====================
const NT = 'Notifications';
add(NT, {
  name: 'قايمة إشعاراتي', desc: 'الأحدث الأول. فيها actor مختصر ونص عربي جاهز.', method: 'GET', path: '/notifications',
  query: [f('unread', 'boolean', false, '`true` للغير مقروء بس'), ...PAGE_Q], message: 'الإشعارات', pagination: PAG, tests: 'saveNotificationId',
  response: [{ _id: ID(60), type: 'comment_post', targetType: 'comment', targetId: ID(20), postId: ID(10), actor: BRIEF2, text: 'سارة أحمد علّق على بوستك', reaction: null, isRead: false, createdAt: '2026-11-10T12:05:00.000Z' }],
  errors: [[401, 'مفيش login']],
  notes: ['`reaction` بيبقى `{kind,type}` في إشعارات الريأكشن بس، وغير كده `null`.'],
});
add(NT, {
  name: 'عدد الغير مقروء', desc: 'للبادج.', method: 'GET', path: '/notifications/unread-count', response: { count: 3 }, errors: [[401, 'مفيش login']],
});
add(NT, {
  name: 'تعليم إشعار كمقروء', desc: 'صاحبه بس.', method: 'PATCH', path: '/notifications/:id/read', vars: { id: 'notificationId' }, params: [f('id', 'string', true, '')],
  message: 'تم تعليم الإشعار كمقروء', response: null, errors: [E400ID, [401, 'مفيش login'], [404, 'مش موجود']],
});
add(NT, {
  name: 'تعليم الكل كمقروء', desc: '', method: 'PATCH', path: '/notifications/read-all', message: 'تم تعليم كل الإشعارات كمقروءة', response: { updated: 3 }, errors: [[401, 'مفيش login']],
});
add(NT, {
  name: 'حذف إشعار', desc: 'صاحبه بس.', method: 'DELETE', path: '/notifications/:id', vars: { id: 'notificationId' }, params: [f('id', 'string', true, '')],
  message: 'تم حذف الإشعار', response: null, errors: [E400ID, [401, 'مفيش login'], [404, 'مش موجود']],
});

module.exports = { spec, ID };
