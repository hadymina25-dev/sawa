const express = require('express');
const notification = require('../controllers/notificationController');
const protect = require('../middlewares/protect');

const router = express.Router();
router.use(protect);

router.get('/', notification.getNotifications);
router.get('/unread-count', notification.getUnreadCount);
router.patch('/read-all', notification.markAllAsRead);
router.patch('/:id/read', notification.markAsRead);
router.delete('/:id', notification.deleteNotification);

module.exports = router;
