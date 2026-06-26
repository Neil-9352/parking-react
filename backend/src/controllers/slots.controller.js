const pool = require('../db');
const { generateReceipt } = require('../utils/receipt');

// GET /api/slots
async function getSlots(req, res) {
  const lot_id = req.admin.lot_id;
  try {
    const [slots] = await pool.query(`
      SELECT 
        ps.slot_id,
        ps.slot_no,
        ps.status,
        v.registration_number,
        v.type,
        pi.in_time,
        b.booking_id,
        b.registration_number  AS booked_reg,
        b.expected_start_time,
        b.expected_end_time,
        bv.type                AS booked_type
      FROM parking_slot ps
      LEFT JOIN parks_in pi 
        ON ps.slot_id = pi.slot_id 
        AND pi.out_time IS NULL
      LEFT JOIN vehicle v 
        ON pi.registration_number = v.registration_number
      LEFT JOIN books b
        ON  b.slot_id        = ps.slot_id
        AND b.booking_status = 'ACTIVE'
        AND b.expected_end_time > NOW()
        AND DATE(b.expected_start_time) = CURDATE()
        AND b.booking_id = (
            SELECT b2.booking_id
            FROM   books b2
            WHERE  b2.slot_id        = ps.slot_id
            AND    b2.booking_status = 'ACTIVE'
            AND    b2.expected_end_time > NOW()
            AND    DATE(b2.expected_start_time) = CURDATE()
            ORDER  BY b2.expected_start_time ASC, b2.booking_id ASC
            LIMIT  1
        )
      LEFT JOIN vehicle bv
        ON bv.registration_number = b.registration_number
      WHERE ps.lot_id = ?
      ORDER BY ps.slot_no
    `, [lot_id]);

    return res.status(200).json(slots);
  } catch (err) {
    console.error('Get slots error:', err);
    return res.status(500).json({ error: 'Failed to fetch slots' });
  }
}

// GET /api/slots/bookings?date=YYYY-MM-DD
async function getBookings(req, res) {
  const lot_id = req.admin.lot_id;
  const { date } = req.query; // optional date filter, e.g. '2026-06-26'

  try {
    // Build optional date condition
    const dateCondition = date
      ? `AND DATE(b.expected_start_time) = ?`
      : '';
    const params = date ? [lot_id, date] : [lot_id];

    const [bookings] = await pool.query(`
      SELECT
        b.booking_id,
        b.registration_number,
        v.type        AS vehicle_type,
        ps.slot_no,
        b.expected_start_time,
        b.expected_end_time,
        b.booking_status,
        b.booking_amount,
        b.refund_status,
        b.refund_percentage,
        b.refund_amount,
        b.cancellation_time,
        u.name        AS user_name,
        u.phone       AS user_phone
      FROM books b
      JOIN parking_slot ps ON b.slot_id = ps.slot_id
      LEFT JOIN vehicle v  ON v.registration_number = b.registration_number
      LEFT JOIN user u     ON u.user_id = b.user_id
      WHERE ps.lot_id = ?
      ${dateCondition}
      ORDER BY b.expected_start_time DESC
    `, params);

    return res.status(200).json(bookings);
  } catch (err) {
    console.error('Get bookings error:', err);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
}

// POST /api/slots/remove/:slotId
async function removeVehicle(req, res) {
  const lot_id = req.admin.lot_id;
  const slot_id = parseInt(req.params.slotId);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Validate slot belongs to this lot
    const [slotCheck] = await conn.query(
      'SELECT slot_id FROM parking_slot WHERE slot_id = ? AND lot_id = ? FOR UPDATE',
      [slot_id, lot_id]
    );
    if (slotCheck.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid slot for this parking lot' });
    }

    // Fetch active parking record + calculate fee
    const [records] = await conn.query(`
      SELECT 
        pi.id,
        pi.registration_number,
        v.type,
        pi.in_time,
        TIMESTAMPDIFF(MINUTE, pi.in_time, NOW()) AS minutes_parked,
        GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, pi.in_time, NOW()) / 3600)) AS hours_parked,
        f.first_hour_charge,
        f.rest_hour_charge,
        NOW() AS out_time,
        CASE 
          WHEN GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, pi.in_time, NOW()) / 3600)) = 1
          THEN f.first_hour_charge
          ELSE f.first_hour_charge +
               (GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, pi.in_time, NOW()) / 3600)) - 1)
               * f.rest_hour_charge
        END AS parking_fee
      FROM parks_in pi
      JOIN vehicle v ON pi.registration_number = v.registration_number
      JOIN fee f ON pi.fee_id = f.fee_id
      WHERE pi.slot_id = ? AND pi.out_time IS NULL
      LIMIT 1
    `, [slot_id]);

    if (records.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'No vehicle currently parked in this slot' });
    }

    const rec = records[0];

    // Update parks_in using NOW() to stay consistent with DB timezone
    await conn.query(
      'UPDATE parks_in SET out_time = NOW(), fee = ? WHERE id = ?',
      [rec.parking_fee, rec.id]
    );

    // Smart slot restoration
    const [futureBooking] = await conn.query(
      `SELECT 1 FROM books WHERE slot_id = ? AND booking_status = 'ACTIVE' AND expected_end_time > NOW() LIMIT 1`,
      [slot_id]
    );
    const restoreStatus = futureBooking.length > 0 ? 'booked' : 'unoccupied';
    await conn.query(
      'UPDATE parking_slot SET status = ? WHERE slot_id = ? AND lot_id = ?',
      [restoreStatus, slot_id, lot_id]
    );

    // Generate PDF receipt
    const receiptData = {
      plate: rec.registration_number,
      vehicleType: rec.type,
      inTime: rec.in_time,
      outTime: rec.out_time,
      minutesParked: rec.minutes_parked,
      hoursParked: rec.hours_parked,
      firstHourCharge: rec.first_hour_charge,
      restHourCharge: rec.rest_hour_charge,
      parkingFee: rec.parking_fee,
    };

    const { fileName, relativePath } = await generateReceipt(receiptData);

    // Save receipt path
    await conn.query(
      'UPDATE parks_in SET receipt_path = ? WHERE id = ?',
      [relativePath, rec.id]
    );

    await conn.commit();

    return res.status(200).json({
      message: 'Vehicle removed successfully',
      registration_number: rec.registration_number,
      vehicle_type: rec.type,
      hours_parked: rec.hours_parked,
      fee: parseFloat(rec.parking_fee),
      receipt_filename: fileName,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Remove vehicle error:', err);
    return res.status(500).json({ error: 'Failed to remove vehicle: ' + err.message });
  } finally {
    conn.release();
  }
}

module.exports = { getSlots, getBookings, removeVehicle };
