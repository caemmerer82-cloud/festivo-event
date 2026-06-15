<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class SystemAdminController
{
    private Database $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public function listTenants(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenants = $this->db->fetchAll(
            'SELECT t.*,
             (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = t.id) as user_count,
             (SELECT COUNT(*) FROM events WHERE tenant_id = t.id) as event_count
             FROM tenants t ORDER BY t.created_at DESC'
        );

        return ResponseHelper::success($response, $tenants);
    }

    public function createTenant(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = $request->getParsedBody();
        $name = trim($body['name'] ?? '');
        $slug = trim($body['slug'] ?? '');
        $adminUsername = trim($body['admin_username'] ?? '');
        $adminEmail = trim($body['admin_email'] ?? '');
        $adminPassword = $body['admin_password'] ?? '';

        if (!$name || !$slug || !$adminUsername || !$adminEmail || !$adminPassword) {
            return ResponseHelper::error($response, 'Alle Felder sind erforderlich', 400);
        }

        if (!preg_match('/^[a-z0-9-]+$/', $slug)) {
            return ResponseHelper::error($response, 'Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten', 400);
        }

        if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
            return ResponseHelper::error($response, 'Ungültige E-Mail-Adresse', 400);
        }

        if (strlen($adminPassword) < 8) {
            return ResponseHelper::error($response, 'Passwort muss mindestens 8 Zeichen lang sein', 400);
        }

        // Check slug uniqueness
        $existing = $this->db->fetchOne('SELECT id FROM tenants WHERE slug = ?', [$slug]);
        if ($existing) {
            return ResponseHelper::error($response, 'Slug bereits vergeben', 409);
        }

        // Create tenant
        $tenantId = $this->db->insert(
            'INSERT INTO tenants (slug, name) VALUES (?, ?)',
            [$slug, $name]
        );

        // Create tenant admin
        $passwordHash = password_hash($adminPassword, PASSWORD_BCRYPT, ['cost' => 12]);
        $this->db->insert(
            'INSERT INTO tenant_users (tenant_id, username, email, password_hash, is_admin) VALUES (?, ?, ?, ?, 1)',
            [$tenantId, $adminUsername, $adminEmail, $passwordHash]
        );

        $tenant = $this->db->fetchOne('SELECT * FROM tenants WHERE id = ?', [$tenantId]);

        return ResponseHelper::success($response, $tenant, 'Mandant erfolgreich erstellt', 201);
    }

    public function updateTenant(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $id = (int)$args['id'];
        $body = $request->getParsedBody();

        $tenant = $this->db->fetchOne('SELECT * FROM tenants WHERE id = ?', [$id]);
        if (!$tenant) {
            return ResponseHelper::error($response, 'Mandant nicht gefunden', 404);
        }

        $name = trim($body['name'] ?? $tenant['name']);
        $isActive = isset($body['is_active']) ? (bool)$body['is_active'] : (bool)$tenant['is_active'];

        $this->db->execute(
            'UPDATE tenants SET name = ?, is_active = ? WHERE id = ?',
            [$name, $isActive ? 1 : 0, $id]
        );

        $updated = $this->db->fetchOne('SELECT * FROM tenants WHERE id = ?', [$id]);
        return ResponseHelper::success($response, $updated, 'Mandant aktualisiert');
    }

    public function deleteTenant(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $id = (int)$args['id'];

        $tenant = $this->db->fetchOne('SELECT * FROM tenants WHERE id = ?', [$id]);
        if (!$tenant) {
            return ResponseHelper::error($response, 'Mandant nicht gefunden', 404);
        }

        $this->db->execute('DELETE FROM tenants WHERE id = ?', [$id]);

        return ResponseHelper::success($response, null, 'Mandant gelöscht');
    }

    public function resetTenantAdminPassword(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $id = (int)$args['id'];
        $body = $request->getParsedBody();
        $newPassword = $body['new_password'] ?? '';

        if (strlen($newPassword) < 8) {
            return ResponseHelper::error($response, 'Passwort muss mindestens 8 Zeichen lang sein', 400);
        }

        $tenant = $this->db->fetchOne('SELECT id FROM tenants WHERE id = ?', [$id]);
        if (!$tenant) {
            return ResponseHelper::error($response, 'Mandant nicht gefunden', 404);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);

        // Reset all admin passwords for this tenant
        $this->db->execute(
            'UPDATE tenant_users SET password_hash = ? WHERE tenant_id = ? AND is_admin = 1',
            [$passwordHash, $id]
        );

        return ResponseHelper::success($response, null, 'Passwort zurückgesetzt');
    }

    public function getTenant(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $id = (int)$args['id'];
        $tenant = $this->db->fetchOne('SELECT * FROM tenants WHERE id = ?', [$id]);

        if (!$tenant) {
            return ResponseHelper::error($response, 'Mandant nicht gefunden', 404);
        }

        return ResponseHelper::success($response, $tenant);
    }
}
