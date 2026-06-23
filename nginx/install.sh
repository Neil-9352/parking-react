#!/usr/bin/env bash
# =============================================================================
# Parking Lot Management System - Nginx Setup Script
#
# Run this ONCE on the backend machine to install the Nginx site config.
# Must be run as root or with sudo.
#
# Usage:
#   sudo bash nginx/install.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_SRC="$SCRIPT_DIR/parking.conf"
CONF_NAME="parking"
FRONTEND_CONF_SRC="$SCRIPT_DIR/parking-frontend.conf"
FRONTEND_CONF_NAME="parking-frontend"
FRONTEND_DIST="$(cd "$SCRIPT_DIR/../frontend" && pwd)/dist"
SITES_AVAILABLE="/etc/nginx/sites-available"
SITES_ENABLED="/etc/nginx/sites-enabled"

# ---- Load configuration ports dynamically ----------------------------------
ENV_FILE="$SCRIPT_DIR/.env"
FRONTEND_PORT=80
BACKEND_PORT=8080

# ---- Colour helpers ---------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

if [[ -f "$ENV_FILE" ]]; then
    info "Loading port settings from $ENV_FILE..."
    while IFS= read -r line || [[ -n "$line" ]]; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line//[[:space:]]/}" ]] && continue
        if [[ "$line" =~ ^([A-Za-z0-9_]+)=(.*)$ ]]; then
            key="${BASH_REMATCH[1]}"
            val="${BASH_REMATCH[2]}"
            val="${val#\"}"
            val="${val%\"}"
            val="${val#\'}"
            val="${val%\'}"
            if [[ "$key" == "FRONTEND_PORT" ]]; then
                FRONTEND_PORT="$val"
            elif [[ "$key" == "BACKEND_PORT" ]]; then
                BACKEND_PORT="$val"
            fi
        fi
    done < "$ENV_FILE"
fi

info "Using ports -> Frontend: $FRONTEND_PORT, Backend Proxy: $BACKEND_PORT"

# ---- Pre-flight checks ------------------------------------------------------
[[ "$EUID" -ne 0 ]] && error "Please run as root: sudo bash nginx/install.sh"
command -v nginx &>/dev/null || error "Nginx is not installed. Run: sudo apt install nginx"

# ---- Create directories if they do not exist (required for non-Debian distributions) ----
mkdir -p "$SITES_AVAILABLE" "$SITES_ENABLED"

# ---- Ensure nginx.conf includes sites-enabled folder ------------------------
NGINX_CONF="/etc/nginx/nginx.conf"
if [[ -f "$NGINX_CONF" ]]; then
    if ! grep -q "sites-enabled" "$NGINX_CONF"; then
        info "Adding 'include sites-enabled/*;' directive to $NGINX_CONF..."
        cp "$NGINX_CONF" "${NGINX_CONF}.bak"
        # Insert include line after 'http {' block definition
        sed -i '/http {/a \    include sites-enabled/*;' "$NGINX_CONF"
    fi
fi

# ---- Remove the default site (commonly conflicts on port 80) ----------------
if [[ -f "$SITES_ENABLED/default" ]]; then
    warn "Removing default Nginx site to free port 80..."
    rm -f "$SITES_ENABLED/default"
fi

# ---- Disable default server block in nginx.conf if running on port 80 --------
if [[ -f "$NGINX_CONF" ]]; then
    if [[ "$FRONTEND_PORT" -eq 80 || "$BACKEND_PORT" -eq 80 ]]; then
        if grep -E -q "^\s*listen\s+80;" "$NGINX_CONF" || grep -E -q "^\s*listen\s+\[::\]:80;" "$NGINX_CONF"; then
            info "Commenting out default 'listen 80' directives in $NGINX_CONF to avoid conflicts..."
            # Backup if not already backed up
            [[ ! -f "${NGINX_CONF}.bak" ]] && cp "$NGINX_CONF" "${NGINX_CONF}.bak"
            # Comment them out
            sed -i 's/\(listen[[:space:]]\+80;\)/#\1/g' "$NGINX_CONF"
            sed -i 's/\(listen[[:space:]]\+\[::\]:80;\)/#\1/g' "$NGINX_CONF"
        fi
    fi
