const express = require('express');
const comment = require('../controllers/commentController');
const protect = require('../middlewares/protect');

const router = express.Router();
router.use(protect);

router.get('/:id/replies', comment.getReplies);
router.route('/:id').patch(comment.updateComment).delete(comment.deleteComment);

module.exports = router;
