const express = require('express');
const router = express.Router();
const { getReports } = require('../controllers/reports.controller');
const verifyToken = require('../middleware/auth');

router.get('/', verifyToken, getReports);

module.exports = router;
