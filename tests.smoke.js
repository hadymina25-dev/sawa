// tests/smoke.js — يجرب الـ API كله تلقائياً
// بيشتغل على Node 18+ من غير أي مكتبة (fetch جاهزة في Node)

const BASE = process.env.API_URL || 'http://localhost:5000/api';

// ===== عدّل المسارات هنا لو مختلفة عندك =====
const R = {
  register:   ['POST',   '/auth/register'],
  login:      ['POST',   '/auth/login'],
  me:         ['GET',    '/auth/me'],
  logout:     ['POST',   '/auth/logout'],
  updateMe:   ['PATCH',  '/users/me'],
  search:     ['GET',    '/users/search?q=:q'],
  friendReq:  ['POST',   '/friends/request/:id'],
  friendAcc:  ['POST',   '/friends/accept/:id'],
  createPost: ['POST',   '/posts'],
  feed:       ['GET',    '/posts/feed'],
  getPost:    ['GET',    '/posts/:id'],
  comment:    ['POST',   '/posts/:id/comments'],
  reply:      ['POST',   '/comments/:id/replies'],
  react:      ['POST',   '/posts/:id/reactions'],
  notifs:     ['GET',    '/notifications'],
  deletePost: ['DELETE', '/posts/:id'],
  deleteMe:   ['DELETE', '/users/me'],
};

const stamp = Date.now();
const mkUser = (tag) => ({
  name: `Test ${tag}`,
  username: `test_${tag}_${stamp}`,
  email: `test_${tag}_${stamp}@example.com`,
  password: 'Test@12345',
});

// ===== أدوات مساعدة =====
async function call([method, path], { body, token, params = {} } = {}) {
  const url = BASE + path.replace(/:(\w+)/g, (_, k) => encodeURIComponent(params[k]));
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// بيتأكد من الـ status ومن إن الـ JSON موحد
function expectRes(r, ...statuses) {
  if (!statuses.includes(r.status))
    throw new Error(`متوقع ${statuses.join('/')} وجه ${r.status}: ${JSON.stringify(r.json)}`);
  const j = r.json;
  if (!j || typeof j.success !== 'boolean' || typeof j.message !== 'string')
    throw new Error('الـ response مش بالشكل الموحد (success + message)');
  if (j.success !== (r.status < 400))
    throw new Error('قيمة success مش مطابقة للـ status');
  if (j.success && !('data' in j))
    throw new Error('الـ response الناجح مفيهوش data');
  return j.data;
}

const idOf = (d) => d?._id || d?.id || d?.user?._id || d?.post?._id || d?.comment?._id;
const tokenOf = (d) => d?.token || d?.accessToken;

let passed = 0, failed = 0;
async function step(name, fn) {
  try { await fn(); console.log(`✅ ${name}`); passed++; }
  catch (e) { console.log(`❌ ${name}\n   ↳ ${e.message}`); failed++; }
}

// ===== السيناريو =====
(async () => {
  console.log(`\n🔎 بجرب على: ${BASE}\n`);
  const A = mkUser('a'), B = mkUser('b');
  let tokenA, tokenB, idA, idB, postId, commentId;

  await step('تسجيل مستخدم A', async () => {
    const d = expectRes(await call(R.register, { body: A }), 201, 200);
    tokenA = tokenOf(d); idA = idOf(d);
  });
  await step('تسجيل مستخدم B', async () => {
    const d = expectRes(await call(R.register, { body: B }), 201, 200);
    tokenB = tokenOf(d); idB = idOf(d);
  });
  await step('تسجيل دخول A', async () => {
    const d = expectRes(await call(R.login, { body: { email: A.email, password: A.password } }), 200);
    tokenA = tokenOf(d) || tokenA; idA = idA || idOf(d);
  });
  await step('تسجيل دخول بباسورد غلط يترفض', async () => {
    expectRes(await call(R.login, { body: { email: A.email, password: 'wrong' } }), 400, 401);
  });
  await step('/me من غير توكن يترفض (401)', async () => {
    expectRes(await call(R.me), 401);
  });
  await step('/me بالتوكن يشتغل', async () => {
    expectRes(await call(R.me, { token: tokenA }), 200);
  });
  await step('تعديل البروفايل', async () => {
    expectRes(await call(R.updateMe, { token: tokenA, body: { name: 'Test A Edited' } }), 200);
  });
  await step('البحث عن مستخدم', async () => {
    expectRes(await call(R.search, { token: tokenA, params: { q: 'test_b' } }), 200);
  });
  await step('A يبعت طلب صداقة لـ B', async () => {
    expectRes(await call(R.friendReq, { token: tokenA, params: { id: idB } }), 200, 201);
  });
  await step('B يقبل الطلب', async () => {
    expectRes(await call(R.friendAcc, { token: tokenB, params: { id: idA } }), 200);
  });
  await step('A ينشر بوست', async () => {
    const d = expectRes(await call(R.createPost, {
      token: tokenA, body: { text: 'أول بوست تجريبي', visibility: 'friends' },
    }), 201, 200);
    postId = idOf(d);
    if (!postId) throw new Error('مش لاقي id البوست في الـ response');
  });
  await step('B يشوف البوست (صديق)', async () => {
    expectRes(await call(R.getPost, { token: tokenB, params: { id: postId } }), 200);
  });
  await step('الـ feed يرجع', async () => {
    expectRes(await call(R.feed, { token: tokenB }), 200);
  });
  await step('B يكتب كومنت', async () => {
    const d = expectRes(await call(R.comment, {
      token: tokenB, params: { id: postId }, body: { text: 'كومنت تجريبي' },
    }), 201, 200);
    commentId = idOf(d);
  });
  await step('A يرد على الكومنت', async () => {
    expectRes(await call(R.reply, {
      token: tokenA, params: { id: commentId }, body: { text: 'رد تجريبي' },
    }), 201, 200);
  });
  await step('B يعمل reaction', async () => {
    expectRes(await call(R.react, {
      token: tokenB, params: { id: postId }, body: { type: 'like' },
    }), 200, 201);
  });
  await step('A يشوف الإشعارات', async () => {
    expectRes(await call(R.notifs, { token: tokenA }), 200);
  });
  await step('B ميقدرش يمسح بوست A (403)', async () => {
    expectRes(await call(R.deletePost, { token: tokenB, params: { id: postId } }), 403, 404);
  });
  await step('A يمسح بوسته', async () => {
    expectRes(await call(R.deletePost, { token: tokenA, params: { id: postId } }), 200);
  });
  await step('logout لـ B', async () => {
    expectRes(await call(R.logout, { token: tokenB }), 200);
  });
  await step('توكن B القديم يتبطّل بعد logout (tokenVersion)', async () => {
    expectRes(await call(R.me, { token: tokenB }), 401);
  });

  // تنظيف: مسح حسابات التجربة من الداتابيز
  await step('تنظيف: مسح حساب A', async () => {
    expectRes(await call(R.deleteMe, { token: tokenA, body: { password: A.password } }), 200);
  });
  await step('تنظيف: مسح حساب B', async () => {
    const t = tokenOf(expectRes(await call(R.login, { body: { email: B.email, password: B.password } }), 200));
    expectRes(await call(R.deleteMe, { token: t, body: { password: B.password } }), 200);
  });

  console.log(`\n📊 النتيجة: ${passed} نجحت، ${failed} فشلت\n`);
  process.exit(failed ? 1 : 0);
})();