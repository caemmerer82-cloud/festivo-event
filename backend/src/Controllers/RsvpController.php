<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use App\Services\MailService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class RsvpController
{
    private Database $db;
    private string $uploadDir;
    private MailService $mailService;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->uploadDir = rtrim($_ENV['UPLOAD_DIR'] ?? '../uploads', '/');
        $this->mailService = new MailService();
    }

    public function getInvitation(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $token = $args['token'];

        $guest = $this->db->fetchOne(
            'SELECT eg.*, p.first_name, p.last_name, p.email, p.phone, p.gender
             FROM event_guests eg
             JOIN persons p ON eg.person_id = p.id
             WHERE eg.invitation_token = ?',
            [$token]
        );

        if (!$guest) {
            return ResponseHelper::error($response, 'Ungültige Einladung', 404);
        }

        // Check token expiry
        if ($guest['token_expires_at'] && strtotime($guest['token_expires_at']) < time()) {
            return ResponseHelper::error($response, 'Einladungslink abgelaufen', 410);
        }

        // Get event
        $event = $this->db->fetchOne(
            'SELECT id, name, description, location, event_date, banner_path, attachment_path, attachment_filename, tenant_id
             FROM events WHERE id = ?',
            [$guest['event_id']]
        );

        if (!$event) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        // Get questions
        $questions = $this->db->fetchAll(
            'SELECT * FROM event_questions WHERE event_id = ? ORDER BY sort_order',
            [$event['id']]
        );

        foreach ($questions as &$q) {
            if ($q['options']) {
                $q['options'] = json_decode($q['options'], true);
            }
            $q['is_required'] = (bool)$q['is_required'];
        }

        // Get existing answers if already responded
        $answers = [];
        if (in_array($guest['status'], ['zugesagt', 'abgesagt'])) {
            $answerRows = $this->db->fetchAll(
                'SELECT question_id, answer FROM guest_answers WHERE event_guest_id = ?',
                [$guest['id']]
            );
            foreach ($answerRows as $ar) {
                $answers[$ar['question_id']] = $ar['answer'];
            }
        }

        // Build banner URL
        $appUrl = $_ENV['APP_URL'] ?? '';
        $bannerUrl = null;
        if ($event['banner_path']) {
            $bannerUrl = $appUrl . '/api/public/files/' . $event['banner_path'];
        }

        // Load tenant texts and replace {{first_name}} / {{last_name}} in greeting
        $textRows = $this->db->fetchAll(
            'SELECT text_key, text_value FROM tenant_texts WHERE tenant_id = ? AND event_id = ?',
            [$event['tenant_id'], $event['id']]
        );

        $firstName = $guest['first_name'] ?? '';
        $lastName  = $guest['last_name'] ?? '';
        $gender    = $guest['gender'] ?? null;

        $salutationFormal = match ($gender) {
            'm' => 'Sehr geehrter Herr ' . $lastName,
            'f' => 'Sehr geehrte Frau ' . $lastName,
            default => 'Hallo ' . $firstName . ' ' . $lastName,
        };
        $salutationFriendly = match ($gender) {
            'm' => 'Lieber ' . $firstName,
            'f' => 'Liebe ' . $firstName,
            default => 'Hallo ' . $firstName . ' ' . $lastName,
        };

        $eventDate = isset($event['event_date'])
            ? date('d.m.Y H:i', strtotime($event['event_date']))
            : '';

        $replacements = [
            '{{first_name}}'          => $firstName,
            '{{last_name}}'           => $lastName,
            '{{salutation_formal}}'   => $salutationFormal,
            '{{salutation_friendly}}' => $salutationFriendly,
            '{{event_name}}'          => $event['name'] ?? '',
            '{{event_date}}'          => $eventDate,
            '{{event_location}}'      => $event['location'] ?? '',
        ];

        $texts = [];
        foreach ($textRows as $tr) {
            $texts[$tr['text_key']] = str_replace(
                array_keys($replacements),
                array_values($replacements),
                $tr['text_value']
            );
        }

        return ResponseHelper::success($response, [
            'guest' => [
                'id' => $guest['id'],
                'first_name' => $guest['first_name'],
                'last_name' => $guest['last_name'],
                'status' => $guest['status'],
            ],
            'event' => [
                'id' => $event['id'],
                'name' => $event['name'],
                'description' => $event['description'],
                'location' => $event['location'],
                'event_date' => $event['event_date'],
                'banner_url' => $bannerUrl,
                'has_attachment' => !empty($event['attachment_path']),
                'attachment_filename' => $event['attachment_filename'],
                'attachment_token' => $event['attachment_path'] ? $token : null,
            ],
            'questions' => $questions,
            'existing_answers' => $answers,
            'texts' => $texts,
        ]);
    }

    public function submitRsvp(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $token = $args['token'];

        $guest = $this->db->fetchOne(
            'SELECT eg.* FROM event_guests eg WHERE eg.invitation_token = ?',
            [$token]
        );

        if (!$guest) {
            return ResponseHelper::error($response, 'Ungültige Einladung', 404);
        }

        if ($guest['token_expires_at'] && strtotime($guest['token_expires_at']) < time()) {
            return ResponseHelper::error($response, 'Einladungslink abgelaufen', 410);
        }

        $body = $request->getParsedBody();
        $attending = $body['attending'] ?? null;

        if ($attending === null) {
            return ResponseHelper::error($response, 'Bitte Zu- oder Absage angeben', 400);
        }

        $status = $attending ? 'zugesagt' : 'abgesagt';

        // Get event questions
        $questions = $this->db->fetchAll(
            'SELECT * FROM event_questions WHERE event_id = ? ORDER BY sort_order',
            [$guest['event_id']]
        );

        $answers = $body['answers'] ?? [];

        // Validate required questions if attending
        if ($attending) {
            foreach ($questions as $q) {
                if ($q['is_required'] && empty($answers[$q['id']])) {
                    return ResponseHelper::error($response, 'Pflichtfrage "' . $q['question_text'] . '" nicht beantwortet', 400);
                }
            }
        }

        // Update guest status
        $this->db->execute(
            'UPDATE event_guests SET status = ?, responded_at = NOW() WHERE id = ?',
            [$status, $guest['id']]
        );

        // Delete old answers
        $this->db->execute('DELETE FROM guest_answers WHERE event_guest_id = ?', [$guest['id']]);

        // Save new answers if attending
        if ($attending && !empty($questions)) {
            foreach ($questions as $q) {
                $answer = $answers[$q['id']] ?? null;
                if ($answer !== null) {
                    if (is_array($answer)) {
                        $answer = implode(', ', $answer);
                    }
                    $this->db->insert(
                        'INSERT INTO guest_answers (event_guest_id, question_id, answer) VALUES (?, ?, ?)',
                        [$guest['id'], $q['id'], $answer]
                    );
                }
            }
        }

        // Auto-send confirmation/rejection mail if a matching template exists
        $event = $this->db->fetchOne(
            'SELECT tenant_id FROM events WHERE id = ?',
            [$guest['event_id']]
        );
        if ($event) {
            $templateName = $attending ? 'Zusage' : 'Absage';
            $this->mailService->sendTemplateByName(
                (int)$event['tenant_id'],
                (int)$guest['id'],
                $templateName,
                (int)$guest['event_id']
            );
        }

        $message = $attending
            ? 'Vielen Dank für Ihre Zusage!'
            : 'Ihre Absage wurde gespeichert.';

        return ResponseHelper::success($response, ['status' => $status], $message);
    }

    public function downloadAttachment(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $token = $args['token'];

        $guest = $this->db->fetchOne(
            'SELECT event_id FROM event_guests WHERE invitation_token = ?',
            [$token]
        );

        if (!$guest) {
            return ResponseHelper::error($response, 'Ungültige Einladung', 404);
        }

        $event = $this->db->fetchOne(
            'SELECT attachment_path, attachment_filename FROM events WHERE id = ?',
            [$guest['event_id']]
        );

        if (!$event || !$event['attachment_path']) {
            return ResponseHelper::error($response, 'Kein Anhang vorhanden', 404);
        }

        $filePath = $this->uploadDir . '/' . $event['attachment_path'];

        if (!file_exists($filePath)) {
            return ResponseHelper::error($response, 'Datei nicht gefunden', 404);
        }

        $mimeType = mime_content_type($filePath);
        $fileSize = filesize($filePath);
        $filename = $event['attachment_filename'] ?? 'anhang';

        $response = $response
            ->withHeader('Content-Type', $mimeType)
            ->withHeader('Content-Length', $fileSize)
            ->withHeader('Content-Disposition', 'attachment; filename="' . addslashes($filename) . '"');

        $response->getBody()->write(file_get_contents($filePath));
        return $response;
    }

    public function servePublicFile(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        // Serve banner images publicly (no auth needed, but only for valid event files)
        $tenantId = $args['tenant_id'];
        $filename = basename($args['filename']);
        $filePath = $this->uploadDir . '/' . $tenantId . '/' . $filename;

        if (!file_exists($filePath)) {
            return ResponseHelper::error($response, 'Datei nicht gefunden', 404);
        }

        // Verify this is a banner (not attachment) by checking it's referenced as banner_path
        $event = $this->db->fetchOne(
            'SELECT id FROM events WHERE tenant_id = ? AND banner_path = ?',
            [(int)$tenantId, $tenantId . '/' . $filename]
        );

        if (!$event) {
            return ResponseHelper::error($response, 'Zugriff verweigert', 403);
        }

        $mimeType = mime_content_type($filePath);
        $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        if (!in_array($mimeType, $allowedMimes)) {
            return ResponseHelper::error($response, 'Ungültiger Dateityp', 403);
        }

        $response = $response
            ->withHeader('Content-Type', $mimeType)
            ->withHeader('Content-Length', filesize($filePath))
            ->withHeader('Cache-Control', 'public, max-age=86400');

        $response->getBody()->write(file_get_contents($filePath));
        return $response;
    }
}
