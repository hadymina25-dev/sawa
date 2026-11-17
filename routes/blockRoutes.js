const express = require('express');
const block = require('../controllers/blockController');
const protect = require('../middlewares/protect');

const router = express.Router();
router.use(protect);

router.get('/', block.getBlockedUsers);
router.route('/:userId').post(block.blockUser).delete(block.unblockUser);

module.exports = router;
