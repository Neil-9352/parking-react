const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Helper to get cookie options dynamically
function getCookieOptions(req) {
  const isSecure = process.env.COOKIE_SECURE === 'true' || 
    (process.env.COOKIE_SECURE !== 'false' && req.secure);
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  };
}

// POST /api/auth/login
async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM admin WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify lot exists
    const [lotRows] = await pool.query('SELECT lot_id, lot_name FROM parking_lot WHERE lot_id = ?', [admin.lot_id]);
    if (lotRows.length === 0) {
      return res.status(403).json({ error: 'Associated parking lot not found' });
    }

    const payload = {
      admin_id: admin.id,
      lot_id: admin.lot_id,
      username: admin.username,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.cookie('token', token, getCookieOptions(req));

    return res.status(200).json({
      admin_id: admin.id,
      lot_id: admin.lot_id,
      username: admin.username,
      lot_name: lotRows[0].lot_name,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/auth/logout
function logout(req, res) {
  const isSecure = getCookieOptions(req).secure;
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: isSecure });
  return res.status(200).json({ message: 'Logged out' });
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const [lots] = await pool.query('SELECT lot_name FROM parking_lot WHERE lot_id = ?', [req.admin.lot_id]);
    return res.status(200).json({
      admin_id: req.admin.admin_id,
      lot_id: req.admin.lot_id,
      username: req.admin.username,
      lot_name: lots[0]?.lot_name || '',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/auth/change-password
async function changePassword(req, res) {
  const { new_password, confirm_password } = req.body;

  if (!new_password || !confirm_password) {
    return res.status(400).json({ error: 'Both password fields are required' });
  }
  if (new_password !== confirm_password) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hashed = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE admin SET password = ? WHERE id = ?', [hashed, req.admin.admin_id]);
    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}


// POST /api/auth/register  (public – no token required)
// Body (multipart/form-data):
//   lot_name, address, total_slots, fee_2w_first, fee_2w_next,
//   fee_4w_first, fee_4w_next, username, password, confirm_password
//   layout_image (optional file)
async function register(req, res) {
  const {
    lot_name, address, total_slots,
    fee_2w_first, fee_2w_next, fee_4w_first, fee_4w_next,
    username, password, confirm_password,
  } = req.body;

  // --- Validate required text fields ---
  if (!lot_name || !address || !username || !password || !confirm_password) {
    return res.status(400).json({ error: 'All required fields must be filled.' });
  }

  const slots = parseInt(total_slots, 10);
  if (!slots || slots < 1 || slots > 1000) {
    return res.status(400).json({ error: 'Number of parking slots must be between 1 and 1000.' });
  }

  if (lot_name.length > 100) {
    return res.status(400).json({ error: 'Parking lot name must be at most 100 characters.' });
  }
  if (address.length > 255) {
    return res.status(400).json({ error: 'Address must be at most 255 characters.' });
  }
  if (username.length > 50) {
    return res.status(400).json({ error: 'Username must be at most 50 characters.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  // --- Validate fees ---
  const f2wFirst = parseFloat(fee_2w_first);
  const f2wNext  = parseFloat(fee_2w_next);
  const f4wFirst = parseFloat(fee_4w_first);
  const f4wNext  = parseFloat(fee_4w_next);

  if (
    fee_2w_first === undefined || fee_2w_next === undefined ||
    fee_4w_first === undefined || fee_4w_next === undefined ||
    isNaN(f2wFirst) || isNaN(f2wNext) || isNaN(f4wFirst) || isNaN(f4wNext)
  ) {
    return res.status(400).json({ error: 'All parking fee fields are required.' });
  }
  if (f2wFirst < 0 || f2wNext < 0 || f4wFirst < 0 || f4wNext < 0) {
    return res.status(400).json({ error: 'Fee values cannot be negative.' });
  }

  // --- Check username uniqueness ---
  try {
    const [existing] = await pool.query('SELECT id FROM admin WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username is already taken. Please choose another.' });
    }
  } catch (err) {
    console.error('Register – username check error:', err);
    return res.status(500).json({ error: 'Server error during validation.' });
  }

  // --- Validate uploaded image (if any) ---
  // multer has already placed the file at req.file (set up in settings route);
  // here register uses its own multer instance attached via the route.
  let uploadedFilePath = null; // absolute path on disk (for rollback on error)
  let layoutImagePath  = null; // relative DB value

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Insert parking_lot (image path filled in after we know lot_id)
    const [lotResult] = await conn.query(
      'INSERT INTO parking_lot (lot_name, address, layout_image_path) VALUES (?, ?, NULL)',
      [lot_name, address]
    );
    const lot_id = lotResult.insertId;

    // 2. Handle image upload
    if (req.file) {
      const ext      = path.extname(req.file.originalname);
      const filename = `Lot_${lot_id}_layout${ext}`;
      const dir      = path.join(__dirname, '../../uploads/layouts');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const dest = path.join(dir, filename);
      fs.renameSync(req.file.path, dest); // move from multer temp to final location
      uploadedFilePath = dest;
      layoutImagePath  = `uploads/layouts/${filename}`;

      await conn.query(
        'UPDATE parking_lot SET layout_image_path = ? WHERE lot_id = ?',
        [layoutImagePath, lot_id]
      );
    }

    // 3. Insert parking slots
    for (let i = 1; i <= slots; i++) {
      await conn.query(
        "INSERT INTO parking_slot (slot_no, status, lot_id) VALUES (?, 'unoccupied', ?)",
        [i, lot_id]
      );
    }

    // 4. Insert fee records
    const fees = [
      ['2-wheeler', f2wFirst, f2wNext],
      ['4-wheeler', f4wFirst, f4wNext],
    ];
    for (const [type, first, next] of fees) {
      await conn.query(
        'INSERT INTO fee (lot_id, vehicle_type, first_hour_charge, rest_hour_charge) VALUES (?, ?, ?, ?)',
        [lot_id, type, first, next]
      );
    }

    // 5. Insert admin with bcrypt-hashed password
    const hashedPassword = await bcrypt.hash(password, 12);
    await conn.query(
      'INSERT INTO admin (username, password, lot_id) VALUES (?, ?, ?)',
      [username, hashedPassword, lot_id]
    );

    await conn.commit();

    return res.status(201).json({
      message: 'Parking lot registered successfully! Please log in.',
      lot_id,
    });
  } catch (err) {
    await conn.rollback();

    // Clean up uploaded file if the transaction failed
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  } finally {
    conn.release();
  }
}

module.exports = { login, logout, me, changePassword, register };
