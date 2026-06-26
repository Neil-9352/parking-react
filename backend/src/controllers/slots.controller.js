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

// GET /api/slots/bookings?date=&reg_number=&vehicle_type=&booking_status=&refund_status=&from_date=&to_date=&page=&limit=
async function getBookings(req, res) {
  const lot_id = req.admin.lot_id;
  const {
    date,           // exact date (YYYY-MM-DD) – takes priority over from/to
    from_date,      // date range start
    to_date,        // date range end
    reg_number,     // partial match on registration plate
    vehicle_type,   // '2-wheeler' | '4-wheeler'
    booking_status, // ACTIVE | COMPLETED | CANCELLED | NO_SHOW
    refund_status,  // PENDING | REFUNDED | NOT_APPLICABLE
    page  = '1',
    limit = '10',
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset   = (pageNum - 1) * limitNum;

  try {
    const conditions = ['ps.lot_id = ?'];
    const params = [lot_id];

    const countConditions = ['ps.lot_id = ?'];
    const countParams = [lot_id];

    // Date filters
    if (date) {
      conditions.push('DATE(b.expected_start_time) = ?');
      params.push(date);
      countConditions.push('DATE(b.expected_start_time) = ?');
      countParams.push(date);
    } else {
      if (from_date) {
        conditions.push('DATE(b.expected_start_time) >= ?');
        params.push(from_date);
        countConditions.push('DATE(b.expected_start_time) >= ?');
        countParams.push(from_date);
      }
      if (to_date) {
        conditions.push('DATE(b.expected_start_time) <= ?');
        params.push(to_date);
        countConditions.push('DATE(b.expected_start_time) <= ?');
        countParams.push(to_date);
      }
    }

    // Text / enum filters
    if (reg_number) {
      const regLike = `%${reg_number.trim().toUpperCase()}%`;
      conditions.push('b.registration_number LIKE ?');
      params.push(regLike);
      countConditions.push('b.registration_number LIKE ?');
      countParams.push(regLike);
    }
    if (vehicle_type) {
      conditions.push('v.type = ?');
      params.push(vehicle_type);
      countConditions.push('v.type = ?');
      countParams.push(vehicle_type);
    }
    if (refund_status) {
      conditions.push('b.refund_status = ?');
      params.push(refund_status);
      countConditions.push('b.refund_status = ?');
      countParams.push(refund_status);
    }

    if (booking_status) {
      conditions.push('b.booking_status = ?');
      params.push(booking_status);
    }

    const whereClause = conditions.join(' AND ');
    const countWhereClause = countConditions.join(' AND ');

    // COUNT query – same WHERE, no LIMIT
    const [[{ total }]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM books b
      JOIN parking_slot ps ON b.slot_id = ps.slot_id
      LEFT JOIN vehicle v  ON v.registration_number = b.registration_number
      LEFT JOIN user u     ON u.user_id = b.user_id
      WHERE ${whereClause}
    `, params);

    // Status counts query (ignoring booking_status)
    const [statusCountsRows] = await pool.query(`
      SELECT b.booking_status, COUNT(*) AS count
      FROM books b
      JOIN parking_slot ps ON b.slot_id = ps.slot_id
      LEFT JOIN vehicle v  ON v.registration_number = b.registration_number
      LEFT JOIN user u     ON u.user_id = b.user_id
      WHERE ${countWhereClause}
      GROUP BY b.booking_status
    `, countParams);

    const counts = {
      ACTIVE: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      NO_SHOW: 0
    };
    statusCountsRows.forEach(row => {
      if (counts[row.booking_status] !== undefined) {
        counts[row.booking_status] = row.count;
      }
    });

    // Paginated data query
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
      WHERE ${whereClause}
      ORDER BY b.expected_start_time DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    return res.status(200).json({ bookings, total, page: pageNum, limit: limitNum, counts });
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
