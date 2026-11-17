# PROGRESS — Sawa Backend

آخر تحديث: بعد المرحلة 9 (كل المراحل من 0 لـ 9 اتنفذت في مرة واحدة بطلب منك).

## ⚠️ لازم تعرف الأول

**المشروع ده اتبنى من الصفر**، مش فوق مشروعك الحالي. المرحلة 0 كانت بتقول "اقرا المشروع الموجود الأول"، بس الكود الموجود على جهازك مكانش عندي، فمقدرتش أقراه. يعني:
- لو هتستخدمه على داتابيز جديدة: مفيش مشكلة.
- لو هتشغله على الداتابيز `sawa` القديمة على Atlas: ممكن تحصل تعارضات (أسماء حقول مختلفة زي `passwordHash`، أو indexes متعارضة). الأسلم تجرّب أول مرة على داتابيز جديدة (غيّر الاسم في `MONGO_URI`).
- **ملحوظة مهمة:** الكود ده **متجربش فعليًا** على داتابيز ولا Cloudinary ولا Firebase (شوف "مش متجرب" تحت). لازم نجرب سوا.

## اتعمل

الجدول ده متولّد من `scripts/docs/spec.js` وبيطابق الكود بالظبط (اتأكدت بسكريبت إن كل route في الكود موجود هنا والعكس). الـ URLs كلها تحت `/api`.

{{ENDPOINTS_TABLE}}

وكمان:
- `GET /api/health` (عام): بيتأكد إن السيرفر شغال.
- `scripts/backfillUsernames.js`: ولّد username للمستخدمين القدام (`npm run backfill:usernames`).
- `scripts/migratePostMedia.js`: حوّل ميديا البوستات القديمة لشكل `{url, publicId, resourceType}` (`DRY=1 npm run migrate:post-media` تجربة من غير تعديل).
- `scripts/generateDocs.js`: بيولّد `ENDPOINTS.md` و`Sawa.postman_collection.json` (`npm run docs`).

## قرارات

**اتخذتها أنا بنفسي (غيّرها لو مش عاجباك):**

