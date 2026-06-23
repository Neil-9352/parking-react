# Nginx Reverse Proxy — Setup Guide

This directory contains the Nginx configuration that sits in front of the
Express backend, allowing the frontend to run on a **separate machine** and
call the API without any hardcoded IP addresses in the CORS configuration.

---

## Architecture

```
┌─────────────────────────┐          ┌───────────────────────────────────────────┐
│   Frontend Machine      │          │          Backend Machine                  │
│                         │          │                                           │
│  Vite / React app       │  HTTP    │  ┌──────────────────┐                     │
│  (any IP, any port) ────┼──────────┼─►│  Nginx  :8080    │                     │
│                         │          │  │  (public face)   │                     │
│  VITE_API_URL=          │          │  └────────┬─────────┘                     │
│  http://<backend-ip>    │          │           │ proxy_pass                    │
│  :8080                  │          │           ▼                               │
└─────────────────────────┘          │  ┌──────────────────┐                     │
                                     │  │  Express  :3001   │ (127.0.0.1 only)   │
                                     │  │  (never public)  │                     │
                                     │  └──────────────────┘                     │
                                     └───────────────────────────────────────────┘
```

**Key points:**
- The Express server binds to `127.0.0.1:3001` — it is **not reachable** from outside.
- Nginx is the sole public endpoint on port 8080.
- CORS is handled by Nginx dynamically: it reflects the browser's `Origin` header, so the frontend can run on **any IP** without any code changes.
- The backend's `FRONTEND_URL` env variable is no longer used for CORS — it can be removed or left as a documentation note.

---

## Prerequisites

- Linux machine (Ubuntu/Debian recommended).
- Nginx installed: `sudo apt install nginx`
- Node.js 18+ installed.
- MySQL running and the database imported.

---

## One-Time Setup (Backend Machine)

```bash
# 1. Clone / copy the project onto the backend machine
git clone <repo-url>
cd parking-react

# 2. Install Nginx site config (run once)
sudo bash nginx/install.sh

# 3. Verify Nginx is running and the health endpoint works
curl http://localhost:8080/health
# Expected: {"status":"ok"}
```

---

## Starting the Backend

```bash
cd backend

# Copy and fill in your environment variables
cp .env.example .env
nano .env          # set DB credentials, JWT_SECRET, etc.

# Install dependencies (first time)
npm install

# Run in production mode
npm start

# Or run in development mode (auto-restart on file changes)
npm run dev
```

> **Tip:** Use a process manager like `pm2` to keep the backend alive:
> ```bash
> npm install -g pm2
> pm2 start src/index.js --name parking-backend
> pm2 save && pm2 startup
> ```

---

## Configuring the Frontend (Frontend Machine)

Set the backend's Nginx address as the API URL in the frontend's `.env`:

```env
# frontend/.env
VITE_API_URL=http://<backend-machine-ip>:8080
```

Then start the frontend normally:

```bash
cd frontend
npm install
npm run dev
```

---

## Updating the Nginx Config

If you modify `nginx/parking.conf`, apply the changes with:

```bash
sudo cp nginx/parking.conf /etc/nginx/sites-available/parking
sudo nginx -t && sudo systemctl reload nginx
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `502 Bad Gateway` | Express is not running. Start it with `npm start` in `backend/`. |
| `403 Forbidden` on `/api/*` | Check if the location regex in `parking.conf` matches the path. |
| CORS errors in browser | Confirm `VITE_API_URL` in the frontend points to the Nginx machine, not directly to port 3001. |
| Port 8080 already in use | Edit the `listen` directive in `parking.conf` to use another port. |
| `connect() failed (111: Connection refused)` | Express is running on the wrong interface. Ensure `app.listen` uses port 3001 (no host restriction in code needed — the firewall/Nginx handles that). |
