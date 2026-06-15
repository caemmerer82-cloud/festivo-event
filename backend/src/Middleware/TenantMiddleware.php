<?php

namespace App\Middleware;

use App\Database\Database;
use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Response;
use Slim\Routing\RouteContext;

class TenantMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $routeContext = RouteContext::fromRequest($request);
        $slug = $routeContext->getRoute()?->getArgument('tenant');

        if (!$slug) {
            return ResponseHelper::error(new Response(), 'Mandant nicht angegeben', 400);
        }

        $db = Database::getInstance();
        $tenant = $db->fetchOne(
            'SELECT id, slug, name, is_active FROM tenants WHERE slug = ?',
            [$slug]
        );

        if (!$tenant) {
            return ResponseHelper::error(new Response(), 'Mandant nicht gefunden', 404);
        }

        if (!$tenant['is_active']) {
            return ResponseHelper::error(new Response(), 'Mandant ist deaktiviert', 403);
        }

        $request = $request->withAttribute('tenant_data', $tenant);
        return $handler->handle($request);
    }
}
