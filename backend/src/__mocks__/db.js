'use strict';
/**
 * Manual mock for src/db.js
 * Replaces the MySQL2 pool with Jest mock functions so no real DB is needed.
 * Tests configure return values via mockResolvedValueOnce / mockImplementation.
 */
const pool = {
  query: jest.fn(),
  getConnection: jest.fn(),
  end: jest.fn().mockResolvedValue(undefined),
};

module.exports = pool;
