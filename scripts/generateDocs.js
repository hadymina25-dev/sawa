// بيولّد ENDPOINTS.md و Sawa.postman_collection.json من scripts/docs/spec.js
// التشغيل:  npm run docs
const fs = require('fs');
const path = require('path');
const { spec } = require('./docs/spec');
const { REACTION_TYPES, REPORT_REASONS } = require('../config/constants');

const ROOT = path.join(__dirname, '..');
const FOLDERS = ['Auth', 'Profile', 'Posts', 'Comments', 'Reactions', 'Friends', 'Block & Report', 'Notifications'];
const json = (v) => JSON.stringify(v, null, 2);

// شكل الرد الكامل لمثال
const envelope = (e) => {
  const out = { success: true, message: e.message || 'تمام', data: e.response === undefined ? null : e.response };
  if (e.pagination) out.pagination = e.pagination;
  if (e.summary) out.summary = e.summary;
  return out;
};

// ================= ENDPOINTS.md =================
const fieldTable = (rows) =>
  ['| الحقل | النوع | إجباري؟ | ملاحظات |', '|---|---|---|---|']
    .concat(rows.map((r) => `| \`${r.name}\` | ${r.type} | ${r.required ? 'أيوه' : 'لأ'} | ${r.desc || ''} |`))
    .join('\n');

const endpointMd = (e, n) => {
  const lines = [];
  lines.push(`### ${n}. ${e.name}`);
  if (e.desc) lines.push(e.desc);
  lines.push('');
  lines.push(`- **\`${e.method} /api${e.path}\`**`);
  lines.push(`- محتاج تسجيل دخول: **${e.auth ? 'أيوه (Bearer token)' : 'لأ'}**`);
  if (e.params.length) lines.push('\n**Params (في الـ URL):**\n\n' + fieldTable(e.params));
  if (e.query.length) lines.push('\n**Query:**\n\n' + fieldTable(e.query));
  if (e.body.length) lines.push('\n**Body (JSON):**\n\n' + fieldTable(e.body));
  if (e.form.length) lines.push('\n**Body (multipart/form-data):**\n\n' + fieldTable(e.form));
  if (e.example && !e.form.length) lines.push('\n**مثال Request:**\n\n```json\n' + json(e.example) + '\n```');
  if (e.form.length) lines.push('\n**مثال Request:** استخدم `FormData` وحط الحقول اللي فوق (الملفات بأسماء الحقول بالظبط).');
  lines.push(`\n**مثال Response ناجح (${e.status || 200}):**\n\n\`\`\`json\n${json(envelope(e))}\n\`\`\``);
  const errs = e.errors.map(([code, msg]) => `| ${code} | ${msg} |`);
  if (errs.length) lines.push('\n**الأخطاء المحتملة:**\n\n| الكود | السبب |\n|---|---|\n' + errs.join('\n'));
  if (e.notes.length) lines.push('\n**ملاحظات للفرونت:**\n\n' + e.notes.map((x) => `- ${x}`).join('\n'));
  return lines.join('\n');
};

