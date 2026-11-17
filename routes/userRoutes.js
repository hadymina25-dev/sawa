const express = require('express');
const user = require('../controllers/userController');
const friend = require('../controllers/friendController');
const post = require('../controllers/postController');
const protect = require('../middlewares/protect');
const { uploadAvatar, uploadCover } = require('../middlewares/upload');

const router = express.Router();

// عام (من غير login): الفرونت بيسأل وهو بيكتب الـ username
router.get('/username-available/:username', user.usernameAvailable);

router.use(protect);

// الترتيب مهم: المسارات الثابتة قبل /:idOrUsername
router.get('/search', user.searchUsers);
router.patch('/me', user.updateProfile);
router.patch('/me/username', user.updateUsername);
router.put('/me/avatar', uploadAvatar, user.uploadAvatar);
router.put('/me/cover', uploadCover, user.uploadCover);
router.route('/device-token').post(user.registerDeviceToken).delete(user.removeDeviceToken);

router.get('/:id/posts', post.getUserPosts);
router.get('/:id/friends', friend.getUserFriends);
router.get('/:idOrUsername', user.getProfile);

module.exports = router;
