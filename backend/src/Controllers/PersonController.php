<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class PersonController
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

    public function listPersons(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $params = $request->getQueryParams();
        $search = trim($params['search'] ?? '');
        $page = max(1, (int)($params['page'] ?? 1));
        $limit = min(100, max(1, (int)($params['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;

        $where = 'WHERE tenant_id = ?';
        $queryParams = [$tenantId];

        if ($search) {
            $where .= ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
            $searchParam = '%' . $search . '%';
            $queryParams[] = $searchParam;
            $queryParams[] = $searchParam;
            $queryParams[] = $searchParam;
        }

        $total = $this->db->fetchOne(
            "SELECT COUNT(*) as cnt FROM persons $where",
            $queryParams
        )['cnt'];

        $persons = $this->db->fetchAll(
            "SELECT * FROM persons $where ORDER BY last_name, first_name LIMIT ? OFFSET ?",
            array_merge($queryParams, [$limit, $offset])
        );

        return ResponseHelper::success($response, [
            'data' => $persons,
            'total' => (int)$total,
            'page' => $page,
            'limit' => $limit,
            'pages' => (int)ceil($total / $limit),
        ]);
    }

    public function getPerson(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $id = (int)$args['id'];

        $person = $this->db->fetchOne(
            'SELECT * FROM persons WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        if (!$person) {
            return ResponseHelper::error($response, 'Person nicht gefunden', 404);
        }

        return ResponseHelper::success($response, $person);
    }

    public function createPerson(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_persons'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $body = $request->getParsedBody();
        $firstName = trim($body['first_name'] ?? '');
        $lastName = trim($body['last_name'] ?? '');
        $email = trim($body['email'] ?? '');
        $phone = trim($body['phone'] ?? '');
        $notes = trim($body['notes'] ?? '');
        $gender = in_array($body['gender'] ?? '', ['m', 'f', 'd']) ? $body['gender'] : null;

        if (!$firstName || !$lastName || !$email) {
            return ResponseHelper::error($response, 'Vorname, Nachname und E-Mail sind erforderlich', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ResponseHelper::error($response, 'Ungültige E-Mail-Adresse', 400);
        }

        $existing = $this->db->fetchOne(
            'SELECT id FROM persons WHERE tenant_id = ? AND first_name = ? AND last_name = ? AND email = ?',
            [$tenantId, $firstName, $lastName, $email]
        );

        if ($existing) {
            return ResponseHelper::error($response, 'Diese Person existiert bereits (Vorname, Nachname und E-Mail stimmen überein)', 409);
        }

        $id = $this->db->insert(
            'INSERT INTO persons (tenant_id, first_name, last_name, gender, email, phone, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$tenantId, $firstName, $lastName, $gender, $email, $phone ?: null, $notes ?: null]
        );

        $person = $this->db->fetchOne('SELECT * FROM persons WHERE id = ?', [$id]);
        return ResponseHelper::success($response, $person, 'Person erstellt', 201);
    }

    public function updatePerson(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);
        $id = (int)$args['id'];

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_persons'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $person = $this->db->fetchOne(
            'SELECT * FROM persons WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        if (!$person) {
            return ResponseHelper::error($response, 'Person nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        $firstName = trim($body['first_name'] ?? $person['first_name']);
        $lastName = trim($body['last_name'] ?? $person['last_name']);
        $email = trim($body['email'] ?? $person['email']);
        $phone = trim($body['phone'] ?? $person['phone'] ?? '');
        $notes = trim($body['notes'] ?? $person['notes'] ?? '');
        $gender = array_key_exists('gender', $body)
            ? (in_array($body['gender'], ['m', 'f', 'd']) ? $body['gender'] : null)
            : $person['gender'];

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ResponseHelper::error($response, 'Ungültige E-Mail-Adresse', 400);
        }

        $existing = $this->db->fetchOne(
            'SELECT id FROM persons WHERE tenant_id = ? AND first_name = ? AND last_name = ? AND email = ? AND id != ?',
            [$tenantId, $firstName, $lastName, $email, $id]
        );

        if ($existing) {
            return ResponseHelper::error($response, 'Diese Person existiert bereits (Vorname, Nachname und E-Mail stimmen überein)', 409);
        }

        $this->db->execute(
            'UPDATE persons SET first_name = ?, last_name = ?, gender = ?, email = ?, phone = ?, notes = ? WHERE id = ? AND tenant_id = ?',
            [$firstName, $lastName, $gender, $email, $phone ?: null, $notes ?: null, $id, $tenantId]
        );

        $updated = $this->db->fetchOne('SELECT * FROM persons WHERE id = ?', [$id]);
        return ResponseHelper::success($response, $updated, 'Person aktualisiert');
    }

    public function deletePerson(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);
        $id = (int)$args['id'];

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_persons'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $person = $this->db->fetchOne(
            'SELECT id FROM persons WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        if (!$person) {
            return ResponseHelper::error($response, 'Person nicht gefunden', 404);
        }

        $this->db->execute('DELETE FROM persons WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        return ResponseHelper::success($response, null, 'Person gelöscht');
    }

    public function importPersons(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_persons'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $body = $request->getParsedBody();
        $persons = $body['persons'] ?? [];

        if (!is_array($persons) || empty($persons)) {
            return ResponseHelper::error($response, 'Keine Personen angegeben', 400);
        }

        $imported = 0;
        $skipped = 0;
        $errors = [];

        foreach ($persons as $i => $p) {
            $firstName = trim($p['first_name'] ?? '');
            $lastName = trim($p['last_name'] ?? '');
            $email = trim($p['email'] ?? '');

            if (!$firstName || !$lastName || !$email) {
                $errors[] = "Zeile $i: Pflichtfelder fehlen";
                $skipped++;
                continue;
            }

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Zeile $i: Ungültige E-Mail $email";
                $skipped++;
                continue;
            }

            $existing = $this->db->fetchOne(
                'SELECT id FROM persons WHERE tenant_id = ? AND first_name = ? AND last_name = ? AND email = ?',
                [$tenantId, $firstName, $lastName, $email]
            );

            if ($existing) {
                $skipped++;
                continue;
            }

            $importGender = in_array($p['gender'] ?? '', ['m', 'f', 'd']) ? $p['gender'] : null;
            $this->db->insert(
                'INSERT INTO persons (tenant_id, first_name, last_name, gender, email, phone, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [$tenantId, $firstName, $lastName, $importGender, $email, $p['phone'] ?? null, $p['notes'] ?? null]
            );
            $imported++;
        }

        return ResponseHelper::success($response, [
            'imported' => $imported,
            'skipped' => $skipped,
            'errors' => $errors,
        ], "$imported Personen importiert");
    }
}
