# Nginx Configuration & Automation Setup Guide

This directory contains the Nginx configuration and automation script to host both the frontend static site and the backend API proxy:

1. **Backend Proxy (Port 8080)**: Proxies incoming API requests to the local Express server (port 3001).
2. **Frontend Host (Port 80)**: Serves the compiled frontend React/Vite assets from `frontend/dist/` with routing fallbacks.

This setup secures the backend by keeping it bound to `localhost` and solves CORS issues by allowing Nginx to dynamically accept requests from any origin or client IP.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Nginx (Web & Proxy Server)                       │
│                                                                             │
│     Browser Client                   Nginx Server                           │
│   ┌────────────────┐              ┌────────────────┐                        │
│   │                │   Port 80    │  Static Server │                        │
│   │  Loads UI ◄────┼──────────────┼── Serves dist/ │                        │
│   │                │              └────────────────┘                        │
│   │                │                                                        │
│   │  API Requests  │  Port 8080   ┌────────────────┐                        │
│   │  ──────────────┼─────────────►│ Reverse Proxy  │                        │
│   │                │              └───────┬────────┘                        │
│   └────────────────┘                      │ proxy_pass (internal)           │
│                                           ▼                                 │
│                                   ┌────────────────┐                        │
│                                   │ Express Backend│ (Port 3001, local only)│
│                                   └────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key points:**
- The Express server binds to `127.0.0.1:3001` — it is **never reachable** directly from outside.
- Nginx acts as the single entry point: port `80` for frontend static files, port `8080` for backend API routes.
- CORS is handled dynamically by Nginx, allowing flexible deployment options.

---

## Prerequisites

- Linux machine (Debian, Ubuntu, Arch, etc.).
- Nginx installed: `sudo apt install nginx` (Ubuntu/Debian) or `sudo pacman -S nginx` (Arch).
- Node.js 18+ and npm installed.

---

## Automated Installation (Run Once)

The `install.sh` script automatically sets up the directories, updates `nginx.conf` if necessary to include enabled sites, copies config files, resolves the absolute paths, tests the configuration, and reloads Nginx.

```bash
# 1. Build the frontend static assets first
cd frontend
cp .env.example .env  # Edit .env and set VITE_API_URL to http://<backend-machine-ip>:8080
npm install
npm run build
cd ..

# 2. Run the automated Nginx installer (requires root or sudo)
sudo bash nginx/install.sh
```

---

## Service Endpoints

Once installed, Nginx serves:
* **Frontend Web Application**: [http://localhost](http://localhost) (Port 80)
* **Backend API Proxy**: [http://localhost:8080/api](http://localhost:8080/api)
* **Backend Health Check**: [http://localhost:8080/health](http://localhost:8080/health)

---

## Starting the Backend Service

To start the backend process behind Nginx:

```bash
cd backend
cp .env.example .env   # Set DB credentials, JWT_SECRET, etc.
npm install
npm start              # Runs on port 3001 internally
```

> **Tip:** Use a process manager like `pm2` to keep the backend alive:
> ```bash
> npm install -g pm2
> pm2 start src/index.js --name parking-backend
> pm2 save && pm2 startup
> ```

---

## Updating Nginx Configuration

If you make modifications to files in `nginx/` (`parking.conf` or `parking-frontend.conf`), run the install script again to apply all changes:

```bash
sudo bash nginx/install.sh
```

---

## Troubleshooting

| Symptom | Cause & Solution |
|---|---|
| `502 Bad Gateway` on Port 8080 | The Express server is not running. Start it with `npm start` in the `backend/` folder. |
| `403 Forbidden` on Port 80 | The frontend distribution directory `frontend/dist/` has not been built yet. Run `npm run build` inside `frontend/` and re-run `sudo bash nginx/install.sh`. |
| Port 80 or 8080 conflicts | Check if other services are using these ports. You can change the port bindings in `nginx/parking.conf` or `nginx/parking-frontend.conf` and re-run the installer. |
