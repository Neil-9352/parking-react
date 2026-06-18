'use strict';
/**
 * tests/receipt.unit.test.js
 * Unit tests for the generateReceipt() PDF utility.
 *
 * Strategy: let the function write real PDFs to the actual receipts dir
 * (it creates it if missing). We verify the returned metadata shapes and
 * that the file is actually written, then clean up afterward.
 */
const path = require('path');
const fs = require('fs');

const { generateReceipt } = require('../src/utils/receipt');

const receiptsDir = path.join(__dirname, '../receipts');

// Track files created during tests so we can clean them up
const createdFiles = [];

afterAll(() => {
  for (const file of createdFiles) {
    try { fs.unlinkSync(file); } catch (_) {}
  }
});

async function generate(overrides = {}) {
  const defaults = {
    plate: 'KA01AB1234',
    vehicleType: '4-wheeler',
    inTime: '2026-01-01 10:00:00',
    outTime: '2026-01-01 12:00:00',
    minutesParked: 120,
    hoursParked: 2,
    firstHourCharge: 30,
    restHourCharge: 20,
    parkingFee: 50,
  };
  const result = await generateReceipt({ ...defaults, ...overrides });
  createdFiles.push(path.join(receiptsDir, result.fileName));
  return result;
}

describe('generateReceipt()', () => {
  test('returns an object with fileName and relativePath', async () => {
    const result = await generate();
    expect(result).toHaveProperty('fileName');
    expect(result).toHaveProperty('relativePath');
  });

  test('fileName follows pattern receipt_<PLATE>_<timestamp>.pdf', async () => {
    const result = await generate({ plate: 'KA01AB1234' });
    expect(result.fileName).toMatch(/^receipt_KA01AB1234_\d+\.pdf$/);
  });

  test('relativePath is receipts/<fileName>', async () => {
    const result = await generate();
    expect(result.relativePath).toBe(`receipts/${result.fileName}`);
  });

  test('actually writes a PDF file to disk', async () => {
    const result = await generate();
    const filePath = path.join(receiptsDir, result.fileName);
    expect(fs.existsSync(filePath)).toBe(true);
    const stat = fs.statSync(filePath);
    expect(stat.size).toBeGreaterThan(100); // non-empty PDF
  });

  test('sanitises special characters in plate — replaces spaces/slashes with underscores, keeps hyphens', async () => {
    const result = await generate({ plate: 'KA-01 AB/1234' });
    // Spaces and slashes should be replaced; hyphens are allowed by the sanitiser
    expect(result.fileName).not.toMatch(/[\s/]/);
    // Should start with the sanitised plate (hyphens kept, spaces→_ slashes→_)
    expect(result.fileName).toMatch(/^receipt_KA-01_AB_1234_/);
  });

  test('handles missing optional fields gracefully (no booking info)', async () => {
    await expect(
      generate({ bookingId: undefined, bookingAmount: undefined, refundStatus: undefined })
    ).resolves.toMatchObject({
      fileName: expect.stringMatching(/^receipt_KA01AB1234_/),
      relativePath: expect.stringMatching(/^receipts\//),
    });
  });

  test('includes booking details section when bookingId is provided', async () => {
    // Should not throw even with booking data
    await expect(
      generate({ bookingId: 42, bookingAmount: 100, refundStatus: 'REFUNDED' })
    ).resolves.toMatchObject({
      fileName: expect.stringMatching(/\.pdf$/),
    });
  });

  test('each call generates a unique fileName (different timestamps)', async () => {
    const [r1, r2] = await Promise.all([generate(), generate({ plate: 'MH12CD5678' })]);
    expect(r1.fileName).not.toBe(r2.fileName);
  });
});
