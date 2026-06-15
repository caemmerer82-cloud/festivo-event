<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use App\Services\MailService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class MailController
{
    private Database $db;
    private MailService $mailService;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->mailService = new MailService();
    }

    private function getTenantId(ServerRequestInterface $request): int
    {
        return (int)$request->getAttribute('tenant_data')['id'];
    }

    private function getAuthUser(ServerRequestInterface $request): array
    {
        return $request->getAttribute('auth_user');
    }

    public function listTemplates(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);

        $templates = $this->db->fetchAll(
            'SELECT * FROM mail_templates WHERE tenant_id = ? ORDER BY name',
            [$tenantId]
        );

        foreach ($templates as &$t) {
            $t['include_attachment'] = (bool)$t['include_attachment'];
        }

        return ResponseHelper::success($response, $templates);
    }

    public function getTemplate(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $id = (int)$args['id'];

        $template = $this->db->fetchOne(
            'SELECT * FROM mail_templates WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        if (!$template) {
            return ResponseHelper::error($response, 'Vorlage nicht gefunden', 404);
        }

        $template['include_attachment'] = (bool)$template['include_attachment'];
        return ResponseHelper::success($response, $template);
    }

    public function createTemplate(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_mails'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $body = $request->getParsedBody();
        $name = trim($body['name'] ?? '');
        $subject = trim($body['subject'] ?? '');
        $bodyHtml = $body['body_html'] ?? '';
        $includeAttachment = (bool)($body['include_attachment'] ?? false);

        if (!$name || !$subject || !$bodyHtml) {
            return ResponseHelper::error($response, 'Name, Betreff und Inhalt sind erforderlich', 400);
        }

        $id = $this->db->insert(
            'INSERT INTO mail_templates (tenant_id, name, subject, body_html, include_attachment) VALUES (?, ?, ?, ?, ?)',
            [$tenantId, $name, $subject, $bodyHtml, $includeAttachment ? 1 : 0]
        );

        $template = $this->db->fetchOne('SELECT * FROM mail_templates WHERE id = ?', [$id]);
        $template['include_attachment'] = (bool)$template['include_attachment'];
        return ResponseHelper::success($response, $template, 'Vorlage erstellt', 201);
    }

    public function updateTemplate(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);
        $id = (int)$args['id'];

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_mails'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $template = $this->db->fetchOne(
            'SELECT * FROM mail_templates WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        if (!$template) {
            return ResponseHelper::error($response, 'Vorlage nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        $name = trim($body['name'] ?? $template['name']);
        $subject = trim($body['subject'] ?? $template['subject']);
        $bodyHtml = $body['body_html'] ?? $template['body_html'];
        $includeAttachment = isset($body['include_attachment']) ? (bool)$body['include_attachment'] : (bool)$template['include_attachment'];

        $this->db->execute(
            'UPDATE mail_templates SET name = ?, subject = ?, body_html = ?, include_attachment = ? WHERE id = ? AND tenant_id = ?',
            [$name, $subject, $bodyHtml, $includeAttachment ? 1 : 0, $id, $tenantId]
        );

        $updated = $this->db->fetchOne('SELECT * FROM mail_templates WHERE id = ?', [$id]);
        $updated['include_attachment'] = (bool)$updated['include_attachment'];
        return ResponseHelper::success($response, $updated, 'Vorlage aktualisiert');
    }

    public function deleteTemplate(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);
        $id = (int)$args['id'];

        if (!$authUser['is_admin'] && !($authUser['permissions']['create_mails'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $template = $this->db->fetchOne(
            'SELECT id FROM mail_templates WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        if (!$template) {
            return ResponseHelper::error($response, 'Vorlage nicht gefunden', 404);
        }

        $this->db->execute('DELETE FROM mail_templates WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        return ResponseHelper::success($response, null, 'Vorlage gelöscht');
    }

    public function sendMails(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin'] && !($authUser['permissions']['send_mails'] ?? false)) {
            return ResponseHelper::error($response, 'Keine Berechtigung', 403);
        }

        $body = $request->getParsedBody();
        $templateId = (int)($body['template_id'] ?? 0);
        $eventId = isset($body['event_id']) ? (int)$body['event_id'] : null;
        $guestIds = $body['guest_ids'] ?? [];

        if (!$templateId) {
            return ResponseHelper::error($response, 'Vorlage erforderlich', 400);
        }

        if (empty($guestIds)) {
            return ResponseHelper::error($response, 'Keine Empfänger angegeben', 400);
        }

        // Get template
        $template = $this->db->fetchOne(
            'SELECT * FROM mail_templates WHERE id = ? AND tenant_id = ?',
            [$templateId, $tenantId]
        );

        if (!$template) {
            return ResponseHelper::error($response, 'Vorlage nicht gefunden', 404);
        }

        // Get SMTP config
        $smtp = $this->db->fetchOne(
            'SELECT * FROM tenant_smtp WHERE tenant_id = ?',
            [$tenantId]
        );

        if (!$smtp) {
            return ResponseHelper::error($response, 'Keine SMTP-Konfiguration vorhanden', 400);
        }

        // Get event if needed
        $event = null;
        if ($eventId) {
            $event = $this->db->fetchOne(
                'SELECT * FROM events WHERE id = ? AND tenant_id = ?',
                [$eventId, $tenantId]
            );
        }

        $result = $this->mailService->sendTemplateToGuests(
            $tenantId, $template, $smtp, $guestIds, $event, $eventId
        );

        return ResponseHelper::success($response, $result, $result['sent'] . ' E-Mails gesendet');
    }

    public function getMailLog(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $params = $request->getQueryParams();
        $page = max(1, (int)($params['page'] ?? 1));
        $limit = min(100, max(1, (int)($params['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;

        $total = $this->db->fetchOne(
            'SELECT COUNT(*) as cnt FROM mail_log WHERE tenant_id = ?',
            [$tenantId]
        )['cnt'];

        $logs = $this->db->fetchAll(
            'SELECT ml.*, e.name as event_name, p.first_name, p.last_name
             FROM mail_log ml
             LEFT JOIN events e ON ml.event_id = e.id
             LEFT JOIN persons p ON ml.person_id = p.id
             WHERE ml.tenant_id = ?
             ORDER BY ml.sent_at DESC
             LIMIT ? OFFSET ?',
            [$tenantId, $limit, $offset]
        );

        return ResponseHelper::success($response, [
            'data' => $logs,
            'total' => (int)$total,
            'page' => $page,
            'limit' => $limit,
        ]);
    }

}
