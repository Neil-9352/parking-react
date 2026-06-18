'use strict';
/**
 * tests/slots.test.js
 * Integration tests for /api/slots/* routes.
 */
jest.mock('../src/db');
jest.mock('../src/utils/receipt', () => ({
  generateReceipt: jest.fn().mockResolvedValue({ fileName: 'receipt_TEST_123.pdf', relativePath: 'receipts/receipt_TEST_123.pdf' }),
}));

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

// ─── GET /api/slots ─────────────────────────────────────────────────────────
describe('GET /api/slots', () => {
  beforeEach(() => jest.clearAllMocks());

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/slots');
    expect(res.status).toBe(401);
  });

  test('200 — returns slot list with occupancy and booking info', async () => {
    const slots = [
      { slot_id: 1, slot_no: 1, status: 'occupied', registration_number: 'KA01AB1234', type: '4-wheeler', in_time: '2026-01-01 10:00:00', booking_id: null },
      { slot_id: 2, slot_no: 2, status: 'unoccupied', registration_number: null, type: null, in_time: null, booking_id: null },
    ];
    pool.query.mockResolvedValueOnce([slots]);

    const res = await request(app).get('/api/slots').set('Cookie', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].registration_number).toBe('KA01AB1234');
  });

  test('500 — DB throws error', async () => {
    pool.query.mockRejectedValueOnce(new Error('Query failed'));
    const res = await request(app).get('/api/slots').set('Cookie', AUTH);
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/slots/remove/:slotId ─────────────────────────────────────────
describe('POST /api/slots/remove/:slotId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('401 — unauthenticated', async () => {
    const res = await request(app).post('/api/slots/remove/1');
    expect(res.status).toBe(401);
  });

  test('400 — slot does not belong to this lot', async () => {
    const conn = buildConnMock([
      [[]], // slotCheck returns empty → invalid slot
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/slots/remove/999')
      .set('Cookie', AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid slot/i);
  });

  test('400 — no vehicle currently parked in slot', async () => {
    const conn = buildConnMock([
      [[{ slot_id: 2 }]], // slotCheck passes
      [[]], // records SELECT empty → no vehicle
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/slots/remove/2')
      .set('Cookie', AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No vehicle/i);
  });

  test('200 — vehicle removed with fee, receipt generated', async () => {
    const record = {
      id: 10,
      registration_number: 'KA01AB1234',
      type: '4-wheeler',
      in_time: '2026-01-01 10:00:00',
      minutes_parked: 90,
      hours_parked: 2,
      first_hour_charge: 30,
      rest_hour_charge: 20,
      parking_fee: 50,
    };

    const conn = buildConnMock([
      [[{ slot_id: 2 }]],         // slotCheck
      [[record]],                  // fee+record SELECT
      [{ affectedRows: 1 }],      // UPDATE parks_in out_time + fee
      [[]], // future booking check (none)
      [{ affectedRows: 1 }],      // UPDATE parking_slot
      [{ affectedRows: 1 }],      // UPDATE parks_in receipt_path
    ]);
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post('/api/slots/remove/2')
      .set('Cookie', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.registration_number).toBe('KA01AB1234');
    expect(res.body.fee).toBe(50);
    expect(res.body.receipt_filename).toBe('receipt_TEST_123.pdf');
  });
});