const intro = `# Sawa API — دليل الفرونت إند

كل الـ endpoints تحت \`{baseUrl}/api\` (مثال محلي: \`http://localhost:5000/api\`).

## 1) شكل الرد الموحد

**نجاح:**
\`\`\`json
{ "success": true, "message": "تمام", "data": { } }
\`\`\`

**خطأ (دايمًا بالشكل ده، والـ HTTP status فيه الكود):**
\`\`\`json
{ "success": false, "message": "سبب الخطأ بالعربي" }
\`\`\`

أكواد الحالة: \`400\` مدخلات غلط (وده يشمل id مش صالح)، \`401\` مفيش login أو التوكن منتهي/اتبطل، \`403\` مش مسموح (بروفايل مقفول، أو بوست مش بتاعك)، \`404\` مش موجود (أو في حظر)، \`409\` تكرار/تعارض، \`429\` ريكوستات كتير، \`501\` ميزة لسه مش متفعّلة على السيرفر (جوجل)، \`503\` خدمة مش متظبطة (Cloudinary).

## 2) الـ Pagination

كل الـ lists بتقبل \`?page=1&limit=10\` (الافتراضي 1 و 10، والحد الأقصى لـ limit هو 50) والرد بيرجع بالشكل ده:
\`\`\`json
{
  "success": true,
  "message": "...",
  "data": [ ],
  "pagination": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 }
}
\`\`\`
(في \`GET /reactions\` بيجي كمان \`summary\` جنب \`pagination\`.)

## 3) إزاي الـ token بيتبعت

بعد register أو login خد \`data.token\` وابعته في كل ريكوست محتاج login:
\`\`\`
Authorization: Bearer <token>
\`\`\`
- لو رجع **401** على أي ريكوست: امسح التوكن وودّي اليوزر لشاشة الدخول.
- **اللوج أوت** و**تغيير الباسورد** و**إعادة تعيين الباسورد** بيبطّلوا التوكنات القديمة فعليًا. اللوج أوت بيطرد كل الأجهزة.
- بعد **تغيير الباسورد** الرد فيه توكن جديد، لازم تخزّنه بدل القديم.

## 4) الإشعارات والـ Push (Firebase)

**التسجيل:**
1. بعد كل تسجيل دخول خد توكن الجهاز من Firebase وابعته لـ \`POST /api/users/device-token\`. وابعته تاني كل ما FCM يجدد التوكن.
2. عند اللوج أوت ابعت \`deviceToken\` في body الـ \`POST /api/auth/logout\` (بيتمسح من السيرفر).

**شكل الـ push اللي بيوصل:**
- \`notification\`: \`{ title: "سوا", body: "<الاسم> علّق على بوستك" }\`
- \`data\` (كلها strings):
\`\`\`json
{ "type": "comment_post", "targetType": "comment", "targetId": "…", "postId": "…", "notificationId": "…" }
\`\`\`
(\`postId\` ممكن يبقى string فاضي لو الإشعار مش مرتبط ببوست.)

**الفرونت يفتح إيه لما اليوزر يدوس على الإشعار (حسب \`type\`):**

| type | بيحصل إمتى | يفتح إيه |
|---|---|---|
| \`reaction_post\` | حد عمل ريأكشن على بوستك | البوست \`targetId\` |
| \`reaction_comment\` | ريأكشن على تعليقك/ردك | البوست \`postId\` (وركّز على التعليق \`targetId\`) |
| \`comment_post\` | حد علّق على بوستك | البوست \`postId\` (التعليق \`targetId\`) |
| \`reply_comment\` | حد رد على تعليقك/ردك | البوست \`postId\` (الرد \`targetId\`) |
| \`friend_request\` | وصلك طلب صداقة | بروفايل اليوزر \`targetId\` (أو شاشة الطلبات) |
| \`friend_accepted\` | حد قبل طلبك | بروفايل اليوزر \`targetId\` |

- بعد ما اليوزر يفتح الإشعار علّمه مقروء: \`PATCH /api/notifications/:id/read\`.
- لو الـ push وصل واليوزر جوه التطبيق، حدّث عدّاد \`GET /api/notifications/unread-count\`.
- السيرفر **مبيبعتش إشعار** لنفسك ولا لمحظور، وريأكشن واحد على نفس الحاجة بيعمل إشعار واحد بس (تغيير نوع الريأكشن بيحدّث نفس الإشعار من غير push جديد).

## 5) الثوابت اللي الفرونت محتاجها

**أنواع الريأكشن** (لازم تبعت \`kind\` و\`type\` مع بعض، لأن \`sad\` موجودة في الاتنين):

| kind | الأنواع (type) |
|---|---|
| \`regular\` | ${REACTION_TYPES.regular.map((t) => `\`${t}\``).join(', ')} |
| \`sign\` (إشارة) | ${REACTION_TYPES.sign.map((t) => `\`${t}\``).join(', ')} |

**أسباب البلاغ** (\`reason\`): ${REPORT_REASONS.map((t) => `\`${t}\``).join(', ')}
**أنواع الهدف في البلاغ:** \`user\`, \`post\`, \`comment\` — **وفي الريأكشن:** \`post\`, \`comment\`

**حدود الرفع:** صور البوست لحد 10 (8MB للصورة) — فيديوهات البوست لحد 3 (50MB للفيديو) — فيديو التعليق 30MB — صورة البروفايل/الغلاف 5MB. الأنواع المسموحة: صور jpeg/png/webp/gif، فيديو mp4/mov/webm/3gp/mkv.

## 6) ملاحظات عامة

- **الحظر:** في الاتجاهين. اليوزر المحظور بيرجع **404** في أي مكان بيتفتح بالـ id، وبيختفي من القوايم والبحث.
- **البروفايل المقفول:** الغريب بيشوف بيانات مختصرة بس ومبيشوفش بوستات ولا أصدقاء (**403**). الأصدقاء وصاحب البروفايل بيشوفوا كل حاجة.
- **\`myReaction\`:** في كل بوست وتعليق: \`null\` لو معملتش ريأكشن، أو \`{ "kind": "regular", "type": "love" }\`.
- **الميديا:** بترجع \`{ "url": "...", "resourceType": "image" | "video" }\`.
- **العدادات:** \`reactionsCount\` و\`commentsCount\` (بوست: كل التعليقات والردود) و\`repliesCount\` (ردود التعليق المباشرة) جاهزة في الرد، متحسبهاش من عندك.
- الـ \`:id\` اللي مش صالح (مش 24 حرف hex) بيرجع **400**.

---
`;

