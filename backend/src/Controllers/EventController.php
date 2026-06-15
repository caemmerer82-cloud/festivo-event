<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class EventController
{
    private Database $db;
    private string $uploadDir;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->uploadDir = rtrim($_ENV['UPLOAD_DIR'] ?? '../uploads', '/');
    }

    private function getTenantId(ServerRequestInterface $request): int
    {
        return (int)$request->getAttribute('tenant_data')['id'];
    }

    private function getAuthUser(ServerRequestInterface $request): array
    {
        return $request->getAttribute('auth_user');
    }

    public function getDashboardStats(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);

        $eventCount = $this->db->fetchOne('SELECT COUNT(*) as cnt FROM events WHERE tenant_id = ?', [$tenantId])['cnt'];
        $personCount = $this->db->fetchOne('SELECT COUNT(*) as cnt FROM persons WHERE tenant_id = ?', [$tenantId])['cnt'];

        $guestStats = $this->db->fetchOne(
            'SELECT
             COUNT(*) as total_invitations,
             SUM(CASE WHEN eg.status = "zugesagt" THEN 1 ELSE 0 END) as total_confirmed,
             SUM(CASE WHEN eg.status = "abgesagt" THEN 1 ELSE 0 END) as total_declined,
             SUM(CASE WHEN eg.status = "eingeladen" THEN 1 ELSE 0 END) as total_invited
             FROM event_guests eg
             JOIN events e ON eg.event_id = e.id
             WHERE e.tenant_id = ?',
            [$tenantId]
        );

        // Upcoming events (next 5)
        $upcoming = $this->db->fetchAll(
            'SELECT e.id, e.name, e.event_date, e.location,
             (SELECT COUNT(*) FROM event_guests WHERE event_id = e.id) as guest_count,
             (SELECT COUNT(*) FROM event_guests WHERE event_id = e.id AND status = "zugesagt") as confirmed_count,
             (SELECT COUNT(*) FROM event_guests WHERE event_id = e.id AND status = "eingeladen") as invited_count
             FROM events e WHERE tenant_id = ? AND event_date >= NOW()
             ORDER BY event_date ASC LIMIT 5',
            [$tenantId]
        );

        // Recent events (last 5)
        $recent = $this->db->fetchAll(
            'SELECT e.id, e.name, e.event_date, e.location,
             (SELECT COUNT(*) FROM event_guests WHERE event_id = e.id) as guest_count,
             (SELECT COUNT(*) FROM event_guests WHERE event_id = e.id AND status = "zugesagt") as confirmed_count
             FROM events e WHERE tenant_id = ? AND event_date < NOW()
             ORDER BY event_date DESC LIMIT 5',
            [$tenantId]
        );

        return ResponseHelper::success($response, [
            'events' => (int)$eventCount,
            'persons' => (int)$personCount,
            'total_invitations' => (int)($guestStats['total_invitations'] ?? 0),
            'total_confirmed' => (int)($guestStats['total_confirmed'] ?? 0),
            'total_declined' => (int)($guestStats['total_declined'] ?? 0),
            'total_invited' => (int)($guestStats['total_invited'] ?? 0),
            'upcoming_events' => $upcoming,
            'recent_events' => $recent,
        ]);
    }

    public function listEvents(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $params = $request->getQueryParams();
        $page = max(1, (int)($params['page'] ?? 1));
        $limit = min(100, max(1, (int)($params['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $total = $this->db->fetchOne(
            'SELECT COUNT(*) as cnt FROM events WHERE tenant_id = ?',
            [$tenantId]
        )['cnt'];

        $events = $this->db->fetchAll(
            'SELECT e.*,
             (SELECT COUNT(*) FROM event_guests WHERE event_id = e.id) as guest_count,
             (SELECT COUNT(*) FROM event_guests WHERE event_id = e.id AND status = "zugesagt") as confirmed_count,
             (SELECT COUNT(*) FROM event_guests WHERE event_id = e.id AND status = "abgesagt") as declined_count,
             (SELECT COUNT(*) FROM event_guests WHERE event_id = e.id AND status = "eingeladen") as invited_count
             FROM events e WHERE tenant_id = ? ORDER BY event_date DESC LIMIT ? OFFSET ?',
            [$tenantId, $limit, $offset]
        );

        return ResponseHelper::success($response, [
            'data' => $events,
            'total' => (int)$total,
            'page' => $page,
            'limit' => $limit,
            'pages' => (int)ceil($total / $limit),
        ]);
    }

    public function getEvent(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $id = (int)$args['id'];

        $event = $this->db->fetchOne(
            'SELECT * FROM events WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        if (!$event) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $event['questions'] = $this->db->fetchAll(
            'SELECT * FROM event_questions WHERE event_id = ? ORDER BY sort_order',
            [$id]
        );

        foreach ($event['questions'] as &$q) {
            if ($q['options']) {
                $q['options'] = json_decode($q['options'], true);
            }
            $q['is_required'] = (bool)$q['is_required'];
        }

        return ResponseHelper::success($response, $event);
    }

    public function createEvent(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_events'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $body = $request->getParsedBody();
        $name = trim($body['name'] ?? '');
        $description = trim($body['description'] ?? '');
        $location = trim($body['location'] ?? '');
        $eventDate = trim($body['event_date'] ?? '');

        if (!$name || !$eventDate) {
            return ResponseHelper::error($response, 'Name und Datum sind erforderlich', 400);
        }

        if (!strtotime($eventDate)) {
            return ResponseHelper::error($response, 'Ungültiges Datum', 400);
        }

        $bannerPath = null;
        $attachmentPath = null;
        $attachmentFilename = null;

        // Handle file uploads
        $uploadedFiles = $request->getUploadedFiles();

        try {
            if (isset($uploadedFiles['banner']) && $uploadedFiles['banner']->getError() === UPLOAD_ERR_OK) {
                $bannerPath = $this->handleFileUpload($uploadedFiles['banner'], $tenantId, ['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
            }

            if (isset($uploadedFiles['attachment']) && $uploadedFiles['attachment']->getError() === UPLOAD_ERR_OK) {
                $attachmentPath = $this->handleFileUpload($uploadedFiles['attachment'], $tenantId, [
                    'application/pdf', 'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'image/jpeg', 'image/png',
                ]);
                $attachmentFilename = $uploadedFiles['attachment']->getClientFilename();
            }
        } catch (\InvalidArgumentException $e) {
            return ResponseHelper::error($response, $e->getMessage(), 400);
        }

        $id = $this->db->insert(
            'INSERT INTO events (tenant_id, name, description, location, event_date, banner_path, attachment_path, attachment_filename)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$tenantId, $name, $description ?: null, $location ?: null, $eventDate, $bannerPath, $attachmentPath, $attachmentFilename]
        );

        $event = $this->db->fetchOne('SELECT * FROM events WHERE id = ?', [$id]);
        return ResponseHelper::success($response, $event, 'Veranstaltung erstellt', 201);
    }

    public function updateEvent(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);
        $id = (int)$args['id'];

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_events'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $event = $this->db->fetchOne(
            'SELECT * FROM events WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        if (!$event) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        $name = trim($body['name'] ?? $event['name']);
        $description = trim($body['description'] ?? $event['description'] ?? '');
        $location = trim($body['location'] ?? $event['location'] ?? '');
        $eventDate = trim($body['event_date'] ?? $event['event_date']);

        if (!$name || !$eventDate) {
            return ResponseHelper::error($response, 'Name und Datum sind erforderlich', 400);
        }

        $bannerPath = $event['banner_path'];
        $attachmentPath = $event['attachment_path'];
        $attachmentFilename = $event['attachment_filename'];

        $uploadedFiles = $request->getUploadedFiles();

        try {
            if (isset($uploadedFiles['banner']) && $uploadedFiles['banner']->getError() === UPLOAD_ERR_OK) {
                $newBannerPath = $this->handleFileUpload($uploadedFiles['banner'], $tenantId, ['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
                if ($bannerPath && file_exists($this->uploadDir . '/' . $bannerPath)) {
                    unlink($this->uploadDir . '/' . $bannerPath);
                }
                $bannerPath = $newBannerPath;
            }

            if (isset($uploadedFiles['attachment']) && $uploadedFiles['attachment']->getError() === UPLOAD_ERR_OK) {
                $newAttachmentPath = $this->handleFileUpload($uploadedFiles['attachment'], $tenantId, [
                    'application/pdf', 'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'image/jpeg', 'image/png',
                ]);
                if ($attachmentPath && file_exists($this->uploadDir . '/' . $attachmentPath)) {
                    unlink($this->uploadDir . '/' . $attachmentPath);
                }
                $attachmentPath = $newAttachmentPath;
                $attachmentFilename = $uploadedFiles['attachment']->getClientFilename();
            }
        } catch (\InvalidArgumentException $e) {
            return ResponseHelper::error($response, $e->getMessage(), 400);
        }

        $this->db->execute(
            'UPDATE events SET name = ?, description = ?, location = ?, event_date = ?, banner_path = ?, attachment_path = ?, attachment_filename = ?
             WHERE id = ? AND tenant_id = ?',
            [$name, $description ?: null, $location ?: null, $eventDate, $bannerPath, $attachmentPath, $attachmentFilename, $id, $tenantId]
        );

        $updated = $this->db->fetchOne('SELECT * FROM events WHERE id = ?', [$id]);
        return ResponseHelper::success($response, $updated, 'Veranstaltung aktualisiert');
    }

    public function deleteEvent(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);
        $id = (int)$args['id'];

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_events'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $event = $this->db->fetchOne(
            'SELECT * FROM events WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        if (!$event) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        // Delete files
        if ($event['banner_path'] && file_exists($this->uploadDir . '/' . $event['banner_path'])) {
            unlink($this->uploadDir . '/' . $event['banner_path']);
        }
        if ($event['attachment_path'] && file_exists($this->uploadDir . '/' . $event['attachment_path'])) {
            unlink($this->uploadDir . '/' . $event['attachment_path']);
        }

        $this->db->execute('DELETE FROM events WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        return ResponseHelper::success($response, null, 'Veranstaltung gelöscht');
    }

    public function serveFile(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $filename = $args['filename'];

        // Security: ensure filename doesn't traverse directories
        $filename = basename($filename);
        $filePath = $this->uploadDir . '/' . $tenantId . '/' . $filename;

        if (!file_exists($filePath)) {
            return ResponseHelper::error($response, 'Datei nicht gefunden', 404);
        }

        // Verify file belongs to this tenant
        $event = $this->db->fetchOne(
            'SELECT id FROM events WHERE tenant_id = ? AND (banner_path = ? OR attachment_path = ?)',
            [$tenantId, $tenantId . '/' . $filename, $tenantId . '/' . $filename]
        );

        if (!$event) {
            return ResponseHelper::error($response, 'Zugriff verweigert', 403);
        }

        $mimeType = mime_content_type($filePath);
        $fileSize = filesize($filePath);

        $response = $response
            ->withHeader('Content-Type', $mimeType)
            ->withHeader('Content-Length', $fileSize)
            ->withHeader('Content-Disposition', 'inline; filename="' . $filename . '"');

        $response->getBody()->write(file_get_contents($filePath));
        return $response;
    }

    private function handleFileUpload($file, int $tenantId, array $allowedMimes): string
    {
        $maxSize = (int)($_ENV['MAX_UPLOAD_SIZE'] ?? 5242880);

        if ($file->getSize() > $maxSize) {
            throw new \InvalidArgumentException('Datei zu groß (max. ' . round($maxSize / 1048576, 1) . ' MB)');
        }

        // Validate MIME type server-side
        $tmpPath = $file->getStream()->getMetadata('uri');
        $actualMime = mime_content_type($tmpPath);

        if (!in_array($actualMime, $allowedMimes)) {
            throw new \InvalidArgumentException('Ungültiger Dateityp: ' . $actualMime);
        }

        $ext = match($actualMime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            default => 'bin',
        };

        $tenantUploadDir = $this->uploadDir . '/' . $tenantId;
        if (!is_dir($tenantUploadDir)) {
            mkdir($tenantUploadDir, 0755, true);
        }

        $filename = bin2hex(random_bytes(16)) . '.' . $ext;
        $destPath = $tenantUploadDir . '/' . $filename;

        $file->moveTo($destPath);

        return $tenantId . '/' . $filename;
    }
}
