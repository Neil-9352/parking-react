const express = require('express');
const path = require('path');
const verifyToken = require('../middleware/auth');

const router = express.Router();

router.get('/:filename', verifyToken, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, '../../receipts', filename);
  res.download(filePath, filename, (err) => {
    if (err) res.status(404).json({ error: 'Receipt not found' });
  });
});

module.exports = router;
