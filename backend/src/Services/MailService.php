<?php

namespace App\Services;

use App\Database\Database;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailerException;

class MailService
{
    private Database $db;
    private string $uploadDir;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->uploadDir = rtrim($_ENV['UPLOAD_DIR'] ?? '../uploads', '/');
    }

    /**
     * Send a named template ("Zusage" or "Absage") to a single guest.
     * Returns true on success, false if no template or SMTP config found.
     */
    public function sendTemplateByName(int $tenantId, int $guestId, string $templateName, ?int $eventId = null): bool
    {
        $template = $this->db->fetchOne(
            'SELECT * FROM mail_templates WHERE tenant_id = ? AND name = ?',
            [$tenantId, $templateName]
        );
        if (!$template) return false;

        $smtp = $this->db->fetchOne('SELECT * FROM tenant_smtp WHERE tenant_id = ?', [$tenantId]);
        if (!$smtp) return false;

        $guest = $this->db->fetchOne(
            'SELECT eg.*, p.first_name, p.last_name, p.email, p.gender
             FROM event_guests eg
             JOIN persons p ON eg.person_id = p.id
             WHERE eg.id = ?',
            [$guestId]
        );
        if (!$guest) return false;

        $event = null;
        if ($eventId) {
            $event = $this->db->fetchOne(
                'SELECT * FROM events WHERE id = ? AND tenant_id = ?',
                [$eventId, $tenantId]
            );
        }

        $appUrl = rtrim($_ENV['APP_URL'] ?? 'http://localhost', '/');
        $rsvpLink = $appUrl . '/rsvp/' . ($guest['invitation_token'] ?? '');

        $subject = $this->replacePlaceholders($template['subject'], $guest, $event, $rsvpLink);
        $bodyHtml = $this->replacePlaceholders($template['body_html'], $guest, $event, $rsvpLink, true);

        $mail = null;
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
            $mail->addAddress($guest['email'], $guest['first_name'] . ' ' . $guest['last_name']);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $bodyHtml;
            $mail->CharSet = 'UTF-8';

            // Embed banner inline
            if ($event && $event['banner_path']) {
                $bannerPath = $this->uploadDir . '/' . $event['banner_path'];
                if (file_exists($bannerPath)) {
                    $mail->addEmbeddedImage($bannerPath, 'eventbanner');
                }
            }

            // Add file attachment if template is configured for it
            if ($template['include_attachment'] && $event && $event['attachment_path']) {
                $attachPath = $this->uploadDir . '/' . $event['attachment_path'];
                if (file_exists($attachPath)) {
                    $mail->addAttachment($attachPath, $event['attachment_filename'] ?? 'anhang.pdf');
                }
            }

            $mail->send();

            $this->db->insert(
                'INSERT INTO mail_log (tenant_id, event_id, person_id, template_id, recipient_email, subject, status)
                 VALUES (?, ?, ?, ?, ?, ?, "sent")',
                [$tenantId, $eventId, $guest['person_id'], $template['id'], $guest['email'], $subject]
            );

            return true;

        } catch (MailerException $e) {
            $errorInfo = $mail ? $mail->ErrorInfo : $e->getMessage();
            $this->db->insert(
                'INSERT INTO mail_log (tenant_id, event_id, person_id, template_id, recipient_email, subject, status, error_message)
                 VALUES (?, ?, ?, ?, ?, ?, "failed", ?)',
                [$tenantId, $eventId, $guest['person_id'] ?? null, $template['id'], $guest['email'], $subject, $errorInfo]
            );
            return false;
        }
    }

    /**
     * Send to multiple guests and return sent/failed counts.
     */
    public function sendTemplateToGuests(
        int $tenantId,
        array $template,
        array $smtp,
        array $guestIds,
        ?array $event,
        ?int $eventId
    ): array {
        $sent = 0;
        $failed = 0;
        $errors = [];
        $appUrl = rtrim($_ENV['APP_URL'] ?? 'http://localhost', '/');

        foreach ($guestIds as $guestId) {
            $guestId = (int)$guestId;

            $guest = $this->db->fetchOne(
                'SELECT eg.*, p.first_name, p.last_name, p.email, p.phone, p.gender
                 FROM event_guests eg
                 JOIN persons p ON eg.person_id = p.id
                 WHERE eg.id = ?',
                [$guestId]
            );

            if (!$guest) continue;

            // Generate RSVP token if needed
            if (!$guest['invitation_token']) {
                $token = bin2hex(random_bytes(32));
                $expiry = date('Y-m-d H:i:s', strtotime('+30 days'));
                $this->db->execute(
                    'UPDATE event_guests SET invitation_token = ?, token_expires_at = ?, status = "eingeladen", invited_at = NOW()
                     WHERE id = ?',
                    [$token, $expiry, $guestId]
                );
                $guest['invitation_token'] = $token;
            } else {
                $this->db->execute(
                    'UPDATE event_guests SET status = "eingeladen", invited_at = NOW() WHERE id = ? AND status = "angelegt"',
                    [$guestId]
                );
            }

            $rsvpLink = $appUrl . '/rsvp/' . $guest['invitation_token'];
            $subject = $this->replacePlaceholders($template['subject'], $guest, $event, $rsvpLink);
            $bodyHtml = $this->replacePlaceholders($template['body_html'], $guest, $event, $rsvpLink, true);

            $mail = null;
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
                $mail->addAddress($guest['email'], $guest['first_name'] . ' ' . $guest['last_name']);
                $mail->isHTML(true);
                $mail->Subject = $subject;
                $mail->Body = $bodyHtml;
                $mail->CharSet = 'UTF-8';

                if ($event && $event['banner_path']) {
                    $bannerPath = $this->uploadDir . '/' . $event['banner_path'];
                    if (file_exists($bannerPath)) {
                        $mail->addEmbeddedImage($bannerPath, 'eventbanner');
                    }
                }

                if ($template['include_attachment'] && $event && $event['attachment_path']) {
                    $attachPath = $this->uploadDir . '/' . $event['attachment_path'];
                    if (file_exists($attachPath)) {
                        $mail->addAttachment($attachPath, $event['attachment_filename'] ?? 'anhang.pdf');
                    }
                }

                $mail->send();

                $this->db->insert(
                    'INSERT INTO mail_log (tenant_id, event_id, person_id, template_id, recipient_email, subject, status)
                     VALUES (?, ?, ?, ?, ?, ?, "sent")',
                    [$tenantId, $eventId, $guest['person_id'], $template['id'], $guest['email'], $subject]
                );

                $sent++;

            } catch (MailerException $e) {
                $errorInfo = $mail ? $mail->ErrorInfo : $e->getMessage();
                $this->db->insert(
                    'INSERT INTO mail_log (tenant_id, event_id, person_id, template_id, recipient_email, subject, status, error_message)
                     VALUES (?, ?, ?, ?, ?, ?, "failed", ?)',
                    [$tenantId, $eventId, $guest['person_id'], $template['id'], $guest['email'], $subject, $errorInfo]
                );
                $errors[] = $guest['email'] . ': ' . $errorInfo;
                $failed++;
            }
        }

        return ['sent' => $sent, 'failed' => $failed, 'errors' => $errors];
    }

    public function replacePlaceholders(string $text, array $guest, ?array $event, string $rsvpLink, bool $useCid = false): string
    {
        $firstName = $guest['first_name'] ?? '';
        $lastName  = $guest['last_name'] ?? '';
        $gender    = $guest['gender'] ?? null;

        $hallo = 'Hallo ' . $firstName . ' ' . $lastName;

        $salutationFormal = match ($gender) {
            'm' => 'Sehr geehrter Herr ' . $lastName,
            'f' => 'Sehr geehrte Frau ' . $lastName,
            default => $hallo,
        };

        $salutationFriendly = match ($gender) {
            'm' => 'Lieber ' . $firstName,
            'f' => 'Liebe ' . $firstName,
            default => $hallo,
        };

        $replacements = [
            '{{first_name}}'          => htmlspecialchars($firstName),
            '{{last_name}}'           => htmlspecialchars($lastName),
            '{{email}}'               => htmlspecialchars($guest['email'] ?? ''),
            '{{rsvp_link}}'           => $rsvpLink,
            '{{salutation_formal}}'   => htmlspecialchars($salutationFormal),
            '{{salutation_friendly}}' => htmlspecialchars($salutationFriendly),
        ];

        if ($event) {
            $replacements['{{event_name}}'] = htmlspecialchars($event['name'] ?? '');
            $replacements['{{event_date}}'] = isset($event['event_date'])
                ? date('d.m.Y H:i', strtotime($event['event_date']))
                : '';
            $replacements['{{event_location}}'] = htmlspecialchars($event['location'] ?? '');
            $replacements['{{event_description}}'] = $event['description'] ?? '';
            $appUrl = rtrim($_ENV['APP_URL'] ?? '', '/');

            if ($event['banner_path']) {
                $imgSrc = $useCid ? 'cid:eventbanner' : $appUrl . '/api/public/files/' . $event['banner_path'];
                $replacements['{{banner_url}}'] = $appUrl . '/api/public/files/' . $event['banner_path'];
                $replacements['{{banner_img}}'] = '<img src="' . $imgSrc . '" alt="' . htmlspecialchars($event['name'] ?? '') . '" style="max-width:100%;height:auto;display:block;" />';
            } else {
                $replacements['{{banner_url}}'] = '';
                $replacements['{{banner_img}}'] = '';
            }
        }

        return str_replace(array_keys($replacements), array_values($replacements), $text);
    }
}
