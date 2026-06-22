#!/usr/bin/env bash
# =============================================================================
#  Festivo-Event – 1-Click Installer for Debian 12 (Bookworm)
#  Usage:  curl -fsSL https://raw.githubusercontent.com/YOUR_USER/festivo-event/main/deploy/install.sh | sudo bash
# =============================================================================
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
section() { echo -e "\n${GREEN}━━━ $* ━━━${NC}"; }

# ── Root check ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Please run as root (sudo)."

# ── Config (edit before running, or set as env vars) ─────────────────────────
REPO_URL="${REPO_URL:-https://github.com/caemmerer82-cloud/festivo-event.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/festivo-event}"
APP_DOMAIN="${APP_DOMAIN:-}"          # e.g. "festivo-event.de,www.festivo-event.de" – leave empty for IP-only
DB_NAME="${DB_NAME:-festivo_event}"
DB_USER="${DB_USER:-festivo_event}"
DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
PHP_VERSION="8.2"
NODE_MAJOR="20"

# ── Derived paths ─────────────────────────────────────────────────────────────
BACKEND_DIR="$INSTALL_DIR/backend"
FRONTEND_DIST="$INSTALL_DIR/frontend/dist"
UPLOAD_DIR="$INSTALL_DIR/uploads"
NGINX_CONF="/etc/nginx/sites-available/festivo-event"

section "System update & base packages"
apt-get update -q
apt-get install -y -q \
    curl wget gnupg2 ca-certificates lsb-release \
    git unzip apt-transport-https

# ── PHP 8.2 (via packages.sury.org – Debian native) ──────────────────────────
section "PHP $PHP_VERSION"
if ! dpkg -l | grep -q "php${PHP_VERSION}-fpm"; then
    curl -fsSL "https://packages.sury.org/php/apt.gpg" \
        | gpg --dearmor -o /usr/share/keyrings/php.gpg
    echo "deb [signed-by=/usr/share/keyrings/php.gpg] https://packages.sury.org/php/ $(lsb_release -sc) main" \
        > /etc/apt/sources.list.d/php.list
    apt-get update -q
fi
apt-get install -y -q \
    "php${PHP_VERSION}-fpm" \
    "php${PHP_VERSION}-mysql" \
    "php${PHP_VERSION}-mbstring" \
    "php${PHP_VERSION}-xml" \
    "php${PHP_VERSION}-curl" \
    "php${PHP_VERSION}-zip" \
    "php${PHP_VERSION}-intl"
info "PHP $(php -r 'echo PHP_VERSION;') installed"

# ── Composer ─────────────────────────────────────────────────────────────────
section "Composer"
if ! command -v composer &>/dev/null; then
    EXPECTED_CHECKSUM="$(php -r 'copy("https://composer.github.io/installer.sig", "php://stdout");')"
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
    ACTUAL_CHECKSUM="$(php -r "echo hash_file('sha384', 'composer-setup.php');")"
    [[ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]] && { rm composer-setup.php; error "Invalid Composer installer checksum"; }
    php composer-setup.php --install-dir=/usr/local/bin --filename=composer --quiet
    rm composer-setup.php
fi
info "Composer $(composer --version --no-ansi | head -1) installed"

# ── Node.js ───────────────────────────────────────────────────────────────────
section "Node.js $NODE_MAJOR"
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.version.split(".")[0].slice(1))')" -lt "$NODE_MAJOR" ]]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y -q nodejs
fi
info "Node $(node --version) / npm $(npm --version) installed"

# ── MariaDB ───────────────────────────────────────────────────────────────────
section "MariaDB"
apt-get install -y -q mariadb-server mariadb-client
systemctl enable --now mariadb
info "MariaDB $(mariadb --version | head -1) ready"

# ── Nginx ─────────────────────────────────────────────────────────────────────
section "Nginx"
apt-get install -y -q nginx
systemctl enable nginx
systemctl start nginx || true

# ── Clone / update repository ─────────────────────────────────────────────────
section "Application code"
if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Pulling latest changes…"
    git -C "$INSTALL_DIR" config core.fileMode false
    GIT_TERMINAL_PROMPT=0 git -C "$INSTALL_DIR" pull --ff-only
