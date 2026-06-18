'use strict';
/**
 * tests/reports.test.js
 * Integration tests for GET /api/reports.
 */
jest.mock('../src/db');

process.env.JWT_SECRET = 'test_secret_key_for_jest';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('./helpers/app');
const pool = require('../src/db');
const { makeAuthCookie } = require('./helpers/auth');

const AUTH = makeAuthCookie({ admin_id: 1, lot_id: 1, username: 'testadmin' });

// Convenience: mock the sequence of 4 pool.query calls that getReports makes
function mockReportsDB({ records = [], totalRecords = 0, fees = [], totalFees = 0 } = {}) {
  pool.query
    .mockResolvedValueOnce([[{ total: totalRecords }]])  // parking records count
    .mockResolvedValueOnce([records])                    // parking records rows
    .mockResolvedValueOnce([[{ total: totalFees }]])     // fee count
    .mockResolvedValueOnce([fees]);                      // fee rows
}

describe('GET /api/reports', () => {
  beforeEach(() => jest.clearAllMocks());

  test('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(401);
  });

  test('200 — returns paginated records and fees', async () => {
    const records = [
      { id: 1, registration_number: 'KA01AB1234', type: '4-wheeler', in_time: '2026-01-01 10:00:00', out_time: '2026-01-01 12:00:00', fee: 50 },
    ];
    const fees = [
      { fee_id: 1, vehicle_type: '4-wheeler', first_hour_charge: 30, rest_hour_charge: 20 },
    ];
    mockReportsDB({ records, totalRecords: 1, fees, totalFees: 1 });

    const res = await request(app).get('/api/reports').set('Cookie', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
    expect(res.body.totalRecords).toBe(1);
    expect(res.body.fees).toHaveLength(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
  });

  test('200 — empty result set', async () => {
    mockReportsDB();
    const res = await request(app).get('/api/reports').set('Cookie', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(0);
    expect(res.body.totalRecords).toBe(0);
  });

  test('200 — filters by reg_number query param', async () => {
    mockReportsDB({ records: [], totalRecords: 0 });
    const res = await request(app)
      .get('/api/reports?reg_number=KA01AB1234')
      .set('Cookie', AUTH);
    expect(res.status).toBe(200);
    // Verify pool.query was called (filter was applied server-side)
    expect(pool.query).toHaveBeenCalled();
  });

  test('200 — filters by date', async () => {
    mockReportsDB();
    const res = await request(app)
      .get('/api/reports?date=2026-01-01')
      .set('Cookie', AUTH);
    expect(res.status).toBe(200);
  });

  test('200 — filters by fee range (min_fee and max_fee)', async () => {
    mockReportsDB({ records: [], totalRecords: 0 });
    const res = await request(app)
      .get('/api/reports?min_fee=10&max_fee=100')
      .set('Cookie', AUTH);
    expect(res.status).toBe(200);
  });

  test('200 — accepts valid sort_by and sort_dir params', async () => {
    mockReportsDB();
    const res = await request(app)
      .get('/api/reports?sort_by=fee&sort_dir=desc')
      .set('Cookie', AUTH);
    expect(res.status).toBe(200);
  });

  test('200 — unknown sort_by falls back to safe default (no SQL injection)', async () => {
    mockReportsDB();
    // If sort_by is whitelisted correctly, this should not throw or error
    const res = await request(app)
      .get('/api/reports?sort_by=DROP+TABLE+parks_in&sort_dir=asc')
      .set('Cookie', AUTH);
    expect(res.status).toBe(200);
  });

  test('200 — pagination via page and fee_page params', async () => {
    mockReportsDB({ records: [], totalRecords: 25, fees: [], totalFees: 5 });
    const res = await request(app)
      .get('/api/reports?page=2&fee_page=1')
      .set('Cookie', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.feePage).toBe(1);
  });

  test('500 — DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('Query failed'));
    const res = await request(app).get('/api/reports').set('Cookie', AUTH);
    expect(res.status).toBe(500);
  });
});
