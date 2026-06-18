'use strict';
/**
 * Returns the Express app for Supertest requests.
 * The DB pool is mocked at the jest module level — this just wires up the app.
 */
const app = require('../../src/app');
module.exports = app;
