const express = require('express');
const post = require('../controllers/postController');
const comment = require('../controllers/commentController');
const protect = require('../middlewares/protect');
const { uploadPostMedia, uploadCommentVideo } = require('../middlewares/upload');

const router = express.Router();
router.use(protect);

// /feed قبل /:id عشان "feed" مايتفهمش كـ id
router.get('/feed', post.getFeed);
router.route('/').post(...uploadPostMedia, post.createPost);
router.route('/:id').get(post.getPost).patch(post.updatePost).delete(post.deletePost);

router
  .route('/:postId/comments')
  .get(comment.getPostComments)
  .post(uploadCommentVideo, comment.createComment);

module.exports = router;
