<?php

namespace App\Middleware;

use App\Helpers\JwtHelper;
use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Response;
use Slim\Routing\RouteContext;

class AuthMiddleware implements MiddlewareInterface
{
    private JwtHelper $jwt;
    private bool $requireSystemAdmin;

    public function __construct(bool $requireSystemAdmin = false)
    {
        $this->jwt = new JwtHelper();
        $this->requireSystemAdmin = $requireSystemAdmin;
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $authHeader = $request->getHeaderLine('Authorization');

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return ResponseHelper::error(new Response(), 'Nicht autorisiert', 401);
        }

        $token = substr($authHeader, 7);
        $payload = $this->jwt->validate($token);

        if (!$payload) {
            return ResponseHelper::error(new Response(), 'Ungültiges oder abgelaufenes Token', 401);
        }

        if ($this->requireSystemAdmin) {
            if (($payload['role'] ?? '') !== 'system_admin') {
                return ResponseHelper::error(new Response(), 'Zugriff verweigert', 403);
            }
        } else {
            // Tenant route: verify tenant matches
            $routeTenant = RouteContext::fromRequest($request)->getRoute()?->getArgument('tenant');
            if ($routeTenant && isset($payload['tenant_slug'])) {
                if ($payload['tenant_slug'] !== $routeTenant) {
                    return ResponseHelper::error(new Response(), 'Zugriff auf falschen Mandanten', 403);
                }
            }
        }

        $request = $request->withAttribute('auth_user', $payload);
        return $handler->handle($request);
    }
}
