const express = require('express');
const router = express.Router();
const { getSlots, getBookings, removeVehicle } = require('../controllers/slots.controller');
const verifyToken = require('../middleware/auth');

router.get('/', verifyToken, getSlots);
router.get('/bookings', verifyToken, getBookings);
router.post('/remove/:slotId', verifyToken, removeVehicle);

module.exports = router;