1. **بنيت من الصفر** (شوف فوق). الهيكل زي `CLAUDE.md`: `config / controllers / models / routes / middlewares / utils` في الروت، CommonJS، وتعليق عامي فوق كل function.
2. **الـ validation يدوي** (`utils/validate.js`) من غير Joi ولا express-validator، لأن `CLAUDE.md` بيقول اسألك قبل ما أضيف مكتبة، وكنت شغال من غير ما أسألك. لو عايز Joi قولي.
3. **مكتبتين زيادة عن المسموح بيهم:** `google-auth-library` (ضرورية للتحقق من Google ID token بشكل آمن، وبتتحمّل بس وقت استخدام /auth/google) و`cors` (الفرونت React Native/ويب هيحتاجها، وكانت في الكورس). و`dotenv` و`bcryptjs` و`jsonwebtoken` و`mongoose` و`express` أساسيين.
4. **Express 4 (مش 5)** عشان يطابق الكورس. الكود شغال على الاتنين.
5. **الباسورد القديم الغلط في change-password وحذف الحساب بيرجع 400 مش 401**، عشان الفرونت (اللي غالبًا بيعامل 401 كـ "الجلسة خلصت") ميطردش اليوزر بالغلط.
6. **اللوج أوت بيطرد كل الأجهزة** (لأنه بيزوّد `tokenVersion` زي ما اتفقنا). ولو deviceToken اتبعت بيتمسح الجهاز ده بس.
7. **forgot-password:** لو اتطلب كود تاني قبل 60 ثانية، السيرفر بيتجاهل بهدوء ويرجّع نفس الرد (عشان منكشفش إن الإيميل موجود). الفرونت يقفل زرار "إعادة الإرسال" 60 ثانية.
8. **reset-password** في ريكوست واحد (email + otp + newPassword) من غير خطوة verify-otp منفصلة (زي ما قررت قبل كده). الـ OTP متخزن HMAC-hashed مش plain.
9. **الـ OTP في التيرمنال:** لو `EMAIL_USER/EMAIL_PASS` مش متظبطين والـ `NODE_ENV` مش production، الكود بيتطبع في التيرمنال. ده السر الوحيد اللي بيتطبع عمدًا.
10. **الـ username:** unique index جزئي (بس على اللي عنده username) عشان المستخدمين القدام من غير username مايتعارضوش. الكلمات المحجوزة في `config/constants.js`.
11. **الأصدقاء:** رفض/إلغاء/إزالة = حذف الـ document (مش status). `pairKey` unique بيمنع الطلب المكرر والمتعاكس. الـ endpoints بتشتغل بـ `requestId` للقبول/الرفض/الإلغاء، وبـ `userId` للإرسال والإزالة.
12. **البروفايل بيرجّع `friendshipStatus` و`friendRequestId`.** لبروفايلي أنا بيرجع `friendshipStatus: "self"`. وللبروفايل المقفول (للغريب) ضفت `friendshipStatus` و`friendRequestId` جنب الحقول المختصرة، عشان الفرونت يعرض زرار "إضافة صديق".
13. **الحظر:** التعليقات والريأكشنز القديمة متتمسحش، بتتخفي من القوايم (`$nin` على المحظورين). `repliesCount` و`commentsCount` بيفضلوا شاملين المخفي. الحظر بيمسح الصداقة وإشعارات الصداقة بس.
14. **البلاغات:** بتتحفظ بس ومفيش endpoint أدمن. البلاغات اللي على يوزر بتفضل بعد ما يمسح حسابه (بلاغاته هو بتتمسح).
15. **التعليق:** مفيش حد أقصى لعمق الردود. صاحب التعليق بس هو اللي يعدّل/يمسح (صاحب البوست مش بيقدر يمسح تعليقات الناس). `deletedCount` بيرجع في رد الحذف.
16. **قايمة الريأكشن `sign`:** `love_you, sad, strongly_agree, thank_you, please, hello, sorry, congrats`. و`regular`: `like, love, haha, wow, sad, angry`. عدّلهم من `config/constants.js` (سطور `REACTION_TYPES`). `sad` في القايمتين فلازم `kind` + `type` مع بعض.
17. **إشعار الريأكشن:** واحد لكل (recipient, actor, type, target) بـ `dedupeKey` unique. تغيير نوع الريأكشن بيحدّث `reaction` في نفس الإشعار من غير push جديد. شيل الريأكشن بيمسح الإشعار. (لو اليوزر عمل/شال/عمل تاني هيوصل push تاني.)
18. **حدود الرفع:** صور البوست 10 × 8MB، فيديو البوست 3 × 50MB، فيديو التعليق 30MB، صورة البروفايل/الغلاف 5MB. الرفع في الذاكرة (multer memoryStorage) فالاستضافة المجانية الصغيرة ممكن تتعب مع فيديوهات كبيرة كتير مع بعض.
19. **حذف الحساب:** البوستات بتتمسح **hard** (مش soft) عشان "مفيش أي أثر". لحساب جوجل من غير باسورد: مطلوب `idToken` جديد (الافتراضي اللي قلته).
20. **الحذف المتسلسل من غير transactions** (عشان يشتغل على أي داتابيز). مرتب من الأعمق للأعلى، وتقدر تشغله تاني لو وقف. الفرق الوحيد: لو السيرفر وقع في نص حذف ريأكشنز يوزر، ممكن عداد أو اتنين يفضلوا أعلى بواحد (مبنزلش تحت صفر أبدًا).
21. **Rate limit:** login وgoogle (10 كل 15 د)، register (20 كل ساعة)، forgot (5 كل 15 د)، reset (10 كل 15 د). الحدود في `middlewares/rateLimiters.js`. بيخزّن في الذاكرة فبيتصفّر لما السيرفر يعيد التشغيل.
22. **`GET /users/:idOrUsername`** بيقبل id أو username أو `me`.
23. **البحث:** contains + case-insensitive على الاسم والـ username (من غير text index)، كافي لحجم مشروع التخرج.

## محتاج مني أظبطه

اعمل `npm install` الأول، وبعدين انسخ `.env.example` لـ `.env` واملاه:

