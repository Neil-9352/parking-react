'use strict';
/**
 * tests/middleware.test.js
 * Unit tests for the verifyToken auth middleware.
 */
const jwt = require('jsonwebtoken');
const verifyToken = require('../src/middleware/auth');

// Set the secret before the module runs
process.env.JWT_SECRET = 'test_secret_key_for_jest';

function buildReqResMock() {
  const req = { cookies: {} };
  const res = {
    _status: null,
    _body: null,
    _clearedCookie: false,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    clearCookie() { this._clearedCookie = true; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('verifyToken middleware', () => {
  test('returns 401 when no cookie is present', () => {
    const { req, res, next } = buildReqResMock();
    verifyToken(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toMatchObject({ error: expect.stringContaining('No token') });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 and clears cookie when token is invalid', () => {
    const { req, res, next } = buildReqResMock();
    req.cookies.token = 'this.is.not.a.real.jwt';

    verifyToken(req, res, next);

    expect(res._status).toBe(401);
    expect(res._clearedCookie).toBe(true);
    expect(res._body).toMatchObject({ error: expect.stringContaining('Invalid') });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is expired', () => {
    const { req, res, next } = buildReqResMock();
    const expired = jwt.sign(
      { admin_id: 1, lot_id: 1, username: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: -1 } // expired immediately
    );
    req.cookies.token = expired;

    verifyToken(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() and attaches decoded payload to req.admin on valid token', () => {
    const { req, res, next } = buildReqResMock();
    const payload = { admin_id: 42, lot_id: 7, username: 'superadmin' };
    req.cookies.token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.admin).toMatchObject(payload);
  });
});
