const mongoose = require('mongoose');

// بيوصّل بالداتابيز (MongoDB Atlas) باستخدام MONGO_URI من الـ .env
const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ اتوصلنا بالداتابيز: ${mongoose.connection.name}`);
};

module.exports = connectDB;
