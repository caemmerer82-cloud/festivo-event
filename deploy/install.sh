#!/usr/bin/env bash
# =============================================================================
#  Eventmanager – 1-Click Installer for Debian 12 (Bookworm)
#  Usage:  curl -fsSL https://raw.githubusercontent.com/YOUR_USER/eventmanager/main/deploy/install.sh | sudo bash
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
REPO_URL="${REPO_URL:-https://github.com/YOUR_USER/eventmanager.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/eventmanager}"
APP_DOMAIN="${APP_DOMAIN:-}"          # e.g. eventmanager.example.com – leave empty for IP-only
DB_NAME="${DB_NAME:-eventmanager}"
DB_USER="${DB_USER:-eventmanager}"
DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
PHP_VERSION="8.2"
NODE_MAJOR="20"

# ── Derived paths ─────────────────────────────────────────────────────────────
BACKEND_DIR="$INSTALL_DIR/backend"
FRONTEND_DIST="$INSTALL_DIR/frontend/dist"
UPLOAD_DIR="$INSTALL_DIR/uploads"
NGINX_CONF="/etc/nginx/sites-available/eventmanager"

section "System update & base packages"
apt-get update -q
apt-get install -y -q \
    curl wget gnupg2 ca-certificates lsb-release \
    git unzip software-properties-common apt-transport-https

# ── PHP 8.2 ──────────────────────────────────────────────────────────────────
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

# ── Clone / update repository ─────────────────────────────────────────────────
section "Application code"
if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Pulling latest changes…"
    git -C "$INSTALL_DIR" pull --ff-only
else
    info "Cloning $REPO_URL → $INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
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
PUBLIC_URL="http://$(hostname -I | awk '{print $1}')"
[[ -n "$APP_DOMAIN" ]] && PUBLIC_URL="https://$APP_DOMAIN"

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
FRONTEND_URL=${PUBLIC_URL}
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
cat > "/etc/php/${PHP_VERSION}/fpm/pool.d/eventmanager.conf" <<FPM
[eventmanager]
user  = www-data
group = www-data
listen = /run/php/php${PHP_VERSION}-fpm-eventmanager.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children     = 10
pm.start_servers    = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 4
php_admin_value[error_log] = /var/log/php-eventmanager-error.log
FPM
systemctl restart "php${PHP_VERSION}-fpm"
info "PHP-FPM pool configured"

# ── Nginx vhost ───────────────────────────────────────────────────────────────
section "Nginx vhost"
SERVER_NAME="${APP_DOMAIN:-_}"
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

    # API → PHP-FPM
    location /api/ {
        alias ${BACKEND_DIR}/public/;
        try_files \$uri /api/index.php\$is_args\$args;

        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/run/php/php${PHP_VERSION}-fpm-eventmanager.sock;
            fastcgi_param SCRIPT_FILENAME ${BACKEND_DIR}/public/index.php;
        }
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Upload size
    client_max_body_size 11M;

    access_log /var/log/nginx/eventmanager-access.log;
    error_log  /var/log/nginx/eventmanager-error.log;
}
NGINX
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/eventmanager
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
info "Nginx vhost active"

# ── Optional: Let's Encrypt ───────────────────────────────────────────────────
if [[ -n "$APP_DOMAIN" ]]; then
    section "SSL (Let's Encrypt)"
    if ! command -v certbot &>/dev/null; then
        apt-get install -y -q certbot python3-certbot-nginx
    fi
    certbot --nginx -d "$APP_DOMAIN" --non-interactive --agree-tos -m "admin@${APP_DOMAIN}" || \
        warn "Certbot failed – run manually: certbot --nginx -d $APP_DOMAIN"
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
    echo "  2. SSL should be configured. Verify at https://$APP_DOMAIN"
else
    echo "  2. To enable HTTPS, set APP_DOMAIN and re-run, or run certbot manually."
fi
echo ""
