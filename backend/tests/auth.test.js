'use strict';
/**
 * tests/auth.test.js
 * Integration tests for /api/auth/* routes.
 * The database pool is fully mocked — no real MySQL connection is made.
 */
jest.mock('../src/db');

process.env.JWT_SECRET = 'test_secret_key_for_jest';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('./helpers/app');
const pool = require('../src/db');
const { makeAuthCookie } = require('./helpers/auth');

// Helper: configure pool.query to return different things per call
function mockQuery(...returnValues) {
  let callCount = 0;
  pool.query.mockImplementation(() => {
    const val = returnValues[callCount] ?? returnValues[returnValues.length - 1];
    callCount++;
    return Promise.resolve(val);
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 — missing username', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'pass' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('400 — missing password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('401 — username not found', async () => {
    pool.query.mockResolvedValueOnce([[]]); // admin SELECT returns empty
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'pass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid/i);
  });

  test('401 — wrong password', async () => {
    const hashed = await bcrypt.hash('correct_password', 1);
    pool.query.mockResolvedValueOnce([[{ id: 1, username: 'admin', password: hashed, lot_id: 1 }]]);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong_password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid/i);
  });

  test('403 — admin lot not found in DB', async () => {
    const hashed = await bcrypt.hash('pass123', 1);
    pool.query
      .mockResolvedValueOnce([[{ id: 1, username: 'admin', password: hashed, lot_id: 99 }]])
      .mockResolvedValueOnce([[]]); // lot SELECT returns empty
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'pass123' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/lot not found/i);
  });

  test('200 — valid credentials, sets cookie and returns admin info', async () => {
    const hashed = await bcrypt.hash('pass123', 1);
    pool.query
      .mockResolvedValueOnce([[{ id: 7, username: 'admin', password: hashed, lot_id: 3 }]])
      .mockResolvedValueOnce([[{ lot_id: 3, lot_name: 'Main Lot' }]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'pass123' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ admin_id: 7, lot_id: 3, username: 'admin', lot_name: 'Main Lot' });
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('500 — DB throws error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB connection failed'));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'pass' });
    expect(res.status).toBe(500);
  });
});

describe('POST /api/auth/logout', () => {
  test('200 — clears cookie and returns success when authenticated', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', makeAuthCookie());
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });

  test('401 — returns unauthorized when no token provided', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => jest.clearAllMocks());

  test('401 — no auth cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('200 — returns admin info when authenticated', async () => {
    pool.query.mockResolvedValueOnce([[{ lot_name: 'Test Lot' }]]);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', makeAuthCookie({ admin_id: 1, lot_id: 1, username: 'testadmin' }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'testadmin', lot_name: 'Test Lot' });
  });
});

describe('POST /api/auth/change-password', () => {
  beforeEach(() => jest.clearAllMocks());

  const authCookie = makeAuthCookie();

  test('401 — unauthenticated', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ new_password: 'abc123', confirm_password: 'abc123' });
    expect(res.status).toBe(401);
  });

  test('400 — missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', authCookie)
      .send({ new_password: 'abc123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('400 — passwords do not match', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', authCookie)
      .send({ new_password: 'abc123', confirm_password: 'xyz789' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/do not match/i);
  });

  test('400 — password too short', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', authCookie)
      .send({ new_password: '123', confirm_password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  test('200 — password updated successfully', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', authCookie)
      .send({ new_password: 'newpass123', confirm_password: 'newpass123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
  });
});
