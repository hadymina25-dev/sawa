const express = require('express');
const friend = require('../controllers/friendController');
const protect = require('../middlewares/protect');

const router = express.Router();
router.use(protect);

router.get('/', friend.getMyFriends);
router.get('/requests/received', friend.getReceivedRequests);
router.get('/requests/sent', friend.getSentRequests);

router.post('/requests/:requestId/accept', friend.acceptRequest);
router.post('/requests/:requestId/reject', friend.rejectRequest);
router.route('/requests/:userId').post(friend.sendRequest);
router.delete('/requests/:requestId', friend.cancelRequest);

router.delete('/:userId', friend.removeFriend);

module.exports = router;
