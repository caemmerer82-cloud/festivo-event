# Event Manager – Setup

## Voraussetzungen
- PHP 8.2+, Composer
- Node.js 18+, npm
- MariaDB / MySQL

## 1. Datenbank

```sql
CREATE DATABASE eventmanager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
mysql -u root -p eventmanager < database/schema.sql
```

## 2. Backend

```bash
cd backend
cp .env.example .env
# .env anpassen: DB-Zugangsdaten, JWT_SECRET (langer zufälliger String)
composer install

# PHP Built-in Server (Entwicklung):
php -S localhost:8080 -t public/
```

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Läuft auf http://localhost:5173
# API-Proxy zeigt auf http://localhost:8080
```

## 4. Erste Anmeldung

- System-Admin: http://localhost:5173/admin/login
  - Benutzer: `admin`, Passwort: `password` (aus schema.sql INSERT)
- Tenant-Login: http://localhost:5173/{slug}/login

**Wichtig:** Standard-Passwort sofort ändern!

## Produktionsdeployment

- Apache/Nginx mit mod_rewrite für backend/public/
- Frontend: `npm run build` → dist/ auf Webserver
- `APP_URL` und `FRONTEND_URL` in backend/.env setzen
- Upload-Verzeichnis `backend/uploads/` außerhalb des Web-Roots

## Verzeichnisstruktur

```
backend/
  public/        ← Web-Root für Apache/Nginx
  src/           ← PHP-Quellcode
  uploads/       ← Datei-Uploads (außerhalb Web-Root)
database/
  schema.sql     ← Datenbank-Schema
frontend/
  src/           ← React/TypeScript-Quellcode
  dist/          ← Build-Output
```
