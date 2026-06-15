<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class EventGuestController
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

    private function verifyEventOwnership(int $eventId, int $tenantId): array|false
    {
        return $this->db->fetchOne(
            'SELECT * FROM events WHERE id = ? AND tenant_id = ?',
            [$eventId, $tenantId]
        );
    }

    public function listGuests(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $params = $request->getQueryParams();
        $search = trim($params['search'] ?? '');
        $statusFilter = $params['status'] ?? '';

        $where = 'WHERE eg.event_id = ?';
        $queryParams = [$eventId];

        if ($search) {
            $where .= ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.email LIKE ?)';
            $s = '%' . $search . '%';
            $queryParams[] = $s;
            $queryParams[] = $s;
            $queryParams[] = $s;
        }

        if ($statusFilter) {
            $where .= ' AND eg.status = ?';
            $queryParams[] = $statusFilter;
        }

        $guests = $this->db->fetchAll(
            "SELECT eg.*, p.first_name, p.last_name, p.email, p.phone
             FROM event_guests eg
             JOIN persons p ON eg.person_id = p.id
             $where
             ORDER BY p.last_name, p.first_name",
            $queryParams
        );

        return ResponseHelper::success($response, $guests);
    }

    public function addGuests(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];
        $authUser = $this->getAuthUser($request);

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        $personIds = $body['person_ids'] ?? [];

        if (!is_array($personIds) || empty($personIds)) {
            return ResponseHelper::error($response, 'Keine Personen angegeben', 400);
        }

        $added = 0;
        $skipped = 0;

        foreach ($personIds as $personId) {
            $personId = (int)$personId;

            // Verify person belongs to tenant
            $person = $this->db->fetchOne(
                'SELECT id FROM persons WHERE id = ? AND tenant_id = ?',
                [$personId, $tenantId]
            );

            if (!$person) {
                $skipped++;
                continue;
            }

            // Check if already added
            $existing = $this->db->fetchOne(
                'SELECT id FROM event_guests WHERE event_id = ? AND person_id = ?',
                [$eventId, $personId]
            );

            if ($existing) {
                $skipped++;
                continue;
            }

            $this->db->insert(
                'INSERT INTO event_guests (event_id, person_id) VALUES (?, ?)',
                [$eventId, $personId]
            );
            $added++;
        }

        return ResponseHelper::success($response, [
            'added' => $added,
            'skipped' => $skipped,
        ], "$added Gäste hinzugefügt");
    }

    public function removeGuest(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];
        $guestId = (int)$args['guest_id'];

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $guest = $this->db->fetchOne(
            'SELECT id FROM event_guests WHERE id = ? AND event_id = ?',
            [$guestId, $eventId]
        );

        if (!$guest) {
            return ResponseHelper::error($response, 'Gast nicht gefunden', 404);
        }

        $this->db->execute('DELETE FROM event_guests WHERE id = ?', [$guestId]);
        return ResponseHelper::success($response, null, 'Gast entfernt');
    }

    public function updateGuestStatus(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];
        $guestId = (int)$args['guest_id'];
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['set_status'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        $status = $body['status'] ?? '';

        $validStatuses = ['angelegt', 'eingeladen', 'zugesagt', 'abgesagt'];
        if (!in_array($status, $validStatuses)) {
            return ResponseHelper::error($response, 'Ungültiger Status', 400);
        }

        $guest = $this->db->fetchOne(
            'SELECT id FROM event_guests WHERE id = ? AND event_id = ?',
            [$guestId, $eventId]
        );

        if (!$guest) {
            return ResponseHelper::error($response, 'Gast nicht gefunden', 404);
        }

        $this->db->execute(
            'UPDATE event_guests SET status = ? WHERE id = ?',
            [$status, $guestId]
        );

        return ResponseHelper::success($response, null, 'Status aktualisiert');
    }

    public function generateInvitationTokens(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['send_mails'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        $guestIds = $body['guest_ids'] ?? [];

        if (!is_array($guestIds) || empty($guestIds)) {
            return ResponseHelper::error($response, 'Keine Gäste angegeben', 400);
        }

        $expiry = date('Y-m-d H:i:s', strtotime('+30 days'));
        $updated = 0;

        foreach ($guestIds as $guestId) {
            $guestId = (int)$guestId;
            $guest = $this->db->fetchOne(
                'SELECT id FROM event_guests WHERE id = ? AND event_id = ?',
                [$guestId, $eventId]
            );

            if (!$guest) continue;

            $token = bin2hex(random_bytes(32));

            $this->db->execute(
                'UPDATE event_guests SET invitation_token = ?, token_expires_at = ? WHERE id = ?',
                [$token, $expiry, $guestId]
            );
            $updated++;
        }

        return ResponseHelper::success($response, ['updated' => $updated], "$updated Token(s) generiert");
    }

    public function getGuestAnswers(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];
        $guestId = (int)$args['guest_id'];

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $answers = $this->db->fetchAll(
            'SELECT ga.*, eq.question_text, eq.question_type
             FROM guest_answers ga
             JOIN event_questions eq ON ga.question_id = eq.id
             WHERE ga.event_guest_id = ?
             ORDER BY eq.sort_order',
            [$guestId]
        );

        return ResponseHelper::success($response, $answers);
    }

    public function exportGuests(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];

        $event = $this->verifyEventOwnership($eventId, $tenantId);
        if (!$event) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $guests = $this->db->fetchAll(
            'SELECT p.first_name, p.last_name, p.email, p.phone, eg.status, eg.invited_at, eg.responded_at
             FROM event_guests eg
             JOIN persons p ON eg.person_id = p.id
             WHERE eg.event_id = ?
             ORDER BY p.last_name, p.first_name',
            [$eventId]
        );

        // Also fetch answers for guests who accepted
        $questions = $this->db->fetchAll(
            'SELECT * FROM event_questions WHERE event_id = ? ORDER BY sort_order',
            [$eventId]
        );

        $statusLabels = [
            'angelegt' => 'Angelegt',
            'eingeladen' => 'Eingeladen',
            'zugesagt' => 'Zugesagt',
            'abgesagt' => 'Abgesagt',
        ];

        // Build CSV
        $output = fopen('php://temp', 'r+');

        // Header row
        $headers = ['Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Status', 'Eingeladen am', 'Geantwortet am'];
        foreach ($questions as $q) {
            $headers[] = $q['question_text'];
        }
        fputcsv($output, $headers, ';');

        // Get all guest IDs for answer lookup
        $guestIds = $this->db->fetchAll(
            'SELECT id, person_id FROM event_guests WHERE event_id = ?',
            [$eventId]
        );
        $guestIdMap = array_column($guestIds, 'id', 'person_id');

        foreach ($guests as $guest) {
            $row = [
                $guest['first_name'],
                $guest['last_name'],
                $guest['email'],
                $guest['phone'] ?? '',
                $statusLabels[$guest['status']] ?? $guest['status'],
                $guest['invited_at'] ? date('d.m.Y', strtotime($guest['invited_at'])) : '',
                $guest['responded_at'] ? date('d.m.Y', strtotime($guest['responded_at'])) : '',
            ];

            // Add answers for each question
            foreach ($questions as $q) {
                $guestRowId = null;
                foreach ($guestIds as $gi) {
                    if ($gi['person_id'] == $this->db->fetchOne(
                        'SELECT id FROM persons WHERE email = ? AND tenant_id = ?',
                        [$guest['email'], $tenantId]
                    )['id']) {
                        $guestRowId = $gi['id'];
                        break;
                    }
                }
                $answer = '';
                if ($guestRowId) {
                    $ans = $this->db->fetchOne(
                        'SELECT answer FROM guest_answers WHERE event_guest_id = ? AND question_id = ?',
                        [$guestRowId, $q['id']]
                    );
                    $answer = $ans['answer'] ?? '';
                }
                $row[] = $answer;
            }

            fputcsv($output, $row, ';');
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        $filename = 'gaesteliste_' . preg_replace('/[^a-z0-9]/i', '_', $event['name']) . '_' . date('Y-m-d') . '.csv';

        $response = $response
            ->withHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->withHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->withHeader('Pragma', 'no-cache');

        // Add BOM for Excel UTF-8 compatibility
        $response->getBody()->write("\xEF\xBB\xBF" . $csv);
        return $response;
    }

    public function getGuestStats(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $stats = $this->db->fetchOne(
            'SELECT
             COUNT(*) as total,
             SUM(CASE WHEN status = "angelegt" THEN 1 ELSE 0 END) as angelegt,
             SUM(CASE WHEN status = "eingeladen" THEN 1 ELSE 0 END) as eingeladen,
             SUM(CASE WHEN status = "zugesagt" THEN 1 ELSE 0 END) as zugesagt,
             SUM(CASE WHEN status = "abgesagt" THEN 1 ELSE 0 END) as abgesagt
             FROM event_guests WHERE event_id = ?',
            [$eventId]
        );

        return ResponseHelper::success($response, $stats);
    }
}
