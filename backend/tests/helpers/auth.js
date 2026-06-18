'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_for_jest';

/**
 * Generate a signed JWT cookie header for test requests.
 * @param {object} payload  e.g. { admin_id: 1, lot_id: 1, username: 'admin' }
 */
function makeAuthCookie(payload = { admin_id: 1, lot_id: 1, username: 'testadmin' }) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  return `token=${token}`;
}

module.exports = { makeAuthCookie, JWT_SECRET };
