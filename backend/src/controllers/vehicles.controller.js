const pool = require('../db');
const axios = require('axios');
const https = require('https');
const { generateReceipt } = require('../utils/receipt');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const TYPE_MAP = {
  car: '4-wheeler',
  vehicle: '4-wheeler',
  '4-wheeler': '4-wheeler',
  bike: '2-wheeler',
  motorbike: '2-wheeler',
  '2-wheeler': '2-wheeler',
};

async function callAnpr(image_base64) {
  const anprUrl = process.env.ANPR_URL || 'https://localhost:8000/api/detect';
  const response = await axios.post(anprUrl, { image_base64 }, {
    httpsAgent,
    timeout: 20000,
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
}

// GET /api/vehicles/available-slots
async function getAvailableSlots(req, res) {
  const lot_id = req.admin.lot_id;
  try {
    const [slots] = await pool.query(
      `SELECT slot_no FROM parking_slot WHERE status = 'unoccupied' AND lot_id = ? ORDER BY slot_no`,
      [lot_id]
    );
    return res.status(200).json(slots);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch slots' });
  }
}

// POST /api/vehicles/entry  (manual)
async function manualEntry(req, res) {
  const lot_id = req.admin.lot_id;
  const { reg_number, vehicle_type, slot_no } = req.body;

  if (!reg_number || !vehicle_type || !slot_no) {
    return res.status(400).json({ error: 'Registration number, vehicle type and slot are required' });
  }

  const plate = reg_number.toUpperCase().trim();
  const in_time = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const conn = await pool.getConnection();
  try {
    // Check if already parked
    const [existing] = await pool.query(
      `SELECT 1 FROM parks_in WHERE registration_number = ? AND out_time IS NULL`,
      [plate]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Vehicle is already parked' });
    }

    await conn.beginTransaction();

    // Insert vehicle if not exists
    await conn.query(
      `INSERT IGNORE INTO vehicle (registration_number, type) VALUES (?, ?)`,
      [plate, vehicle_type]
    );

    // Get slot_id
    const [slotRows] = await conn.query(
      `SELECT slot_id FROM parking_slot WHERE slot_no = ? AND lot_id = ? AND status = 'unoccupied' FOR UPDATE`,
      [slot_no, lot_id]
    );
    if (slotRows.length === 0) {
      throw new Error('Invalid or unavailable slot selected');
    }
    const slot_id = slotRows[0].slot_id;

    // Get latest fee
    const [feeRows] = await conn.query(
      `SELECT fee_id FROM fee WHERE vehicle_type = ? ORDER BY created_at DESC LIMIT 1`,
      [vehicle_type]
    );
    if (feeRows.length === 0) {
      throw new Error('Fee configuration not found');
    }
    const fee_id = feeRows[0].fee_id;

    // Insert parks_in
    await conn.query(
      `INSERT INTO parks_in (registration_number, slot_id, lot_id, in_time, fee_id) VALUES (?, ?, ?, ?, ?)`,
      [plate, slot_id, lot_id, in_time, fee_id]
    );

    // Mark slot occupied
    await conn.query(
      `UPDATE parking_slot SET status = 'occupied' WHERE slot_id = ? AND lot_id = ?`,
      [slot_id, lot_id]
    );

    await conn.commit();
    return res.status(200).json({ message: 'Vehicle parked successfully', plate, slot_no });
  } catch (err) {
    await conn.rollback();
    console.error('Manual entry error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
}

// POST /api/vehicles/auto-entry
async function autoEntry(req, res) {
  const lot_id = req.admin.lot_id;
  const { image_base64 } = req.body;

  if (!image_base64) {
    return res.status(400).json({ error: 'No image provided' });
  }

  // Call ANPR
  let anprData;
  try {
    anprData = await callAnpr(image_base64);
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      return res.status(err.response.status).json({ error: err.response.data.error });
    }
    return res.status(502).json({ error: 'Recognition service error: ' + err.message });
  }

  if (!anprData || !anprData.plate || !anprData.type) {
    return res.status(422).json({ error: 'Recognition failed: no plate/type returned' });
  }

  const plate = anprData.plate.toUpperCase().trim();
  let vehicle_type = TYPE_MAP[anprData.type.toLowerCase().trim()] || '4-wheeler';
  const in_time = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const conn = await pool.getConnection();
  try {
    // Check already parked
    const [existing] = await pool.query(
      `SELECT 1 FROM parks_in WHERE registration_number = ? AND out_time IS NULL`,
      [plate]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Vehicle already parked' });
    }

    // Mark no-show bookings
    await pool.query(
      `UPDATE books SET booking_status = 'NO_SHOW', refund_status = 'NOT_APPLICABLE'
       WHERE registration_number = ? AND booking_status = 'ACTIVE'
       AND DATE_ADD(expected_start_time, INTERVAL 15 MINUTE) < NOW()`,
      [plate]
    );

    await conn.beginTransaction();

    // Insert vehicle
    await conn.query(`INSERT IGNORE INTO vehicle (registration_number, type) VALUES (?, ?)`, [plate, vehicle_type]);

    let booking_id = null, slot_id = null, slot_no = null;
    let entry_type = 'walk-in';
    let early_walkin = false, cancelled_booking_id = null, refund_amount = null;
    let displaced_booking_id = null;

    // Check for active booking in ±15 min window
    const [bookRows] = await conn.query(`
      SELECT b.booking_id, b.slot_id, ps.slot_no
      FROM books b
      JOIN parking_slot ps ON b.slot_id = ps.slot_id
      WHERE b.registration_number = ?
      AND b.booking_status = 'ACTIVE'
      AND NOW() BETWEEN DATE_SUB(b.expected_start_time, INTERVAL 15 MINUTE)
                    AND DATE_ADD(b.expected_start_time, INTERVAL 15 MINUTE)
      AND ps.lot_id = ?
      ORDER BY b.expected_start_time ASC
      LIMIT 1
      FOR UPDATE
    `, [plate, lot_id]);

    if (bookRows.length > 0) {
      booking_id = bookRows[0].booking_id;
      slot_id = bookRows[0].slot_id;
      slot_no = bookRows[0].slot_no;
      entry_type = 'booked';
      const [vtRows] = await conn.query(`SELECT type FROM vehicle WHERE registration_number = ? LIMIT 1`, [plate]);
      if (vtRows.length > 0 && vtRows[0].type) vehicle_type = vtRows[0].type;
    } else {
      // Check for early arrival (booking > 15 min away)
      const [earlyRows] = await conn.query(`
        SELECT b.booking_id, b.booking_amount
        FROM books b
        JOIN parking_slot ps ON b.slot_id = ps.slot_id
        WHERE b.registration_number = ?
        AND b.booking_status = 'ACTIVE'
        AND NOW() < DATE_SUB(b.expected_start_time, INTERVAL 15 MINUTE)
        AND ps.lot_id = ?
        ORDER BY b.expected_start_time ASC
        LIMIT 1
        FOR UPDATE
      `, [plate, lot_id]);

      if (earlyRows.length > 0) {
        cancelled_booking_id = earlyRows[0].booking_id;
        refund_amount = parseFloat((earlyRows[0].booking_amount * 0.90).toFixed(2));
        await conn.query(
          `UPDATE books SET booking_status = 'CANCELLED', refund_status = 'REFUNDED' WHERE booking_id = ?`,
          [cancelled_booking_id]
        );
        early_walkin = true;
      }

      // Phase 1: find unoccupied slot
      const [freeSlots] = await conn.query(
        `SELECT slot_id, slot_no FROM parking_slot WHERE lot_id = ? AND status = 'unoccupied' ORDER BY RAND() LIMIT 1 FOR UPDATE`,
        [lot_id]
      );

      if (freeSlots.length > 0) {
        slot_id = freeSlots[0].slot_id;
        slot_no = freeSlots[0].slot_no;
      } else {
        // Phase 2: booked slot with > 3h until start
        const [bookedSlots] = await conn.query(`
          SELECT ps.slot_id, ps.slot_no, b.booking_id, b.booking_amount
          FROM parking_slot ps
          JOIN books b ON b.slot_id = ps.slot_id
          WHERE ps.lot_id = ?
          AND ps.status = 'booked'
          AND b.booking_status = 'ACTIVE'
          AND b.expected_start_time > DATE_ADD(NOW(), INTERVAL 3 HOUR)
          ORDER BY b.expected_start_time DESC
          LIMIT 1
          FOR UPDATE
        `, [lot_id]);

        if (bookedSlots.length > 0) {
          slot_id = bookedSlots[0].slot_id;
          slot_no = bookedSlots[0].slot_no;
          displaced_booking_id = bookedSlots[0].booking_id;
          await conn.query(
            `UPDATE books SET booking_status = 'CANCELLED', refund_status = 'REFUNDED' WHERE booking_id = ?`,
            [displaced_booking_id]
          );
          entry_type = 'walkin_on_booked';
        } else {
          await conn.rollback();
          return res.status(409).json({ error: 'No available slots in this lot' });
        }
      }
    }

    // Get latest fee
    const [feeRows] = await conn.query(
      `SELECT fee_id FROM fee WHERE vehicle_type = ? ORDER BY created_at DESC LIMIT 1`,
      [vehicle_type]
    );
    if (feeRows.length === 0) {
      await conn.rollback();
      return res.status(500).json({ error: 'Fee configuration not found' });
    }
    const fee_id = feeRows[0].fee_id;

    // Insert parks_in
    await conn.query(
      `INSERT INTO parks_in (registration_number, slot_id, lot_id, in_time, fee_id) VALUES (?, ?, ?, ?, ?)`,
      [plate, slot_id, lot_id, in_time, fee_id]
    );

    // Mark slot occupied
    await conn.query(
      `UPDATE parking_slot SET status = 'occupied' WHERE slot_id = ? AND lot_id = ?`,
      [slot_id, lot_id]
    );

    await conn.commit();

    const response = { plate, type: vehicle_type, slot: slot_no, lot: lot_id, entry_type, early_walkin };
    if (booking_id) response.booking_id = booking_id;
    if (early_walkin) { response.cancelled_booking_id = cancelled_booking_id; response.refund_amount = refund_amount; }
    if (entry_type === 'walkin_on_booked' && displaced_booking_id) response.displaced_booking_id = displaced_booking_id;

    return res.status(200).json(response);
  } catch (err) {
    await conn.rollback();
    console.error('Auto entry error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
}

// POST /api/vehicles/auto-delete
async function autoDelete(req, res) {
  const lot_id = req.admin.lot_id;
  const { image_base64 } = req.body;

  if (!image_base64) {
    return res.status(400).json({ error: 'No image provided' });
  }

  let anprData;
  try {
    anprData = await callAnpr(image_base64);
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      return res.status(err.response.status).json({ error: err.response.data.error });
    }
    return res.status(502).json({ error: 'Recognition service error: ' + err.message });
  }

  if (!anprData || !anprData.plate) {
    return res.status(422).json({ error: 'Recognition failed' });
  }

  const plate = anprData.plate.toUpperCase().trim();
  const out_time = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Find active parking record in this lot
    const [records] = await conn.query(`
      SELECT pi.id, pi.slot_id, pi.in_time, pi.fee_id, s.slot_no
      FROM parks_in pi
      JOIN parking_slot s ON pi.slot_id = s.slot_id
      WHERE pi.registration_number = ?
      AND pi.out_time IS NULL
      AND s.lot_id = ?
      LIMIT 1
      FOR UPDATE
    `, [plate, lot_id]);

    if (records.length === 0) {
      await conn.rollback();
      return res.status(200).json({
        status: 'no_match',
        plate,
        message: 'No parked vehicle found in this lot',
      });
    }

    const { id: parks_in_id, slot_id, in_time, slot_no } = records[0];

    // Calculate fee
    const [feeRows] = await conn.query(`
      SELECT
        v.type,
        CEIL(TIMESTAMPDIFF(SECOND, pi.in_time, ?) / 60) AS minutes_parked,
        GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, pi.in_time, ?) / 3600)) AS hours_parked,
        f.first_hour_charge,
        f.rest_hour_charge,
        CASE
          WHEN GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, pi.in_time, ?) / 3600)) = 1
          THEN f.first_hour_charge
          ELSE f.first_hour_charge +
               (GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, pi.in_time, ?) / 3600)) - 1)
               * f.rest_hour_charge
        END AS parking_fee
      FROM parks_in pi
      JOIN vehicle v ON pi.registration_number = v.registration_number
      JOIN fee f ON pi.fee_id = f.fee_id
      WHERE pi.id = ?
      LIMIT 1
    `, [out_time, out_time, out_time, out_time, parks_in_id]);

    const feeData = feeRows[0];

    // Update parks_in
    await conn.query(
      'UPDATE parks_in SET out_time = ?, fee = ? WHERE id = ?',
      [out_time, feeData.parking_fee, parks_in_id]
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

    // Handle booking completion/refund
    let booking_id = null, booking_amount = null, refund_status = null;
    const [bookRows] = await conn.query(`
      SELECT booking_id, booking_amount FROM books
      WHERE registration_number = ? AND slot_id = ? AND booking_status = 'ACTIVE'
      LIMIT 1 FOR UPDATE
    `, [plate, slot_id]);

    if (bookRows.length > 0) {
      booking_id = bookRows[0].booking_id;
      booking_amount = bookRows[0].booking_amount;
      await conn.query(
        `UPDATE books SET booking_status = 'COMPLETED', refund_status = 'REFUNDED' WHERE booking_id = ?`,
        [booking_id]
      );
      refund_status = 'REFUNDED';
    }

    // Generate PDF receipt
    const receiptData = {
      plate,
      vehicleType: feeData.type,
      inTime: in_time,
      outTime: out_time,
      minutesParked: feeData.minutes_parked,
      hoursParked: feeData.hours_parked,
      firstHourCharge: feeData.first_hour_charge,
      restHourCharge: feeData.rest_hour_charge,
      parkingFee: feeData.parking_fee,
      bookingId: booking_id,
      bookingAmount: booking_amount,
      refundStatus: refund_status,
    };

    const { fileName, relativePath } = await generateReceipt(receiptData);
    await conn.query('UPDATE parks_in SET receipt_path = ? WHERE id = ?', [relativePath, parks_in_id]);

    await conn.commit();

    const response = {
      status: 'removed',
      plate,
      type: feeData.type,
      slot: slot_no,
      duration_hours: parseInt(feeData.hours_parked),
      charge: parseFloat(feeData.parking_fee),
      receipt_filename: fileName,
    };
    if (booking_id) {
      response.booking_id = booking_id;
      response.booking_amount = parseFloat(booking_amount);
      response.refund_status = refund_status;
    }
    return res.status(200).json(response);
  } catch (err) {
    await conn.rollback();
    console.error('Auto delete error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
}

module.exports = { getAvailableSlots, manualEntry, autoEntry, autoDelete };