| المتغير | إيه ده وإزاي أجيبه |
|---|---|
| `MONGO_URI` | من Atlas: Connect ← Drivers. **جرّب على داتابيز جديدة أول مرة** (غيّر اسمها في الرابط). وتأكد إن Network Access فيه IP بتاعك. |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` وحط الناتج. |
| `CLOUDINARY_*` | من Cloudinary Dashboard: cloud name و API key و API secret. من غيرهم رفع الصور/الفيديوهات بيرجع 503. |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail + **App Password** (مش باسورد الحساب): Google Account ← Security ← 2-Step Verification ← App passwords. من غيرهم الكود بيتطبع في التيرمنال. |
| `GOOGLE_CLIENT_ID` | من صاحبك الفرونت (Google Cloud Console ← Credentials ← OAuth client). ممكن أكتر من واحد بفاصلة (web, android, ios). من غيره `/auth/google` بيرجع 501. |
| Firebase | شوف تحت. |

**Firebase (الـ push):**
1. Firebase Console ← مشروعك ← ⚙️ Project settings ← **Service accounts** ← **Generate new private key** ← بينزل ملف JSON.
2. على جهازك: حط الملف برا الـ git (مثلًا `firebase-service-account.json` في روت المشروع، وهو متتجاهل في `.gitignore`) وحط في `.env`: `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`.
3. على الاستضافة (Render): حوّل الملف Base64 (`base64 -w 0 file.json` على لينكس/ماك، أو PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("file.json"))`) وحطه في `FIREBASE_SERVICE_ACCOUNT_BASE64`.
4. السيرفر بيطبع `✅ Firebase FCM شغال` أو `FCM disabled` وقت التشغيل.
5. **لتجربة إن الـ push وصل:** صاحبك الفرونت يسجّل توكن جهازه بـ `POST /users/device-token` (بحساب A)، وإنت من حساب B تبعتله طلب صداقة أو تعلق على بوست حساب A (من Postman). المفروض الإشعار يوصل على الموبايل. (لو مش جاهز الفرونت: Firebase Console ← Messaging ← Send test message بتوكن الجهاز بيتأكد بس إن الجهاز نفسه بيستقبل.)

**لو عندك داتابيز قديمة فيها يوزرز وبوستات:**
- `npm run backfill:usernames` (يولّد username للقدام).
- `DRY=1 npm run migrate:post-media` ثم `npm run migrate:post-media` (يحوّل شكل الميديا).
- اعمل backup الأول.

## مش متجرب

**كل حاجة لسه مجربتش تشتغل فعليًا.** بيئتي اللي بنيت فيها مفيهاش إنترنت ولا MongoDB، فمعرفتش أعمل `npm install` ولا أشغّل السيرفر. اللي اتأكدت منه فعلًا:
- ✅ كل الـ 58 ملف JS من غير أخطاء syntax.
- ✅ التطبيق بيتحمّل كامل (كل require والـ routes وكل handler دالة موجودة) باختبار بمكتبات وهمية.
- ✅ قايمة الـ routes في الكود = قايمة التوثيق بالظبط (49 endpoint).
- ✅ الدوال المساعدة البسيطة (pagination، username، validate، thumbnail، استخراج publicId).
- ✅ `Sawa.postman_collection.json` JSON صالح.

**مش متجرب (لازم نجرب سوا بالترتيب ده):**
1. **قيام السيرفر + الاتصال بـ Atlas** وبناء الـ indexes.
2. **Auth:** register ← login ← me ← logout (والتأكد إن التوكن القديم بقى 401) ← forgot ← reset ← change-password. وrate limit.
3. **Google login** (محتاج GOOGLE_CLIENT_ID وتوكن حقيقي).
4. **البروفايل:** تعديل، username (متاح/متكرر/محجوز)، رفع صورة وتغييرها (والتأكد إن القديمة اتمسحت من Cloudinary)، قفل البروفايل وعرضه من يوزر تاني.
5. **الأصدقاء والبحث والحظر** بـ 3 يوزرز.
6. **البوستات:** نص، صور، فيديو، خليط، حدود الحجم، الفيد، بروفايل مقفول (403)، تعديل وحذف (ومسح الميديا من Cloudinary).
7. **التعليقات:** شجرة ردود 5 مستويات، حذف في النص والعدادات.
8. **الريأكشنز:** toggle كامل (جديد/تغيير/إزالة) وسباق ريكوستين مع بعض.
9. **الإشعارات:** كل نوع، لنفسي ولمحظور، والسيرفر من غير Firebase (مبيقعش)، وبـ Firebase (push حقيقي).
10. **حذف الحساب:** سيناريو كامل (يوزر عنده بوستات وتعليقات وردود وريأكشنز وصداقات وحظر وإشعارات) وبعدين التأكد إن مفيش أي أثر ليه في أي collection، وإن عدادات الباقيين صح، وإن Cloudinary اتنضف.
- **الأمثلة في `ENDPOINTS.md`** مكتوبة من قراءة الكود، مش من ريكوستات حقيقية، فقارنها بالردود الفعلية أول ما نجرب.
- **الـ transactions:** مش مستخدمة (الحذف بخطوات مرتبة).
- **أداء الأحمال الكبيرة:** مش متجرب ومش هدف دلوقتي.