else
    info "Cloning $REPO_URL → $INSTALL_DIR"
    GIT_TERMINAL_PROMPT=0 git clone "$REPO_URL" "$INSTALL_DIR" \
        || error "Clone fehlgeschlagen. Bei privatem Repo: SSH-Key hinterlegen und REPO_URL=git@github.com:caemmerer82-cloud/festivo-event.git setzen."
    # chmod -R below changes file permission bits, which git tracks by default
    # and would otherwise show every file as "modified" on the next pull.
    git -C "$INSTALL_DIR" config core.fileMode false
fi

# ── Database setup ────────────────────────────────────────────────────────────
section "Database"
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
mysql -u root "$DB_NAME" < "$INSTALL_DIR/database/schema.sql"
info "Database '$DB_NAME' ready"

# ── Backend .env ──────────────────────────────────────────────────────────────
section "Backend configuration"
PUBLIC_URL="https://$(hostname -I | awk '{print $1}')"
ALL_ORIGINS="$PUBLIC_URL"
if [[ -n "$APP_DOMAIN" ]]; then
    PUBLIC_URL="https://$(echo "$APP_DOMAIN" | cut -d',' -f1)"
    ALL_ORIGINS=""
    for d in ${APP_DOMAIN//,/ }; do ALL_ORIGINS+="https://$d,"; done
    ALL_ORIGINS="${ALL_ORIGINS%,}"
fi

cat > "$BACKEND_DIR/.env" <<ENV
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=86400

UPLOAD_DIR=${UPLOAD_DIR}
MAX_UPLOAD_SIZE=10485760

APP_URL=${PUBLIC_URL}
FRONTEND_URL=${ALL_ORIGINS}
ENV
info "Backend .env written"

# ── Composer dependencies ─────────────────────────────────────────────────────
section "PHP dependencies"
composer install --no-dev --optimize-autoloader --working-dir="$BACKEND_DIR" --quiet
info "Composer packages installed"

# ── Frontend build ────────────────────────────────────────────────────────────
section "Frontend build"
cd "$INSTALL_DIR/frontend"
npm ci --silent
VITE_API_BASE="" npm run build
info "Frontend built → $FRONTEND_DIST"

# ── Uploads directory ─────────────────────────────────────────────────────────
mkdir -p "$UPLOAD_DIR"
chown -R "www-data:www-data" "$UPLOAD_DIR" "$INSTALL_DIR/backend"
chmod -R 750 "$INSTALL_DIR/backend"
chmod -R 770 "$UPLOAD_DIR"

# ── PHP-FPM pool ──────────────────────────────────────────────────────────────
section "PHP-FPM pool"
cat > "/etc/php/${PHP_VERSION}/fpm/pool.d/festivo-event.conf" <<FPM
[festivo-event]
user  = www-data
group = www-data
listen = /run/php/php${PHP_VERSION}-fpm-festivo-event.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children     = 10
pm.start_servers    = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 4
php_admin_value[error_log] = /var/log/php-festivo-event-error.log
FPM
systemctl restart "php${PHP_VERSION}-fpm"
info "PHP-FPM pool configured"

# ── Nginx vhost ───────────────────────────────────────────────────────────────
section "Nginx vhost"
# APP_DOMAIN may be a comma-separated list, e.g. "festivo-event.de,www.festivo-event.de"
SERVER_NAME="${APP_DOMAIN//,/ }"
SERVER_NAME="${SERVER_NAME:-_}"
CERTBOT_DOMAIN_ARGS=""
for d in ${APP_DOMAIN//,/ }; do CERTBOT_DOMAIN_ARGS+="-d $d "; done
PRIMARY_DOMAIN="$(echo "$APP_DOMAIN" | cut -d',' -f1)"
cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${FRONTEND_DIST};
    index index.html;

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API → PHP-FPM (Slim 4 – all requests go to index.php)
    location /api/ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php${PHP_VERSION}-fpm-festivo-event.sock;
        fastcgi_param SCRIPT_FILENAME ${BACKEND_DIR}/public/index.php;
        fastcgi_param REQUEST_URI \$request_uri;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Upload size
    client_max_body_size 11M;

    access_log /var/log/nginx/festivo-event-access.log;
    error_log  /var/log/nginx/festivo-event-error.log;
}
NGINX
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/festivo-event
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
info "Nginx vhost active"

# ── HTTPS ──────────────────────────────────────────────────────────────────────
if [[ -n "$APP_DOMAIN" ]]; then
    section "SSL (Let's Encrypt)"
    if ! command -v certbot &>/dev/null; then
        apt-get install -y -q certbot python3-certbot-nginx
    fi
    certbot --nginx $CERTBOT_DOMAIN_ARGS --non-interactive --agree-tos -m "admin@${PRIMARY_DOMAIN}" || \
        warn "Certbot failed – run manually: certbot --nginx $CERTBOT_DOMAIN_ARGS"
    PUBLIC_URL="https://$PRIMARY_DOMAIN"

    # Certbot's generated HTTP block returns 404 for any Host that isn't one
    # of the configured domains, which blocks access via the local IP/LAN.
    # Add a separate catch-all vhost so the server stays reachable internally.
    cat > /etc/nginx/sites-available/festivo-event-internal <<NGINX
server {
    listen 80 default_server;
    server_name _;

    root ${FRONTEND_DIST};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php${PHP_VERSION}-fpm-festivo-event.sock;
        fastcgi_param SCRIPT_FILENAME ${BACKEND_DIR}/public/index.php;
        fastcgi_param REQUEST_URI \$request_uri;
    }

    client_max_body_size 11M;
}
NGINX
    ln -sf /etc/nginx/sites-available/festivo-event-internal /etc/nginx/sites-enabled/festivo-event-internal
    nginx -t && systemctl reload nginx
    info "Internal LAN access via http://$(hostname -I | awk '{print $1}') still works"
