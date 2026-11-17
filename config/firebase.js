// إعداد Firebase Cloud Messaging (الـ push). لو مفيش إعدادات: بيطبع تحذير مرة واحدة وبيتجاهل أي push.
const fs = require('fs');
const path = require('path');

let initialized = false;
let messaging = null;

// بيرجّع كائن الـ messaging لو Firebase متظبط، أو null لو لأ. بيتنفذ مرة واحدة بس.
const getFcm = () => {
  if (initialized) return messaging;
  initialized = true;

  try {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      serviceAccount = JSON.parse(fs.readFileSync(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH), 'utf8'));
    } else {
      console.warn('⚠️  FCM disabled: مفيش FIREBASE_SERVICE_ACCOUNT_PATH ولا FIREBASE_SERVICE_ACCOUNT_BASE64.');
      return null;
    }

    // الـ require جوه الدالة عشان السيرفر يقوم حتى لو Firebase مش متظبط
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    messaging = getMessaging(app);
    console.log('✅ Firebase FCM شغال');
  } catch (err) {
    console.warn(`⚠️  FCM disabled: ${err.message}`);
    messaging = null;
  }
  return messaging;
};

module.exports = { getFcm };
