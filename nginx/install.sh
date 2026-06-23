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

# ---- Colour helpers ---------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

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

# Replace __FRONTEND_DIST__ with the absolute path and save to sites-available
sed "s|__FRONTEND_DIST__|${FRONTEND_DIST}|g" "$FRONTEND_CONF_SRC" > "$SITES_AVAILABLE/$FRONTEND_CONF_NAME"
info "Copied and updated frontend config → $SITES_AVAILABLE/$FRONTEND_CONF_NAME"

# ---- Copy Backend config to sites-available ---------------------------------
cp "$CONF_SRC" "$SITES_AVAILABLE/$CONF_NAME"
info "Copied backend config → $SITES_AVAILABLE/$CONF_NAME"

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

echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}  Nginx is now configured!${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""
echo "  Frontend Static URL: http://$(hostname -i | awk '{print $1}'):3000"
echo "  Backend API Proxy  : http://$(hostname -i | awk '{print $1}'):8080"
echo "  Backend Direct     : http://127.0.0.1:3001"
echo ""
echo "  Next steps:"
echo "  1. Build the frontend:  cd frontend && npm run build"
echo "     (Make sure frontend/.env VITE_API_URL points to the backend API Proxy)"
echo "  2. Start the backend:   cd backend && npm start"
echo ""
echo "  Test API with:       curl http://localhost:8080/health"
echo "  Test Frontend with:  curl http://localhost:3000"
echo ""
