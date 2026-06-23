require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const slotsRoutes = require('./routes/slots');
const vehiclesRoutes = require('./routes/vehicles');
const reportsRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const receiptsRoutes = require('./routes/receipts');

const app = express();

// Trust the Nginx reverse proxy so that X-Forwarded-For / X-Real-IP headers
// are used for the client IP instead of 127.0.0.1 (the proxy's address).
// Set to 1 if there is exactly one proxy (Nginx) in front of Express.
app.set('trust proxy', 1);

// CORS configuration.
// When running behind the Nginx reverse proxy, Nginx handles CORS headers
// directly and sets Access-Control-Allow-Origin to the browser's Origin.
// Express CORS here acts as a permissive fallback for direct local dev access
// (i.e., running without Nginx using the Vite dev-server proxy).
//
// FRONTEND_URL can be:
//   - A single origin:             http://localhost:5173
//   - A comma-separated list:      http://localhost:5173,http://192.168.1.10
//   - Empty / omitted:             allows all origins (safe behind Nginx)
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (e.g. curl, Postman, same-origin).
    if (!origin) return callback(null, true);
    // If no allow-list is configured, permit everything (Nginx already guards the door).
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/receipts', receiptsRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;
