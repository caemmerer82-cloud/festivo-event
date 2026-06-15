<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class TextController
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

    public function getTexts(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];

        // Verify event belongs to tenant
        $event = $this->db->fetchOne(
            'SELECT id FROM events WHERE id = ? AND tenant_id = ?',
            [$eventId, $tenantId]
        );
        if (!$event) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $rows = $this->db->fetchAll(
            'SELECT text_key, text_value FROM tenant_texts WHERE tenant_id = ? AND event_id = ?',
            [$tenantId, $eventId]
        );

        $result = [];
        foreach ($rows as $row) {
            $result[$row['text_key']] = $row['text_value'];
        }

        return ResponseHelper::success($response, $result);
    }

    public function saveTexts(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $eventId = (int)$args['event_id'];

        $event = $this->db->fetchOne(
            'SELECT id FROM events WHERE id = ? AND tenant_id = ?',
            [$eventId, $tenantId]
        );
        if (!$event) {
            return ResponseHelper::error($response, 'Veranstaltung nicht gefunden', 404);
        }

        $body = $request->getParsedBody();
        if (!is_array($body)) {
            return ResponseHelper::error($response, 'Ungültige Daten', 400);
        }

        foreach ($body as $key => $value) {
            $key = trim($key);
            if (!$key || !is_string($value)) continue;

            $this->db->execute(
                'INSERT INTO tenant_texts (tenant_id, event_id, text_key, text_value)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE text_value = VALUES(text_value)',
                [$tenantId, $eventId, $key, $value]
            );
        }

        return ResponseHelper::success($response, null, 'Texte gespeichert');
    }
}
