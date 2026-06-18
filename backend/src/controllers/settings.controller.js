const pool = require('../db');
const path = require('path');
const fs = require('fs');

// GET /api/settings
async function getSettings(req, res) {
  const lot_id = req.admin.lot_id;
  try {
    const [slotCount] = await pool.query(
      'SELECT COUNT(*) AS total FROM parking_slot WHERE lot_id = ?',
      [lot_id]
    );
    const [lotRows] = await pool.query(
      'SELECT lot_name, address, layout_image_path FROM parking_lot WHERE lot_id = ?',
      [lot_id]
    );
    const [feeRows] = await pool.query('SELECT * FROM fee WHERE lot_id = ?', [lot_id]);

    const fee_data = {
      '2-wheeler': { first_hour: 0, next_hour: 0 },
      '4-wheeler': { first_hour: 0, next_hour: 0 },
    };
    feeRows.forEach(row => {
      fee_data[row.vehicle_type] = {
        first_hour: parseFloat(row.first_hour_charge),
        next_hour: parseFloat(row.rest_hour_charge),
      };
    });

    return res.status(200).json({
      slot_count: parseInt(slotCount[0].total),
      lot_name: lotRows[0]?.lot_name || '',
      address: lotRows[0]?.address || '',
      layout_image: lotRows[0]?.layout_image_path || null,
      fees: fee_data,
    });
  } catch (err) {
    console.error('Get settings error:', err);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
}

// POST /api/settings/lot
async function updateLot(req, res) {
  const lot_id = req.admin.lot_id;
  const { lot_name, address } = req.body;

  if (!lot_name || !address) {
    return res.status(400).json({ error: 'Lot name and address are required' });
  }

  try {
    let imagePath = null;
    if (req.file) {
      imagePath = 'uploads/layouts/' + req.file.filename;
      await pool.query(
        'UPDATE parking_lot SET lot_name = ?, address = ?, layout_image_path = ? WHERE lot_id = ?',
        [lot_name, address, imagePath, lot_id]
      );
    } else {
      await pool.query(
        'UPDATE parking_lot SET lot_name = ?, address = ? WHERE lot_id = ?',
        [lot_name, address, lot_id]
      );
    }
    return res.status(200).json({ message: 'Parking lot details updated successfully' });
  } catch (err) {
    console.error('Update lot error:', err);
    return res.status(500).json({ error: 'Failed to update lot details' });
  }
}

// POST /api/settings/slots
async function updateSlots(req, res) {
  const lot_id = req.admin.lot_id;
  const total_slots = parseInt(req.body.total_slots);

  if (!total_slots || total_slots < 1) {
    return res.status(400).json({ error: 'Total slots must be at least 1' });
  }

  const conn = await pool.getConnection();
  try {
    const [countRows] = await conn.query(
      'SELECT COUNT(*) AS total FROM parking_slot WHERE lot_id = ?',
      [lot_id]
    );
    const current = parseInt(countRows[0].total);

    if (total_slots > current) {
      const toAdd = total_slots - current;
      for (let i = 1; i <= toAdd; i++) {
        await conn.query(
          `INSERT INTO parking_slot (slot_no, status, lot_id) VALUES (?, 'unoccupied', ?)`,
          [current + i, lot_id]
        );
      }
      return res.status(200).json({ message: `${toAdd} new slots added` });
    } else if (total_slots < current) {
      const toRemove = current - total_slots;
      await conn.query(
        `DELETE FROM parking_slot WHERE lot_id = ? ORDER BY slot_no DESC LIMIT ${toRemove}`,
        [lot_id]
      );
      return res.status(200).json({ message: `${toRemove} slots removed` });
    } else {
      return res.status(200).json({ message: 'Slot count is already correct' });
    }
  } catch (err) {
    console.error('Update slots error:', err);
    return res.status(500).json({ error: 'Failed to update slots' });
  } finally {
    conn.release();
  }
}

// POST /api/settings/fees
async function updateFees(req, res) {
  const lot_id = req.admin.lot_id;
  const { fee_2w_first, fee_2w_next, fee_4w_first, fee_4w_next } = req.body;

  const fees = [
    { type: '2-wheeler', first: parseFloat(fee_2w_first), next: parseFloat(fee_2w_next) },
    { type: '4-wheeler', first: parseFloat(fee_4w_first), next: parseFloat(fee_4w_next) },
  ];

  try {
    for (const fee of fees) {
      await pool.query(`
        INSERT INTO fee (lot_id, vehicle_type, first_hour_charge, rest_hour_charge)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE first_hour_charge = VALUES(first_hour_charge), rest_hour_charge = VALUES(rest_hour_charge)
      `, [lot_id, fee.type, fee.first, fee.next]);
    }
    return res.status(200).json({ message: 'Fee settings updated successfully' });
  } catch (err) {
    console.error('Update fees error:', err);
    return res.status(500).json({ error: 'Failed to update fees' });
  }
}

module.exports = { getSettings, updateLot, updateSlots, updateFees };
