const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
};

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

    res.cookie('token', token, COOKIE_OPTIONS);

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
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
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

module.exports = { login, logout, me, changePassword };
