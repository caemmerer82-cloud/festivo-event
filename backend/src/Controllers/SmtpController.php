<?php

namespace App\Controllers;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailerException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class SmtpController
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

    public function getSmtpConfig(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);

        $smtp = $this->db->fetchOne(
            'SELECT id, tenant_id, host, port, username, encryption, from_email, from_name FROM tenant_smtp WHERE tenant_id = ?',
            [$tenantId]
        );

        // Don't return password
        return ResponseHelper::success($response, $smtp ?: null);
    }

    public function saveSmtpConfig(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin']) {
            return ResponseHelper::error($response, 'Nur Administratoren können SMTP konfigurieren', 403);
        }

        $body = $request->getParsedBody();
        $host = trim($body['host'] ?? '');
        $port = (int)($body['port'] ?? 587);
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';
        $encryption = $body['encryption'] ?? 'tls';
        $fromEmail = trim($body['from_email'] ?? '');
        $fromName = trim($body['from_name'] ?? '');

        if (!$host || !$username || !$fromEmail || !$fromName) {
            return ResponseHelper::error($response, 'Host, Benutzername, Absender-E-Mail und Absendername sind erforderlich', 400);
        }

        if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
            return ResponseHelper::error($response, 'Ungültige Absender-E-Mail-Adresse', 400);
        }

        if (!in_array($encryption, ['tls', 'ssl', 'none'])) {
            return ResponseHelper::error($response, 'Ungültige Verschlüsselung', 400);
        }

        $existing = $this->db->fetchOne('SELECT id FROM tenant_smtp WHERE tenant_id = ?', [$tenantId]);

        if ($existing) {
            // Update - only update password if provided
            if ($password) {
                $this->db->execute(
                    'UPDATE tenant_smtp SET host = ?, port = ?, username = ?, password = ?, encryption = ?, from_email = ?, from_name = ? WHERE tenant_id = ?',
                    [$host, $port, $username, $password, $encryption, $fromEmail, $fromName, $tenantId]
                );
            } else {
                $this->db->execute(
                    'UPDATE tenant_smtp SET host = ?, port = ?, username = ?, encryption = ?, from_email = ?, from_name = ? WHERE tenant_id = ?',
                    [$host, $port, $username, $encryption, $fromEmail, $fromName, $tenantId]
                );
            }
        } else {
            if (!$password) {
                return ResponseHelper::error($response, 'Passwort erforderlich', 400);
            }
            $this->db->insert(
                'INSERT INTO tenant_smtp (tenant_id, host, port, username, password, encryption, from_email, from_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$tenantId, $host, $port, $username, $password, $encryption, $fromEmail, $fromName]
            );
        }

        $smtp = $this->db->fetchOne(
            'SELECT id, tenant_id, host, port, username, encryption, from_email, from_name FROM tenant_smtp WHERE tenant_id = ?',
            [$tenantId]
        );

        return ResponseHelper::success($response, $smtp, 'SMTP-Konfiguration gespeichert');
    }

    public function testSmtpConfig(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin']) {
            return ResponseHelper::error($response, 'Nur Administratoren können SMTP testen', 403);
        }

        $body = $request->getParsedBody();
        $testEmail = trim($body['test_email'] ?? '');

        if (!$testEmail || !filter_var($testEmail, FILTER_VALIDATE_EMAIL)) {
            return ResponseHelper::error($response, 'Gültige Test-E-Mail-Adresse erforderlich', 400);
        }

        $smtp = $this->db->fetchOne('SELECT * FROM tenant_smtp WHERE tenant_id = ?', [$tenantId]);

        if (!$smtp) {
            return ResponseHelper::error($response, 'Keine SMTP-Konfiguration vorhanden', 400);
        }

        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host = $smtp['host'];
            $mail->SMTPAuth = true;
            $mail->Username = $smtp['username'];
            $mail->Password = $smtp['password'];
            $mail->Port = $smtp['port'];

            if ($smtp['encryption'] === 'tls') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            } elseif ($smtp['encryption'] === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            } else {
                $mail->SMTPAutoTLS = false;
            }

            $mail->setFrom($smtp['from_email'], $smtp['from_name']);
            $mail->addAddress($testEmail);
            $mail->isHTML(true);
            $mail->Subject = 'SMTP-Test - Event Manager';
            $mail->Body = '<p>Dies ist eine Test-E-Mail vom Event Manager System.</p>';
            $mail->CharSet = 'UTF-8';
            $mail->send();

            return ResponseHelper::success($response, null, 'Test-E-Mail erfolgreich gesendet');
        } catch (MailerException $e) {
            return ResponseHelper::error($response, 'SMTP-Fehler: ' . $mail->ErrorInfo, 400);
        }
    }

    public function deleteSmtpConfig(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $tenantId = $this->getTenantId($request);
        $authUser = $this->getAuthUser($request);

        if (!$authUser['is_admin']) {
            return ResponseHelper::error($response, 'Nur Administratoren können SMTP konfigurieren', 403);
        }

        $this->db->execute('DELETE FROM tenant_smtp WHERE tenant_id = ?', [$tenantId]);
        return ResponseHelper::success($response, null, 'SMTP-Konfiguration gelöscht');
    }
}
