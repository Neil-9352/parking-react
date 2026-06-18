const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { getSettings, updateLot, updateSlots, updateFees } = require('../controllers/settings.controller');
const verifyToken = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/layouts');
    const fs = require('fs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `Lot_${req.admin?.lot_id || 'x'}_layout_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.get('/', verifyToken, getSettings);
router.post('/lot', verifyToken, upload.single('layout_image'), updateLot);
router.post('/slots', verifyToken, updateSlots);
router.post('/fees', verifyToken, updateFees);

module.exports = router;
