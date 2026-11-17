const jwt = require('jsonwebtoken');

// بيعمل JWT فيه id اليوزر و tv (نسخة التوكن). لازم user.tokenVersion يكون متحمّل.
exports.signToken = (user) =>
  jwt.sign({ id: user._id, tv: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
