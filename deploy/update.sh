#!/usr/bin/env bash
# =============================================================================
#  Eventmanager – Update script
#  Usage: sudo bash /opt/eventmanager/deploy/update.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC}  $*"; }

INSTALL_DIR="${INSTALL_DIR:-/opt/eventmanager}"
BACKEND_DIR="$INSTALL_DIR/backend"
PHP_VERSION="8.2"

info "Pulling latest code…"
git -C "$INSTALL_DIR" pull --ff-only

info "Updating PHP dependencies…"
composer install --no-dev --optimize-autoloader --working-dir="$BACKEND_DIR" --quiet

info "Rebuilding frontend…"
cd "$INSTALL_DIR/frontend"
npm ci --silent
npm run build

info "Applying database migrations (if any)…"
# Place incremental migration files as database/migrations/NNN_description.sql
# and this loop will apply each once (tracked via a migrations table).
mysql -u root eventmanager 2>/dev/null <<'SQL' || true
CREATE TABLE IF NOT EXISTS _migrations (
  name VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
SQL
shopt -s nullglob
for f in "$INSTALL_DIR/database/migrations/"*.sql; do
    name="$(basename "$f")"
    exists=$(mysql -u root -sN eventmanager -e "SELECT COUNT(*) FROM _migrations WHERE name='$name'" 2>/dev/null || echo 0)
    if [[ "$exists" == "0" ]]; then
        info "Applying migration $name…"
        mysql -u root eventmanager < "$f"
        mysql -u root eventmanager -e "INSERT INTO _migrations (name) VALUES ('$name')"
    fi
done

info "Restarting services…"
systemctl restart "php${PHP_VERSION}-fpm"
systemctl reload nginx

info "Update complete!"
