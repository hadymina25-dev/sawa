const express = require('express');
const reaction = require('../controllers/reactionController');
const protect = require('../middlewares/protect');

const router = express.Router();
router.use(protect);

router.route('/').get(reaction.listReactions).post(reaction.toggleReaction);

module.exports = router;
