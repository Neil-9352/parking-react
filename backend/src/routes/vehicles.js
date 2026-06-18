const express = require('express');
const router = express.Router();
const { getAvailableSlots, manualEntry, autoEntry, autoDelete } = require('../controllers/vehicles.controller');
const verifyToken = require('../middleware/auth');

router.get('/available-slots', verifyToken, getAvailableSlots);
router.post('/entry', verifyToken, manualEntry);
router.post('/auto-entry', verifyToken, autoEntry);
router.post('/auto-delete', verifyToken, autoDelete);

module.exports = router;