fi

# ---- Prepare and install Frontend configuration -----------------------------
info "Preparing Frontend Nginx configuration..."
if [[ ! -d "$FRONTEND_DIST" ]]; then
    warn "Frontend build directory ($FRONTEND_DIST) does not exist yet."
    warn "Creating it now with parent folder ownership to avoid build issues..."
    PARENT_OWNER=$(stat -c '%U:%G' "$(dirname "$FRONTEND_DIST")" 2>/dev/null || echo "")
    mkdir -p "$FRONTEND_DIST"
    if [[ -n "$PARENT_OWNER" ]]; then
        chown "$PARENT_OWNER" "$FRONTEND_DIST"
    fi
fi

# Replace placeholders and save to sites-available
sed -e "s|__FRONTEND_DIST__|${FRONTEND_DIST}|g" \
    -e "s|__FRONTEND_PORT__|${FRONTEND_PORT}|g" \
    "$FRONTEND_CONF_SRC" > "$SITES_AVAILABLE/$FRONTEND_CONF_NAME"
info "Copied and updated frontend config → $SITES_AVAILABLE/$FRONTEND_CONF_NAME"

# ---- Prepare and copy Backend config to sites-available ----------------------
sed "s|__BACKEND_PORT__|${BACKEND_PORT}|g" "$CONF_SRC" > "$SITES_AVAILABLE/$CONF_NAME"
info "Copied and updated backend config → $SITES_AVAILABLE/$CONF_NAME"

# ---- Enable the sites via symlink -------------------------------------------
ln -sf "$SITES_AVAILABLE/$CONF_NAME" "$SITES_ENABLED/$CONF_NAME"
info "Enabled backend site → $SITES_ENABLED/$CONF_NAME"

ln -sf "$SITES_AVAILABLE/$FRONTEND_CONF_NAME" "$SITES_ENABLED/$FRONTEND_CONF_NAME"
info "Enabled frontend site → $SITES_ENABLED/$FRONTEND_CONF_NAME"

# ---- Test the configuration -------------------------------------------------
info "Testing Nginx configuration..."
nginx -t || error "Nginx config test failed. Fix the errors above and re-run."

# ---- Reload or start Nginx --------------------------------------------------
if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    info "Nginx reloaded successfully with all changes."
else
    systemctl enable --now nginx
    info "Nginx started and enabled on boot."
fi

# Determine displays
FRONTEND_DISPLAY_URL="http://$(hostname -i | awk '{print $1}')"
if [[ "$FRONTEND_PORT" -ne 80 ]]; then
    FRONTEND_DISPLAY_URL="${FRONTEND_DISPLAY_URL}:${FRONTEND_PORT}"
fi

BACKEND_DISPLAY_URL="http://$(hostname -i | awk '{print $1}')"
if [[ "$BACKEND_PORT" -ne 80 ]]; then
    BACKEND_DISPLAY_URL="${BACKEND_DISPLAY_URL}:${BACKEND_PORT}"
fi

FRONTEND_CURL="http://localhost"
if [[ "$FRONTEND_PORT" -ne 80 ]]; then
    FRONTEND_CURL="${FRONTEND_CURL}:${FRONTEND_PORT}"
fi

BACKEND_CURL="http://localhost"
if [[ "$BACKEND_PORT" -ne 80 ]]; then
    BACKEND_CURL="${BACKEND_CURL}:${BACKEND_PORT}"
fi

echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}  Nginx is now configured!${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""
echo "  Frontend Static URL: ${FRONTEND_DISPLAY_URL}"
echo "  Backend API Proxy  : ${BACKEND_DISPLAY_URL}"
echo "  Backend Direct     : http://127.0.0.1:3001"
echo ""
echo "  Next steps:"
echo "  1. Build the frontend:  cd frontend && npm run build"
echo "     (Make sure frontend/.env VITE_API_URL points to the backend API Proxy)"
echo "  2. Start the backend:   cd backend && npm start"
echo ""
echo "  Test API with:       curl ${BACKEND_CURL}/health"
echo "  Test Frontend with:  curl ${FRONTEND_CURL}"
echo ""