else
    section "SSL (self-signed certificate – no domain set)"
    SSL_DIR="/etc/ssl/festivo-event"
    mkdir -p "$SSL_DIR"
    SERVER_IP="$(hostname -I | awk '{print $1}')"
    if [[ ! -f "$SSL_DIR/fullchain.pem" ]]; then
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout "$SSL_DIR/privkey.pem" \
            -out "$SSL_DIR/fullchain.pem" \
            -subj "/CN=${SERVER_IP}" \
            -addext "subjectAltName=IP:${SERVER_IP}" 2>/dev/null
        info "Self-signed certificate created for $SERVER_IP (browsers will show a warning – that's expected without a real domain)"
    fi

    cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    server_name ${SERVER_NAME};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${SERVER_NAME};

    ssl_certificate     ${SSL_DIR}/fullchain.pem;
    ssl_certificate_key ${SSL_DIR}/privkey.pem;

    root ${FRONTEND_DIST};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php${PHP_VERSION}-fpm-festivo-event.sock;
        fastcgi_param SCRIPT_FILENAME ${BACKEND_DIR}/public/index.php;
        fastcgi_param REQUEST_URI \$request_uri;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    client_max_body_size 11M;

    access_log /var/log/nginx/festivo-event-access.log;
    error_log  /var/log/nginx/festivo-event-error.log;
}
NGINX
    nginx -t && systemctl restart nginx
    PUBLIC_URL="https://${SERVER_IP}"
    info "HTTPS active on port 443 (self-signed), HTTP redirects automatically"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
section "Installation complete"
echo ""
echo -e "  ${GREEN}App URL:${NC}     ${PUBLIC_URL}"
echo -e "  ${GREEN}Install dir:${NC} ${INSTALL_DIR}"
echo -e "  ${GREEN}DB name:${NC}     ${DB_NAME}"
echo -e "  ${GREEN}DB user:${NC}     ${DB_USER}"
echo -e "  ${GREEN}DB pass:${NC}     ${DB_PASS}"
echo -e "  ${GREEN}JWT secret:${NC}  (saved to ${BACKEND_DIR}/.env)"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo "  1. Create your first admin account via the web interface."
if [[ -n "$APP_DOMAIN" ]]; then
    echo "  2. SSL should be configured. Verify at https://$PRIMARY_DOMAIN"
else
    echo "  2. To enable HTTPS, set APP_DOMAIN and re-run, or run certbot manually."
fi
echo ""
