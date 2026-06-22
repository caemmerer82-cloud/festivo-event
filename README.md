# Festivo-Event

A multi-tenant event management platform with RSVP, guest management, email templates, and customisable invitation pages.

## Features

- **Multi-tenant** – each organisation gets its own slug and isolated data
- **Guest management** – import persons, assign to events, track invitation status
- **RSVP page** – branded, customisable per-event with HTML greeting, H1–H4 headings
- **Email templates** – WYSIWYG editor, placeholders, inline banner images, auto-send on RSVP
- **Questionnaire** – attach questions (text, dropdown, radio, checkbox) to events
- **Permissions** – fine-grained per-user permission model
- **System admin** – manage tenants via a separate admin interface

---

## Quick-start (local development)

### Requirements
- PHP 8.0+, Composer
- Node.js 18+, npm
- MySQL / MariaDB

### 1 – Database
```bash
mysql -u root -e "CREATE DATABASE festivo_event CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root festivo_event < database/schema.sql
```

### 2 – Backend
```bash
cd backend
cp .env.example .env     # edit DB credentials, JWT_SECRET, APP_URL
composer install
php -S localhost:8080 -t public/
```

### 3 – Frontend
```bash
cd frontend
npm install
npm run dev              # Vite dev server on http://localhost:5173
```

Open **http://localhost:5173** and log in with the system-admin account you create first at `/admin/setup` (only available when no admin exists yet).

---

## Production deployment on Debian 12

### One-command install

```bash
# Minimal – uses server IP, no HTTPS
sudo bash -c "
  REPO_URL=https://github.com/caemmerer82-cloud/Festivo-Event.git \
  bash <(curl -fsSL https://raw.githubusercontent.com/caemmerer82-cloud/Festivo-Event/main/deploy/install.sh)
"

# With a real domain + automatic Let's Encrypt SSL
sudo bash -c "
  REPO_URL=https://github.com/caemmerer82-cloud/Festivo-Event.git \
  APP_DOMAIN=festivo-event.example.com \
  bash <(curl -fsSL https://raw.githubusercontent.com/caemmerer82-cloud/Festivo-Event/main/deploy/install.sh)
"
```

The installer will:
1. Install nginx, PHP 8.2-FPM, MariaDB, Node.js 20, Composer
2. Clone the repository to `/opt/festivo-event`
3. Create database + user with a random password
4. Write `/opt/festivo-event/backend/.env`
5. Install PHP & npm dependencies, build the React frontend
6. Configure nginx vhost and PHP-FPM pool
7. Optionally obtain a Let's Encrypt certificate

### Environment variables accepted by the installer

| Variable | Default | Description |
|---|---|---|
| `REPO_URL` | *(required)* | Git repository URL |
| `INSTALL_DIR` | `/opt/festivo-event` | Target directory |
| `APP_DOMAIN` | *(empty → IP)* | Domain name for nginx + certbot |
| `DB_NAME` | `festivo_event` | MariaDB database name |
| `DB_USER` | `festivo_event` | MariaDB user |
| `DB_PASS` | *(random)* | MariaDB password |
| `JWT_SECRET` | *(random)* | JWT signing secret |

### Updating

```bash
sudo bash /opt/festivo-event/deploy/update.sh
```

This pulls the latest code, reinstalls dependencies, rebuilds the frontend, and applies any new database migrations placed in `database/migrations/`.

---

## Project structure

```
festivo-event/
├── backend/              PHP 8 Slim 4 API
│   ├── public/           Document root (index.php)
│   ├── src/
│   │   ├── Controllers/
│   │   ├── Services/     MailService etc.
│   │   └── Database/
│   ├── .env.example
│   └── composer.json
├── frontend/             React + Vite + Tailwind
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── api/
│       └── types/
├── database/
│   ├── schema.sql        Full schema (destructive DROP + CREATE)
│   └── migrations/       Incremental *.sql files (applied by update.sh)
├── deploy/
│   ├── install.sh        One-click installer
│   ├── update.sh         Update script
│   └── nginx.conf        Reference nginx vhost
└── uploads/              User uploads (gitignored)
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, TipTap |
| Backend | PHP 8.2, Slim 4, PHP-DI |
| Mail | PHPMailer (SMTP + inline images) |
| Database | MariaDB / MySQL |
| Web server | Nginx + PHP-FPM |
| Auth | JWT (firebase/php-jwt) |

---

## License

MIT
