<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class TenantUserController
{
    private Database $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    private function getTenantId(ServerRequestInterface $request): int
    {
        return (int)$request->getAttribute('tenant_data')['id'];
    }

    private function getAuthUser(ServerRequestInterface $request): array
    {
        return $request->getAttribute('auth_user');
    }

    private function canManageUsers(array $authUser): bool
    {
        return $authUser['is_admin'] || ($authUser['permissions']['create_users'] ?? false);
    }

    public function listUsers(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$this->canManageUsers($authUser)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $users = $this->db->fetchAll(
            'SELECT id, username, email, is_admin,
             perm_create_users, perm_create_persons, perm_create_events,
             perm_set_status, perm_create_mails, perm_send_mails,
             perm_create_rsvp, perm_edit_rsvp, created_at
             FROM tenant_users WHERE tenant_id = ? ORDER BY username',
            [$tenantId]
        );

        // Cast booleans
        foreach ($users as &$user) {
            $user['is_admin'] = (bool)$user['is_admin'];
            $user['perm_create_users'] = (bool)$user['perm_create_users'];
            $user['perm_create_persons'] = (bool)$user['perm_create_persons'];
            $user['perm_create_events'] = (bool)$user['perm_create_events'];
            $user['perm_set_status'] = (bool)$user['perm_set_status'];
            $user['perm_create_mails'] = (bool)$user['perm_create_mails'];
            $user['perm_send_mails'] = (bool)$user['perm_send_mails'];
            $user['perm_create_rsvp'] = (bool)$user['perm_create_rsvp'];
            $user['perm_edit_rsvp'] = (bool)$user['perm_edit_rsvp'];
        }

        return ResponseHelper::success($response, $users);
    }

    public function createUser(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$this->canManageUsers($authUser)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $body = $request->getParsedBody();
        $username = trim($body['username'] ?? '');
        $email = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';
        $isAdmin = (bool)($body['is_admin'] ?? false);

        if (!$username || !$email || !$password) {
            return ResponseHelper::error($response, 'Benutzername, E-Mail und Passwort sind erforderlich', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ResponseHelper::error($response, 'Ungültige E-Mail-Adresse', 400);
        }

        if (strlen($password) < 8) {
            return ResponseHelper::error($response, 'Passwort muss mindestens 8 Zeichen lang sein', 400);
        }

        $existing = $this->db->fetchOne(
            'SELECT id FROM tenant_users WHERE tenant_id = ? AND username = ?',
            [$tenantId, $username]
        );
        if ($existing) {
            return ResponseHelper::error($response, 'Benutzername bereits vergeben', 409);
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

        $userId = $this->db->insert(
            'INSERT INTO tenant_users (tenant_id, username, email, password_hash, is_admin,
             perm_create_users, perm_create_persons, perm_create_events, perm_set_status,
             perm_create_mails, perm_send_mails, perm_create_rsvp, perm_edit_rsvp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $tenantId, $username, $email, $passwordHash, $isAdmin ? 1 : 0,
                (bool)($body['perm_create_users'] ?? false) ? 1 : 0,
                (bool)($body['perm_create_persons'] ?? false) ? 1 : 0,
                (bool)($body['perm_create_events'] ?? false) ? 1 : 0,
                (bool)($body['perm_set_status'] ?? false) ? 1 : 0,
                (bool)($body['perm_create_mails'] ?? false) ? 1 : 0,
                (bool)($body['perm_send_mails'] ?? false) ? 1 : 0,
                (bool)($body['perm_create_rsvp'] ?? false) ? 1 : 0,
                (bool)($body['perm_edit_rsvp'] ?? false) ? 1 : 0,
            ]
        );

        $user = $this->db->fetchOne(
            'SELECT id, username, email, is_admin, created_at FROM tenant_users WHERE id = ?',
            [$userId]
        );

        return ResponseHelper::success($response, $user, 'Benutzer erstellt', 201);
    }

    public function updateUser(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);
        $userId = (int)$args['id'];

        if (!$this->canManageUsers($authUser)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $user = $this->db->fetchOne(
            'SELECT * FROM tenant_users WHERE id = ? AND tenant_id = ?',
            [$userId, $tenantId]
        );

        if (!$user) {
            return ResponseHelper::error($response, 'Benutzer nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        $email = trim($body['email'] ?? $user['email']);
        $isAdmin = isset($body['is_admin']) ? (bool)$body['is_admin'] : (bool)$user['is_admin'];

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ResponseHelper::error($response, 'Ungültige E-Mail-Adresse', 400);
        }

        $passwordHash = $user['password_hash'];
        if (!empty($body['password'])) {
            if (strlen($body['password']) < 8) {
                return ResponseHelper::error($response, 'Passwort muss mindestens 8 Zeichen lang sein', 400);
            }
            $passwordHash = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        }

        $this->db->execute(
            'UPDATE tenant_users SET email = ?, password_hash = ?, is_admin = ?,
             perm_create_users = ?, perm_create_persons = ?, perm_create_events = ?,
             perm_set_status = ?, perm_create_mails = ?, perm_send_mails = ?,
             perm_create_rsvp = ?, perm_edit_rsvp = ?
             WHERE id = ? AND tenant_id = ?',
            [
                $email, $passwordHash, $isAdmin ? 1 : 0,
                (bool)($body['perm_create_users'] ?? $user['perm_create_users']) ? 1 : 0,
                (bool)($body['perm_create_persons'] ?? $user['perm_create_persons']) ? 1 : 0,
                (bool)($body['perm_create_events'] ?? $user['perm_create_events']) ? 1 : 0,
                (bool)($body['perm_set_status'] ?? $user['perm_set_status']) ? 1 : 0,
                (bool)($body['perm_create_mails'] ?? $user['perm_create_mails']) ? 1 : 0,
                (bool)($body['perm_send_mails'] ?? $user['perm_send_mails']) ? 1 : 0,
                (bool)($body['perm_create_rsvp'] ?? $user['perm_create_rsvp']) ? 1 : 0,
                (bool)($body['perm_edit_rsvp'] ?? $user['perm_edit_rsvp']) ? 1 : 0,
                $userId, $tenantId,
            ]
        );

        $updated = $this->db->fetchOne(
            'SELECT id, username, email, is_admin, perm_create_users, perm_create_persons,
             perm_create_events, perm_set_status, perm_create_mails, perm_send_mails,
             perm_create_rsvp, perm_edit_rsvp, created_at
             FROM tenant_users WHERE id = ?',
            [$userId]
        );

        return ResponseHelper::success($response, $updated, 'Benutzer aktualisiert');
    }

    public function deleteUser(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);
        $userId = (int)$args['id'];

        if (!$this->canManageUsers($authUser)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        // Can't delete yourself
        if ($userId === (int)$authUser['sub']) {
            return ResponseHelper::error($response, 'Sie können sich nicht selbst löschen', 400);
        }

        $user = $this->db->fetchOne(
            'SELECT id FROM tenant_users WHERE id = ? AND tenant_id = ?',
            [$userId, $tenantId]
        );

        if (!$user) {
            return ResponseHelper::error($response, 'Benutzer nicht gefunden', 404);
        }

        $this->db->execute('DELETE FROM tenant_users WHERE id = ? AND tenant_id = ?', [$userId, $tenantId]);

        return ResponseHelper::success($response, null, 'Benutzer gelöscht');
    }

    public function updateTenantProfile(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin']) {
            return ResponseHelper::error($response, 'Nur Administratoren können das Mandantenprofil bearbeiten', 403);
        }

        $body = $request->getParsedBody();
        $name = trim($body['name'] ?? '');

        if (!$name) {
            return ResponseHelper::error($response, 'Name ist erforderlich', 400);
        }

        $this->db->execute(
            'UPDATE tenants SET name = ? WHERE id = ?',
            [$name, $tenantId]
        );

        return ResponseHelper::success($response, ['name' => $name], 'Mandantenprofil aktualisiert');
    }

    public function changePassword(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $authUser = $request->getAttribute('auth_user');
        $userId = (int)$authUser['sub'];

        $body = $request->getParsedBody();
        $currentPassword = $body['current_password'] ?? '';
        $newPassword = $body['new_password'] ?? '';

        if (!$currentPassword || !$newPassword) {
            return ResponseHelper::error($response, 'Aktuelles und neues Passwort sind erforderlich', 400);
        }

        if (strlen($newPassword) < 8) {
            return ResponseHelper::error($response, 'Neues Passwort muss mindestens 8 Zeichen lang sein', 400);
        }

        $user = $this->db->fetchOne('SELECT * FROM tenant_users WHERE id = ?', [$userId]);
        if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
            return ResponseHelper::error($response, 'Aktuelles Passwort ist falsch', 401);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
        $this->db->execute('UPDATE tenant_users SET password_hash = ? WHERE id = ?', [$newHash, $userId]);

        return ResponseHelper::success($response, null, 'Passwort erfolgreich geändert');
    }
}
