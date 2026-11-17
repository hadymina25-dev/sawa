// تجميع الـ Express app: الميدل وير العامة، الراوتس، الـ 404، ومعالج الأخطاء.
const express = require('express');
const cors = require('cors');

const AppError = require('./utils/appError');
const errorHandler = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const friendRoutes = require('./routes/friendRoutes');
const blockRoutes = require('./routes/blockRoutes');
const reportRoutes = require('./routes/reportRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const reactionRoutes = require('./routes/reactionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// ورا proxy (زي Render) عشان الـ rate limit يشوف الـ IP الحقيقي
app.set('trust proxy', 1);

const origins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : true;
app.use(cors({ origin: origins }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'السيرفر شغال', data: { uptime: process.uptime() } });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/notifications', notificationRoutes);

// أي مسار مش معروف
app.use((req, res, next) => {
  next(new AppError(`المسار ${req.originalUrl} مش موجود`, 404));
});

app.use(errorHandler);

module.exports = app;
