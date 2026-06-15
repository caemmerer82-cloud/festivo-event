<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class QuestionController
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

    private function verifyEventOwnership(int $eventId, int $tenantId): bool
    {
        return (bool)$this->db->fetchOne(
            'SELECT id FROM events WHERE id = ? AND tenant_id = ?',
            [$eventId, $tenantId]
        );
    }

    public function listQuestions(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $questions = $this->db->fetchAll(
            'SELECT * FROM event_questions WHERE event_id = ? ORDER BY sort_order',
            [$eventId]
        );

        foreach ($questions as &$q) {
            if ($q['options']) {
                $q['options'] = json_decode($q['options'], true);
            }
            $q['is_required'] = (bool)$q['is_required'];
        }

        return ResponseHelper::success($response, $questions);
    }

    public function createQuestion(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_rsvp'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        $questionText = trim($body['question_text'] ?? '');
        $questionType = $body['question_type'] ?? '';
        $options = $body['options'] ?? null;
        $isRequired = (bool)($body['is_required'] ?? false);
        $sortOrder = (int)($body['sort_order'] ?? 0);

        if (!$questionText || !$questionType) {
            return ResponseHelper::error($response, 'Fragetext und Typ sind erforderlich', 400);
        }

        $validTypes = ['text', 'dropdown', 'radio', 'checkbox'];
        if (!in_array($questionType, $validTypes)) {
            return ResponseHelper::error($response, 'Ungültiger Fragetyp', 400);
        }

        if (in_array($questionType, ['dropdown', 'radio', 'checkbox']) && (empty($options) || !is_array($options))) {
            return ResponseHelper::error($response, 'Optionen erforderlich für diesen Fragetyp', 400);
        }

        $optionsJson = $options ? json_encode($options) : null;

        $id = $this->db->insert(
            'INSERT INTO event_questions (event_id, question_text, question_type, options, is_required, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$eventId, $questionText, $questionType, $optionsJson, $isRequired ? 1 : 0, $sortOrder]
        );

        $question = $this->db->fetchOne('SELECT * FROM event_questions WHERE id = ?', [$id]);
        if ($question['options']) {
            $question['options'] = json_decode($question['options'], true);
        }
        $question['is_required'] = (bool)$question['is_required'];

        return ResponseHelper::success($response, $question, 'Frage erstellt', 201);
    }

    public function updateQuestion(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];
        $questionId = (int)$args['id'];
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['edit_rsvp'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $question = $this->db->fetchOne(
            'SELECT * FROM event_questions WHERE id = ? AND event_id = ?',
            [$questionId, $eventId]
        );

        if (!$question) {
            return ResponseHelper::error($response, 'Frage nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        $questionText = trim($body['question_text'] ?? $question['question_text']);
        $questionType = $body['question_type'] ?? $question['question_type'];
        $options = isset($body['options']) ? $body['options'] : ($question['options'] ? json_decode($question['options'], true) : null);
        $isRequired = isset($body['is_required']) ? (bool)$body['is_required'] : (bool)$question['is_required'];
        $sortOrder = isset($body['sort_order']) ? (int)$body['sort_order'] : (int)$question['sort_order'];

        $optionsJson = $options ? json_encode($options) : null;

        $this->db->execute(
            'UPDATE event_questions SET question_text = ?, question_type = ?, options = ?, is_required = ?, sort_order = ?
             WHERE id = ?',
            [$questionText, $questionType, $optionsJson, $isRequired ? 1 : 0, $sortOrder, $questionId]
        );

        $updated = $this->db->fetchOne('SELECT * FROM event_questions WHERE id = ?', [$questionId]);
        if ($updated['options']) {
            $updated['options'] = json_decode($updated['options'], true);
        }
        $updated['is_required'] = (bool)$updated['is_required'];

        return ResponseHelper::success($response, $updated, 'Frage aktualisiert');
    }

    public function deleteQuestion(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];
        $questionId = (int)$args['id'];
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['edit_rsvp'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $question = $this->db->fetchOne(
            'SELECT id FROM event_questions WHERE id = ? AND event_id = ?',
            [$questionId, $eventId]
        );

        if (!$question) {
            return ResponseHelper::error($response, 'Frage nicht gefunden', 404);
        }

        $this->db->execute('DELETE FROM event_questions WHERE id = ?', [$questionId]);
        return ResponseHelper::success($response, null, 'Frage gelöscht');
    }

    public function reorderQuestions(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['edit_rsvp'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        if (!$this->verifyEventOwnership($eventId, $tenantId)) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        $order = $body['order'] ?? []; // Array of {id, sort_order}

        foreach ($order as $item) {
            $this->db->execute(
                'UPDATE event_questions SET sort_order = ? WHERE id = ? AND event_id = ?',
                [(int)$item['sort_order'], (int)$item['id'], $eventId]
            );
        }

        return ResponseHelper::success($response, null, 'Reihenfolge aktualisiert');
    }
}
