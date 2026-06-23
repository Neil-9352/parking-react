# Parking Lot Admin Panel

A full-stack web application for parking lot operators. It provides a
browser-based dashboard for managing vehicle entries and exits, viewing
occupancy, configuring lot settings, and generating reports — backed by a
Node.js/Express API and secured behind an Nginx reverse proxy.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Services at a Glance](#services-at-a-glance)
4. [Prerequisites](#prerequisites)
5. [Repository Structure](#repository-structure)
6. [Quick Start](#quick-start)
   - [Backend Machine Setup](#1-backend-machine-setup)
   - [Frontend Setup](#2-frontend-setup)
7. [Environment Variables](#environment-variables)
   - [Backend](#backend-env)
   - [Frontend](#frontend-env)
8. [API Reference](#api-reference)
9. [Nginx Reverse Proxy](#nginx-reverse-proxy)
10. [Running Tests](#running-tests)
11. [Process Management (Production)](#process-management-production)
12. [Troubleshooting](#troubleshooting)

---

## System Overview

| Component | Technology | Purpose |
|---|---|---|
| **Admin Panel** | React + Vite (TypeScript) | Browser-based operator dashboard |
| **Backend API** | Node.js + Express | REST API, JWT auth, file uploads |
| **Database** | MySQL | Shared data store |
| **Reverse Proxy** | Nginx | Public entry point, CORS handling, security |

---

## Architecture

```
┌──────────────────────────┐    ┌────────────────────────────────────────────┐
│    Operator's Browser    │    │          Backend Machine                   │
│                          │    │                                             │
│  React + Vite            │HTTP│  ┌─────────────────────────────────────┐  │
│  Admin Panel ────────────┼────┼─►│  Nginx  :8080 (public entry point)  │  │
│  (any machine, any IP)   │    │  │                                     │  │
│                          │    │  │  /api/*      → Express :3001        │  │
└──────────────────────────┘    │  │  /uploads/*  → Express :3001        │  │
                                │  │  /receipts/* → Express :3001        │  │
                                │  └──────────────┬──────────────────────┘  │
                                │                 │ 127.0.0.1 only           │
                                │                 ▼                          │
                                │  ┌──────────────────────────────────────┐  │
                                │  │  Express.js  :3001  (never public)   │  │
                                │  └──────────────┬───────────────────────┘  │
                                │                 │ mysql2/promise             │
                                │                 ▼                           │
                                │  ┌──────────────────────────────────────┐  │
                                │  │  MySQL  :3306  (parking_lot_final)   │  │
                                │  └──────────────────────────────────────┘  │
                                └────────────────────────────────────────────┘
```

**Why Nginx?** The admin panel can run on any machine (any IP). Without the
proxy you would have to update the backend's CORS allowed-origin every time
the frontend machine's address changes. Nginx handles CORS dynamically, so
the backend never needs to know the frontend's address.

---

## Services at a Glance

| Service | Default Port | Bound To | Notes |
|---|---|---|---|
| Nginx | **8080** | `0.0.0.0` | Public entry point |
| Express backend | 3001 | `127.0.0.1` | Only reachable via Nginx |
| MySQL | 3306 | `127.0.0.1` | Only reachable by Express |
| Vite dev server | 5173 | configurable | Frontend machine only |

---

## Prerequisites

### Backend Machine
- Linux
- Node.js 18+
- npm 9+
- MySQL 8.x
- Nginx

### Frontend Machine
- Node.js 18+
- npm 9+

---

## Repository Structure

```
parking-react/
├── backend/                  # Express.js API server
│   ├── src/
│   │   ├── app.js            # Express app + middleware setup
│   │   ├── index.js          # Server entry point
│   │   ├── db.js             # MySQL connection pool
│   │   ├── controllers/      # Route handlers
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT verification middleware
│   │   └── routes/           # Route definitions
│   ├── receipts/             # Generated PDF receipts (served as static files)
│   ├── uploads/              # Uploaded layout images
│   ├── tests/                # Jest test suites
│   ├── .env                  # Local environment variables (git-ignored)
│   ├── .env.example          # Environment variable template
│   └── package.json
│
├── frontend/                 # React + Vite admin panel (TypeScript)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx         # Operator login
│   │   │   ├── Dashboard.tsx     # Overview / nav hub
│   │   │   ├── ViewSlots.tsx     # Live slot occupancy grid
│   │   │   ├── ManualEntry.tsx   # Manual vehicle entry
│   │   │   ├── AutoEntry.tsx     # ANPR-assisted vehicle entry
│   │   │   ├── AutoDelete.tsx    # ANPR-assisted vehicle exit
│   │   │   ├── Report.tsx        # Revenue and occupancy reports
│   │   │   └── Settings.tsx      # Lot config, slot count, fees
│   │   ├── api/              # Axios API layer
│   │   ├── components/       # Reusable UI components
│   │   └── context/          # React context (auth state)
│   ├── dist/                 # Production build output
│   ├── .env                  # Local environment variables (git-ignored)
│   ├── .env.example          # Environment variable template
│   ├── vite.config.ts        # Vite configuration + dev proxy
│   └── package.json
│
├── nginx/
│   ├── parking.conf          # Nginx site configuration
│   ├── install.sh            # One-command Nginx setup script
│   └── README.md             # Nginx-specific setup guide
│
└── README.md                 # This file
```

---

## Quick Start

### 1. Backend Machine Setup

```bash
# Clone the repository
git clone <repo-url>
cd parking-react

# --- Database ---
mysql -u root -p parking_lot_final < schema.sql

# --- Backend ---
cd backend
cp .env.example .env
# Edit .env: set DB credentials, JWT_SECRET, etc.
nano .env

npm install
npm start          # Production
# or
npm run dev        # Development (auto-restarts on changes)

# --- Nginx (one-time setup) ---
cd ..
sudo bash nginx/install.sh

# Verify everything works
curl http://localhost:8080/health
# → {"status":"ok"}
```

### 2. Frontend Setup

Run this on a **separate machine** (or the same machine for local-only dev).

```bash
cd frontend
cp .env.example .env
# Set VITE_API_URL to the backend machine's Nginx address:
# e.g.  VITE_API_URL=http://192.168.1.50:8080
nano .env

npm install
npm run dev        # Development server with hot-reload
# or
npm run build      # Build for production → dist/
npm run preview    # Preview the production build locally
```

> **Local dev (single machine, no Nginx):**
> Set `VITE_API_URL=http://localhost:3001`. The Vite dev server will proxy
> `/api`, `/uploads`, and `/receipts` requests to Express automatically.

---

## Environment Variables

### Backend `.env`

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` / `production` |
| `PORT` | Express listen port | `3001` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_USER` | MySQL username | `parking_user` |
| `DB_PASSWORD` | MySQL password | `s3cur3pass` |
| `DB_NAME` | MySQL database name | `parking_lot_final` |
| `DB_PORT` | MySQL port | `3306` |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) | `change_me_to_a_long_random_string` |
| `JWT_EXPIRES_IN` | JWT lifespan | `8h` |
| `FRONTEND_URL` | Allowed CORS origins for **direct dev only** (comma-separated). **Leave empty when using Nginx** — Nginx handles CORS. | `http://localhost:5173` |
| `ANPR_URL` | ANPR plate recognition service URL | `http://localhost:8000/api/detect` |

### Frontend `.env`

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Base URL of the Nginx reverse proxy (or Express directly for local dev) | `http://192.168.1.50:8080` |

---

## API Reference

All routes are prefixed with `/api`. Protected routes require an
`Authorization: Bearer <token>` header.

### Authentication — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | No | Operator login — returns a JWT |
| `POST` | `/api/auth/logout` | Yes | Invalidates the current session |
| `GET` | `/api/auth/me` | Yes | Returns the logged-in operator's details |
| `POST` | `/api/auth/change-password` | Yes | Changes the operator's password |

### Slots — `/api/slots`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/slots` | Yes | Returns the full slot grid with current occupancy status |
| `POST` | `/api/slots/remove/:slotId` | Yes | Marks a slot as unoccupied (manual vehicle removal) |

### Vehicles — `/api/vehicles`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/vehicles/available-slots` | Yes | Lists slots available for a new vehicle entry |
| `POST` | `/api/vehicles/entry` | Yes | Manual vehicle entry (operator selects slot) |
| `POST` | `/api/vehicles/auto-entry` | Yes | ANPR-assisted entry (plate from recognition service) |
| `POST` | `/api/vehicles/auto-delete` | Yes | ANPR-assisted exit — calculates fee and generates receipt |

### Reports — `/api/reports`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/reports` | Yes | Revenue and occupancy report data for the operator's lot |

### Settings — `/api/settings`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/settings` | Yes | Returns current lot configuration, slot count, and fee rules |
| `POST` | `/api/settings/lot` | Yes | Updates lot details and uploads a new layout image (`multipart/form-data`) |
| `POST` | `/api/settings/slots` | Yes | Updates the number of parking slots |
| `POST` | `/api/settings/fees` | Yes | Updates fee rules (first hour, per-hour rates by vehicle type) |

### Receipts & Static Assets

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/receipts/:filename` | Yes | Download a generated PDF receipt |
| `GET` | `/uploads/*` | No | Static assets (layout images, etc.) |
| `GET` | `/health` | No | Health check — returns `{"status":"ok"}` |

---

## Nginx Reverse Proxy

See [`nginx/README.md`](nginx/README.md) for the full setup guide.

**Quick install (run once on the backend machine):**
```bash
sudo bash nginx/install.sh
```

**How it works:**
- Nginx listens on port 8080 (public-facing).
- `/api/*`, `/uploads/*`, `/receipts/*` requests are forwarded to Express on
  `http://127.0.0.1:3001` — Express is never directly reachable from outside.
- CORS is handled by Nginx dynamically — it reflects the browser's `Origin`
  header, so the admin panel can run from any IP without any backend config
  changes.

**Updating the config after edits:**
```bash
sudo cp nginx/parking.conf /etc/nginx/sites-available/parking
sudo nginx -t && sudo systemctl reload nginx
```

---

## Running Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

Tests use Jest and Supertest. Coverage reports are saved to `backend/coverage/`.

---

## Process Management (Production)

Use **pm2** to keep the backend alive across reboots:

```bash
npm install -g pm2

# Start the backend
cd backend
pm2 start src/index.js --name parking-backend

# Save process list and enable startup on boot
pm2 save
pm2 startup   # follow the printed instruction

# Useful commands
pm2 status
pm2 logs parking-backend
pm2 restart parking-backend
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `502 Bad Gateway` from Nginx | Express is not running | `cd backend && npm start` |
| CORS error in browser | `VITE_API_URL` points to port 3001 directly instead of Nginx | Set `VITE_API_URL=http://<nginx-machine-ip>:8080` |
| `Connection refused` on `/api` | Nginx not running or misconfigured | `sudo systemctl status nginx` → `sudo nginx -t` |
| JWT expired / 401 errors | Token has expired | Re-login; lifespan is set by `JWT_EXPIRES_IN` in `.env` |
| `ECONNREFUSED` in Express logs | MySQL not running or wrong credentials | Check `DB_*` in `.env`; `sudo systemctl start mysql` |
| Port 8080 already in use | Another Nginx site or proxy config | Change `listen 8080` in `nginx/parking.conf` |
| Layout image not displaying | Image not uploaded or path mismatch | Re-upload via Settings page; check `backend/uploads/layouts/` |
| Receipt download returns 404 | Receipt file missing | Verify the receipt was generated; check `backend/receipts/` |
| ANPR not detecting plates | ANPR service not running | Check `ANPR_URL` in `.env`; ensure the detection service is up |
