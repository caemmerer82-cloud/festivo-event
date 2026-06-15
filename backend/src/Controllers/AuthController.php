<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\JwtHelper;
use App\Helpers\RateLimiter;
use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class AuthController
{
    private Database $db;
    private JwtHelper $jwt;
    private RateLimiter $rateLimiter;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->jwt = new JwtHelper();
        $this->rateLimiter = new RateLimiter(10, 60);
    }

    public function login(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        if (!$this->rateLimiter->isAllowed('login_' . $ip)) {
            return ResponseHelper::error($response, 'Zu viele Anfragen. Bitte warten.', 429);
        }

        $body = $request->getParsedBody();
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';
        $tenantSlug = $args['tenant'] ?? '';

        if (!$username || !$password) {
            return ResponseHelper::error($response, 'Benutzername und Passwort erforderlich', 400);
        }

        // Get tenant
        $tenant = $this->db->fetchOne(
            'SELECT id, slug, name, is_active FROM tenants WHERE slug = ?',
            [$tenantSlug]
        );

        if (!$tenant || !$tenant['is_active']) {
            return ResponseHelper::error($response, 'Mandant nicht gefunden', 404);
        }

        // Get user
        $user = $this->db->fetchOne(
            'SELECT * FROM tenant_users WHERE tenant_id = ? AND username = ?',
            [$tenant['id'], $username]
        );

        if (!$user || !password_verify($password, $user['password_hash'])) {
            return ResponseHelper::error($response, 'Ungültige Anmeldedaten', 401);
        }

        $token = $this->jwt->generate([
            'sub' => $user['id'],
            'role' => 'tenant_user',
            'tenant_id' => $tenant['id'],
            'tenant_slug' => $tenant['slug'],
            'tenant_name' => $tenant['name'],
            'username' => $user['username'],
            'email' => $user['email'],
            'is_admin' => (bool)$user['is_admin'],
            'permissions' => [
                'create_users' => (bool)$user['perm_create_users'],
                'create_persons' => (bool)$user['perm_create_persons'],
                'create_events' => (bool)$user['perm_create_events'],
                'set_status' => (bool)$user['perm_set_status'],
                'create_mails' => (bool)$user['perm_create_mails'],
                'send_mails' => (bool)$user['perm_send_mails'],
                'create_rsvp' => (bool)$user['perm_create_rsvp'],
                'edit_rsvp' => (bool)$user['perm_edit_rsvp'],
            ],
        ]);

        return ResponseHelper::success($response, [
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'email' => $user['email'],
                'is_admin' => (bool)$user['is_admin'],
                'tenant_slug' => $tenant['slug'],
                'tenant_name' => $tenant['name'],
            ],
        ], 'Erfolgreich angemeldet');
    }

    public function systemLogin(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        if (!$this->rateLimiter->isAllowed('system_login_' . $ip)) {
            return ResponseHelper::error($response, 'Zu viele Anfragen. Bitte warten.', 429);
        }

        $body = $request->getParsedBody();
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if (!$username || !$password) {
            return ResponseHelper::error($response, 'Benutzername und Passwort erforderlich', 400);
        }

        $admin = $this->db->fetchOne(
            'SELECT * FROM system_admins WHERE username = ?',
            [$username]
        );

        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            return ResponseHelper::error($response, 'Ungültige Anmeldedaten', 401);
        }

        $token = $this->jwt->generate([
            'sub' => $admin['id'],
            'role' => 'system_admin',
            'username' => $admin['username'],
        ]);

        return ResponseHelper::success($response, [
            'token' => $token,
            'user' => [
                'id' => $admin['id'],
                'username' => $admin['username'],
                'role' => 'system_admin',
            ],
        ], 'Erfolgreich angemeldet');
    }

    public function logout(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        // JWT is stateless; client removes token
        return ResponseHelper::success($response, null, 'Erfolgreich abgemeldet');
    }
}
