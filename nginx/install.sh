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

# ---- Copy config to sites-available -----------------------------------------
cp "$CONF_SRC" "$SITES_AVAILABLE/$CONF_NAME"
info "Copied config → $SITES_AVAILABLE/$CONF_NAME"

# ---- Enable the site via symlink --------------------------------------------
ln -sf "$SITES_AVAILABLE/$CONF_NAME" "$SITES_ENABLED/$CONF_NAME"
info "Enabled site → $SITES_ENABLED/$CONF_NAME"

# ---- Test the configuration -------------------------------------------------
info "Testing Nginx configuration..."
nginx -t || error "Nginx config test failed. Fix the errors above and re-run."

# ---- Reload or start Nginx --------------------------------------------------
if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    info "Nginx reloaded successfully."
else
    systemctl enable --now nginx
    info "Nginx started and enabled on boot."
fi

echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}  Nginx is now configured!${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""
echo "  Public entry point : http://$(hostname -i | awk '{print $1}'):8080"
echo "  Backend proxied to : http://127.0.0.1:3001"
echo ""
echo "  Next steps:"
echo "  1. Start the backend:  cd backend && npm start"
echo "  2. Point your frontend VITE_API_URL to:"
echo "     http://$(hostname -i | awk '{print $1}'):8080"
echo ""
echo "  Test with:  curl http://localhost:8080/health"
echo ""
