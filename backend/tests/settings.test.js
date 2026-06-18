'use strict';
/**
 * tests/settings.test.js
 * Integration tests for /api/settings/* routes.
 */
jest.mock('../src/db');

process.env.JWT_SECRET = 'test_secret_key_for_jest';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('./helpers/app');
const pool = require('../src/db');
const { makeAuthCookie } = require('./helpers/auth');

const AUTH = makeAuthCookie({ admin_id: 1, lot_id: 1, username: 'testadmin' });

function buildConnMock(queryMocks = []) {
  let callCount = 0;
  return {
    query: jest.fn().mockImplementation(() => {
      const val = queryMocks[callCount] ?? [[{ affectedRows: 1 }]];
      callCount++;
      return Promise.resolve(val);
    }),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

// ─── GET /api/settings ───────────────────────────────────────────────────────
describe('GET /api/settings', () => {
  beforeEach(() => jest.clearAllMocks());

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });

  test('200 — returns slot count, lot info and fee config', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 20 }]])   // slot count
      .mockResolvedValueOnce([[{ lot_name: 'Main Lot', address: '123 Street', layout_image_path: null }]]) // lot
      .mockResolvedValueOnce([[
        { vehicle_type: '2-wheeler', first_hour_charge: '10', rest_hour_charge: '5' },
        { vehicle_type: '4-wheeler', first_hour_charge: '30', rest_hour_charge: '20' },
      ]]); // fees

    const res = await request(app).get('/api/settings').set('Cookie', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.slot_count).toBe(20);
    expect(res.body.lot_name).toBe('Main Lot');
    expect(res.body.fees['2-wheeler'].first_hour).toBe(10);
    expect(res.body.fees['4-wheeler'].first_hour).toBe(30);
  });

  test('500 — DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/settings').set('Cookie', AUTH);
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/settings/lot ──────────────────────────────────────────────────
describe('POST /api/settings/lot', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 — missing lot_name', async () => {
    const res = await request(app)
      .post('/api/settings/lot')
      .set('Cookie', AUTH)
      .send({ address: '123 Street' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('400 — missing address', async () => {
    const res = await request(app)
      .post('/api/settings/lot')
      .set('Cookie', AUTH)
      .send({ lot_name: 'Main Lot' });
    expect(res.status).toBe(400);
  });

  test('200 — updates lot details without image', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app)
      .post('/api/settings/lot')
      .set('Cookie', AUTH)
      .send({ lot_name: 'Main Lot', address: '123 Street' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
  });
});

// ─── POST /api/settings/slots ────────────────────────────────────────────────
describe('POST /api/settings/slots', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 — total_slots less than 1', async () => {
    const res = await request(app)
      .post('/api/settings/slots')
      .set('Cookie', AUTH)
      .send({ total_slots: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 1/i);
  });

  test('200 — adds new slots when target > current', async () => {
    const conn = buildConnMock([
      [[{ total: 5 }]], // current count = 5
      [{ affectedRows: 1 }], // INSERT slot 6
      [{ affectedRows: 1 }], // INSERT slot 7
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/settings/slots')
      .set('Cookie', AUTH)
      .send({ total_slots: 7 });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/2 new slots added/i);
  });

  test('200 — removes slots when target < current', async () => {
    const conn = buildConnMock([
      [[{ total: 10 }]],    // current count = 10
      [{ affectedRows: 3 }], // DELETE 3 slots
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/settings/slots')
      .set('Cookie', AUTH)
      .send({ total_slots: 7 });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/3 slots removed/i);
  });

  test('200 — no change when count is already correct', async () => {
    const conn = buildConnMock([
      [[{ total: 7 }]], // current count = target
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/settings/slots')
      .set('Cookie', AUTH)
      .send({ total_slots: 7 });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already correct/i);
  });
});

// ─── POST /api/settings/fees ─────────────────────────────────────────────────
describe('POST /api/settings/fees', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — upserts fee config for both vehicle types', async () => {
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // 2-wheeler fee
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // 4-wheeler fee

    const res = await request(app)
      .post('/api/settings/fees')
      .set('Cookie', AUTH)
      .send({ fee_2w_first: 10, fee_2w_next: 5, fee_4w_first: 30, fee_4w_next: 20 });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
  });

  test('500 — DB error when updating fees', async () => {
    pool.query.mockRejectedValueOnce(new Error('Constraint error'));
    const res = await request(app)
      .post('/api/settings/fees')
      .set('Cookie', AUTH)
      .send({ fee_2w_first: 10, fee_2w_next: 5, fee_4w_first: 30, fee_4w_next: 20 });
    expect(res.status).toBe(500);
  });
});
