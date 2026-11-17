// كل حاجة تخص الـ username: الشكل، الكلمات المحجوزة، التوليد التلقائي.
const crypto = require('crypto');
const User = require('../models/User');
const { RESERVED_USERNAMES } = require('../config/constants');

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
exports.USERNAME_REGEX = USERNAME_REGEX;

// بيشيل @ من الأول ويحوّل lowercase
exports.normalizeUsername = (value) => String(value || '').trim().replace(/^@/, '').toLowerCase();

// بيرجّع null لو الشكل سليم، أو 'invalid' / 'reserved'
exports.checkUsernameFormat = (username) => {
  if (!USERNAME_REGEX.test(username)) return 'invalid';
  if (RESERVED_USERNAMES.includes(username)) return 'reserved';
  return null;
};

// هل الـ username متاخد؟ (exceptUserId عشان اليوزر يقدر يحفظ نفس اسمه الحالي)
exports.isUsernameTaken = async (username, exceptUserId = null) => {
  const filter = { username };
  if (exceptUserId) filter._id = { $ne: exceptUserId };
  return Boolean(await User.exists(filter));
};

// بيولّد username من نص (غالبًا بداية الإيميل) + أرقام عشوائية لو اتكرر
exports.generateUsername = async (seed) => {
  let base = String(seed || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14);
  if (base.length < 3) base = `user${base}`;

  const candidates = [base];
  for (let i = 0; i < 10; i += 1) {
    candidates.push(`${base}${crypto.randomInt(100, 100000)}`.slice(0, 20));
  }

  for (const candidate of candidates) {
    if (exports.checkUsernameFormat(candidate)) continue;
    if (!(await exports.isUsernameTaken(candidate))) return candidate;
  }
  // آخر حل: رقم طويل عشوائي
  return `user${crypto.randomBytes(6).toString('hex')}`.slice(0, 20);
};