let md = intro;
let counter = 1;
const toc = [];
const sections = FOLDERS.map((folder) => {
  const items = spec.filter((e) => e.folder === folder);
  toc.push(`- [${folder}](#${folder.toLowerCase().replace(/[ &]+/g, '-')}) (${items.length})`);
  return `## ${folder}\n\n` + items.map((e) => endpointMd(e, counter++)).join('\n\n---\n\n');
});
md += '## الفهرس\n\n' + toc.join('\n') + '\n\n---\n\n' + sections.join('\n\n---\n\n') + '\n';
fs.writeFileSync(path.join(ROOT, 'ENDPOINTS.md'), md);

// ================= Postman =================
const TESTS = {
  saveToken: [
    'const body = pm.response.json();',
    'if (body.success && body.data && body.data.token) {',
    '  pm.collectionVariables.set("token", body.data.token);',
    '  if (body.data.user) pm.collectionVariables.set("userId", body.data.user._id);',
    '}',
  ],
  savePostId: ['const body = pm.response.json();', 'if (body.success && body.data) pm.collectionVariables.set("postId", body.data._id);'],
  saveCommentId: ['const body = pm.response.json();', 'if (body.success && body.data) pm.collectionVariables.set("commentId", body.data._id);'],
  saveRequestId: ['const body = pm.response.json();', 'if (body.success && body.data) pm.collectionVariables.set("requestId", body.data.requestId);'],
  saveNotificationId: ['const body = pm.response.json();', 'if (body.success && body.data && body.data.length) pm.collectionVariables.set("notificationId", body.data[0]._id);'],
};

const sampleForForm = (f) => {
  if (f.type.startsWith('file')) return { key: f.name, type: 'file', src: [], description: f.desc };
  const sampleValues = { text: 'نص تجريبي', parentComment: '{{commentId}}' };
  return { key: f.name, type: 'text', value: sampleValues[f.name] || '', description: f.desc, disabled: f.name === 'parentComment' };
};

const buildRequest = (e) => {
  // بنبدّل :param بمتغير Postman حسب e.vars
  const segments = e.path.split('/').filter(Boolean).map((seg) => (seg.startsWith(':') ? `{{${e.vars[seg.slice(1)] || seg.slice(1)}}}` : seg));
  const pathSegments = ['api', ...segments];
  const queryParams = e.query.map((q) => {
    const defaults = { page: '1', limit: '10', q: 'hady', targetType: 'post', targetId: '{{postId}}', unread: 'false' };
    return { key: q.name, value: defaults[q.name] || '', description: q.desc, disabled: !q.required && !['page', 'limit'].includes(q.name) };
  });
  const rawQuery = queryParams.filter((q) => !q.disabled).map((q) => `${q.key}=${q.value}`).join('&');

  const req = {
    method: e.method,
    header: [],
    url: {
      raw: `{{baseUrl}}/${pathSegments.join('/')}${rawQuery ? `?${rawQuery}` : ''}`,
      host: ['{{baseUrl}}'],
      path: pathSegments,
      ...(queryParams.length ? { query: queryParams } : {}),
    },
    description: [e.desc, ...e.notes].filter(Boolean).join('\n\n'),
  };
  if (!e.auth) req.auth = { type: 'noauth' };

  if (e.form.length) {
    req.body = { mode: 'formdata', formdata: e.form.map(sampleForForm) };
  } else if (e.body.length && e.example) {
    req.header.push({ key: 'Content-Type', value: 'application/json' });
    req.body = { mode: 'raw', raw: json(e.example), options: { raw: { language: 'json' } } };
  }

  const item = { name: e.name, request: req, response: [] };
  if (TESTS[e.tests]) item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: TESTS[e.tests] } }];
  return item;
};

const collection = {
  info: {
    name: 'Sawa API',
    description: 'Sawa (سوا) backend. شغّل Register أو Login الأول والتوكن بيتحفظ أوتوماتيك في {{token}}. غيّر {{baseUrl}} لو السيرفر على عنوان تاني.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5000/api' },
    { key: 'token', value: '' },
    { key: 'userId', value: '' },
    { key: 'otherUserId', value: '' },
    { key: 'username', value: 'hady' },
    { key: 'postId', value: '' },
    { key: 'commentId', value: '' },
    { key: 'requestId', value: '' },
    { key: 'notificationId', value: '' },
  ],
  item: FOLDERS.map((folder) => ({ name: folder, item: spec.filter((e) => e.folder === folder).map(buildRequest) })),
};
// baseUrl فيه /api بالفعل، فنشيل 'api' من مسارات الـ requests
const strip = (node) => {
  if (node.request) {
    node.request.url.path = node.request.url.path.slice(1);
    node.request.url.raw = node.request.url.raw.replace('{{baseUrl}}/api/', '{{baseUrl}}/');
  }
  (node.item || []).forEach(strip);
};
collection.item.forEach(strip);

const out = json(collection);
JSON.parse(out); // تأكيد إن الملف JSON صالح
fs.writeFileSync(path.join(ROOT, 'Sawa.postman_collection.json'), out);

console.log(`✅ ENDPOINTS.md (${spec.length} endpoint) و Sawa.postman_collection.json اتولّدوا`);
