const express = require('express');
const router = express.Router();
const { login, logout, me, changePassword } = require('../controllers/auth.controller');
const verifyToken = require('../middleware/auth');

router.post('/login', login);
router.post('/logout', verifyToken, logout);
router.get('/me', verifyToken, me);
router.post('/change-password', verifyToken, changePassword);

module.exports = router;
