<?php

namespace App\Helpers;

use Psr\Http\Message\ResponseInterface;

class ResponseHelper
{
    public static function json(ResponseInterface $response, mixed $data, int $status = 200): ResponseInterface
    {
        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }

    public static function success(ResponseInterface $response, mixed $data = null, string $message = 'Erfolg', int $status = 200): ResponseInterface
    {
        return self::json($response, [
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $status);
    }

    public static function error(ResponseInterface $response, string $message, int $status = 400, mixed $errors = null): ResponseInterface
    {
        $body = [
            'success' => false,
            'message' => $message,
        ];
        if ($errors !== null) {
            $body['errors'] = $errors;
        }
        return self::json($response, $body, $status);
    }
}
