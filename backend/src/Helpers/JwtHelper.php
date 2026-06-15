<?php

namespace App\Helpers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JwtHelper
{
    private string $secret;
    private int $expiry;

    public function __construct()
    {
        $this->secret = $_ENV['JWT_SECRET'] ?? 'default-secret-change-me';
        $this->expiry = (int)($_ENV['JWT_EXPIRY'] ?? 86400);
    }

    public function generate(array $payload): string
    {
        $payload['iat'] = time();
        $payload['exp'] = time() + $this->expiry;

        return JWT::encode($payload, $this->secret, 'HS256');
    }

    public function decode(string $token): array
    {
        $decoded = JWT::decode($token, new Key($this->secret, 'HS256'));
        return (array) $decoded;
    }

    public function validate(string $token): array|false
    {
        try {
            return $this->decode($token);
        } catch (\Exception $e) {
            return false;
        }
    }
}
