const express = require('express');
const router = express.Router();
const { getSlots, removeVehicle } = require('../controllers/slots.controller');
const verifyToken = require('../middleware/auth');

router.get('/', verifyToken, getSlots);
router.post('/remove/:slotId', verifyToken, removeVehicle);

module.exports = router;
