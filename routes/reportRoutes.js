const express = require('express');
const report = require('../controllers/reportController');
const protect = require('../middlewares/protect');

const router = express.Router();

router.route('/').post(protect, report.createReport);

module.exports = router;
