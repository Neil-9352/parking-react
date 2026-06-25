const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const router = express.Router();
const { login, logout, me, changePassword, register } = require('../controllers/auth.controller');
const verifyToken = require('../middleware/auth');

// Multer for the register endpoint – store in OS temp dir so the controller
// can rename the file to its final location once the lot_id is known.
const registerUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/register', registerUpload.single('layout_image'), register); // public – no token
router.post('/login', login);
router.post('/logout', verifyToken, logout);
router.get('/me', verifyToken, me);
router.post('/change-password', verifyToken, changePassword);

module.exports = router;
