'use strict';
/**
 * tests/vehicles.test.js
 * Integration tests for /api/vehicles/* routes.
 */
jest.mock('../src/db');
jest.mock('axios'); // mock ANPR calls
jest.mock('../src/utils/receipt', () => ({
  generateReceipt: jest.fn().mockResolvedValue({ fileName: 'receipt_TEST_123.pdf', relativePath: 'receipts/receipt_TEST_123.pdf' }),
}));

process.env.JWT_SECRET = 'test_secret_key_for_jest';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const axios = require('axios');
const app = require('./helpers/app');
const pool = require('../src/db');
const { makeAuthCookie } = require('./helpers/auth');

const AUTH = makeAuthCookie({ admin_id: 1, lot_id: 1, username: 'testadmin' });

// Build a connection mock that satisfies pool.getConnection()
function buildConnMock(queryMocks = []) {
  let callCount = 0;
  const conn = {
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
  return conn;
}

// ─── GET /api/vehicles/available-slots ────────────────────────────────────────
describe('GET /api/vehicles/available-slots', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200 — returns list of unoccupied slots', async () => {
    pool.query.mockResolvedValueOnce([[{ slot_no: 1 }, { slot_no: 3 }]]);
    const res = await request(app)
      .get('/api/vehicles/available-slots')
      .set('Cookie', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ slot_no: 1 }, { slot_no: 3 }]);
  });

  test('401 — unauthenticated request', async () => {
    const res = await request(app).get('/api/vehicles/available-slots');
    expect(res.status).toBe(401);
  });

  test('500 — DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app)
      .get('/api/vehicles/available-slots')
      .set('Cookie', AUTH);
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/vehicles/entry (manual) ────────────────────────────────────────
describe('POST /api/vehicles/entry (manual)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 — missing fields', async () => {
    const res = await request(app)
      .post('/api/vehicles/entry')
      .set('Cookie', AUTH)
      .send({ reg_number: 'KA01AB1234' }); // missing vehicle_type and slot_no
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('409 — vehicle already parked', async () => {
    const conn = buildConnMock();
    pool.getConnection.mockResolvedValueOnce(conn);
    // pool.query (not conn) for the initial "already parked" check
    pool.query.mockResolvedValueOnce([[{ 1: 1 }]]); // existing row found

    const res = await request(app)
      .post('/api/vehicles/entry')
      .set('Cookie', AUTH)
      .send({ reg_number: 'KA01AB1234', vehicle_type: '4-wheeler', slot_no: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already parked/i);
  });

  test('500 — slot unavailable (no slot rows returned)', async () => {
    pool.query.mockResolvedValueOnce([[]]); // not already parked
    const conn = buildConnMock([
      [[]], // INSERT IGNORE vehicle — success doesn't matter
      [[]], // slot SELECT returns empty → triggers error
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/vehicles/entry')
      .set('Cookie', AUTH)
      .send({ reg_number: 'KA01AB1234', vehicle_type: '4-wheeler', slot_no: 99 });
    expect(res.status).toBe(500);
  });

  test('200 — vehicle parked successfully', async () => {
    pool.query.mockResolvedValueOnce([[]]); // not already parked
    const conn = buildConnMock([
      [{ affectedRows: 1 }],             // INSERT IGNORE vehicle
      [[{ slot_id: 5 }]],               // slot SELECT
      [[{ fee_id: 1 }]],               // fee SELECT
      [{ affectedRows: 1 }],            // INSERT parks_in
      [{ affectedRows: 1 }],            // UPDATE slot status
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/vehicles/entry')
      .set('Cookie', AUTH)
      .send({ reg_number: 'KA01AB1234', vehicle_type: '4-wheeler', slot_no: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ plate: 'KA01AB1234', slot_no: 2 });
  });
});

// ─── POST /api/vehicles/auto-entry ───────────────────────────────────────────
describe('POST /api/vehicles/auto-entry', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 — no image provided', async () => {
    const res = await request(app)
      .post('/api/vehicles/auto-entry')
      .set('Cookie', AUTH)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No image/i);
  });

  test('502 — ANPR service unreachable', async () => {
    axios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await request(app)
      .post('/api/vehicles/auto-entry')
      .set('Cookie', AUTH)
      .send({ image_base64: 'data:image/jpeg;base64,abc' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Recognition service error/i);
  });

  test('422 — ANPR returns no plate', async () => {
    axios.post.mockResolvedValueOnce({ data: { type: 'car' } }); // no plate
    const res = await request(app)
      .post('/api/vehicles/auto-entry')
      .set('Cookie', AUTH)
      .send({ image_base64: 'abc' });
    expect(res.status).toBe(422);
  });

  test('409 — vehicle already parked', async () => {
    axios.post.mockResolvedValueOnce({ data: { plate: 'KA01AB1234', type: 'car' } });
    pool.query.mockResolvedValueOnce([[{ 1: 1 }]]); // already parked check
    const conn = buildConnMock();
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/vehicles/auto-entry')
      .set('Cookie', AUTH)
      .send({ image_base64: 'abc' });
    expect(res.status).toBe(409);
  });

  test('200 — walk-in entry succeeds', async () => {
    axios.post.mockResolvedValueOnce({ data: { plate: 'KA01AB1234', type: 'car' } });

    pool.query
      .mockResolvedValueOnce([[]])  // not already parked
      .mockResolvedValueOnce([{ affectedRows: 0 }]); // mark no-show (no rows)

    const conn = buildConnMock([
      [{ affectedRows: 1 }],         // INSERT IGNORE vehicle
      [[]], // no booking in window
      [[]], // no early booking
      [[{ slot_id: 3, slot_no: 3 }]], // free slot
      [[{ fee_id: 1 }]],             // fee
      [{ affectedRows: 1 }],         // INSERT parks_in
      [{ affectedRows: 1 }],         // UPDATE slot
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/vehicles/auto-entry')
      .set('Cookie', AUTH)
      .send({ image_base64: 'abc' });
    expect(res.status).toBe(200);
    expect(res.body.entry_type).toBe('walk-in');
    expect(res.body.plate).toBe('KA01AB1234');
  });
});

// ─── POST /api/vehicles/auto-delete ──────────────────────────────────────────
describe('POST /api/vehicles/auto-delete', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 — no image provided', async () => {
    const res = await request(app)
      .post('/api/vehicles/auto-delete')
      .set('Cookie', AUTH)
      .send({});
    expect(res.status).toBe(400);
  });

  test('422 — ANPR returns no plate', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });
    const res = await request(app)
      .post('/api/vehicles/auto-delete')
      .set('Cookie', AUTH)
      .send({ image_base64: 'abc' });
    expect(res.status).toBe(422);
  });

  test('200 — no_match when vehicle not found in lot', async () => {
    axios.post.mockResolvedValueOnce({ data: { plate: 'KA99ZZ9999', type: 'car' } });
    const conn = buildConnMock([
      [[]], // records SELECT — empty (not found)
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/vehicles/auto-delete')
      .set('Cookie', AUTH)
      .send({ image_base64: 'abc' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('no_match');
  });

  test('200 — vehicle removed with correct fee and receipt', async () => {
    axios.post.mockResolvedValueOnce({ data: { plate: 'KA01AB1234', type: 'car' } });

    const feeData = {
      type: '4-wheeler',
      minutes_parked: 90,
      hours_parked: 2,
      first_hour_charge: 30,
      rest_hour_charge: 20,
      parking_fee: 50,
    };

    const conn = buildConnMock([
      [[{ id: 10, slot_id: 3, in_time: '2026-01-01 10:00:00', slot_no: 3 }]], // records
      [[feeData]],     // fee calculation
      [{ affectedRows: 1 }], // UPDATE parks_in out_time
      [[]], // future booking check (none)
      [{ affectedRows: 1 }], // UPDATE parking_slot status
      [[]], // booking rows check (none)
      [{ affectedRows: 1 }], // UPDATE parks_in receipt_path
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/vehicles/auto-delete')
      .set('Cookie', AUTH)
      .send({ image_base64: 'abc' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('removed');
    expect(res.body.charge).toBe(50);
    expect(res.body.receipt_filename).toBe('receipt_TEST_123.pdf');
  });
});
