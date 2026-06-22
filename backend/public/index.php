<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\EventController;
use App\Controllers\EventGuestController;
use App\Controllers\MailController;
use App\Controllers\PersonController;
use App\Controllers\QuestionController;
use App\Controllers\RsvpController;
use App\Controllers\SmtpController;
use App\Controllers\SystemAdminController;
use App\Controllers\TextController;
use App\Controllers\TenantUserController;
use App\Middleware\AuthMiddleware;
use App\Middleware\TenantMiddleware;
use DI\Container;
use Slim\Factory\AppFactory;

require __DIR__ . '/../vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// CORS handling - must be before everything
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = array_filter(array_map('trim', explode(',', $_ENV['FRONTEND_URL'] ?? 'http://localhost:5173')));

if (in_array($origin, $allowedOrigins) || in_array('*', $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} elseif (empty($allowedOrigins)) {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Create Container
$container = new Container();
AppFactory::setContainer($container);

// Create App
$app = AppFactory::create();

// Add Body Parsing Middleware
$app->addBodyParsingMiddleware();

// Method override: POST with _method=PUT/PATCH/DELETE (needed because PHP only
// populates $_FILES / getUploadedFiles() for POST requests, not PUT)
$app->add(function ($request, $handler) {
    if ($request->getMethod() === 'POST') {
        $override = $request->getParsedBody()['_method']
            ?? $request->getQueryParams()['_method']
            ?? null;
        if ($override && in_array(strtoupper($override), ['PUT', 'PATCH', 'DELETE'])) {
            $request = $request->withMethod(strtoupper($override));
        }
    }
    return $handler->handle($request);
});

// Add Routing Middleware
$app->addRoutingMiddleware();

// Error Middleware
$errorMiddleware = $app->addErrorMiddleware(
    displayErrorDetails: ($_ENV['APP_ENV'] ?? 'production') === 'development',
    logErrors: true,
    logErrorDetails: true
);

$errorMiddleware->setDefaultErrorHandler(function ($request, $exception, $displayErrorDetails) use ($app) {
    $statusCode = 500;
    if ($exception instanceof \Slim\Exception\HttpNotFoundException) {
        $statusCode = 404;
    } elseif ($exception instanceof \Slim\Exception\HttpMethodNotAllowedException) {
        $statusCode = 405;
    }

    $payload = [
        'success' => false,
        'message' => $displayErrorDetails ? $exception->getMessage() : 'Interner Serverfehler',
    ];

    $response = $app->getResponseFactory()->createResponse($statusCode);
    $response->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));
    return $response->withHeader('Content-Type', 'application/json');
});

// ====================================
// ROUTES
// ====================================

// System admin auth
$app->post('/api/auth/system-login', [AuthController::class, 'systemLogin']);

// System admin routes (protected)
$app->group('/api/system', function ($group) {
    $group->get('/tenants', [SystemAdminController::class, 'listTenants']);
    $group->get('/tenants/{id}', [SystemAdminController::class, 'getTenant']);
    $group->post('/tenants', [SystemAdminController::class, 'createTenant']);
    $group->put('/tenants/{id}', [SystemAdminController::class, 'updateTenant']);
    $group->delete('/tenants/{id}', [SystemAdminController::class, 'deleteTenant']);
    $group->post('/tenants/{id}/reset-password', [SystemAdminController::class, 'resetTenantAdminPassword']);
    $group->post('/change-password', [SystemAdminController::class, 'changePassword']);
})->add(new AuthMiddleware(requireSystemAdmin: true));

// Public RSVP routes (no auth)
$app->get('/api/rsvp/{token}', [RsvpController::class, 'getInvitation']);
$app->post('/api/rsvp/{token}', [RsvpController::class, 'submitRsvp']);
$app->get('/api/rsvp/{token}/attachment', [RsvpController::class, 'downloadAttachment']);

// Public file serving (banners)
$app->get('/api/public/files/{tenant_id}/{filename}', [RsvpController::class, 'servePublicFile']);

// Tenant auth routes
$app->post('/api/{tenant}/auth/login', [AuthController::class, 'login']);
$app->post('/api/{tenant}/auth/logout', [AuthController::class, 'logout']);

// Tenant protected routes
$app->group('/api/{tenant}', function ($group) {

    // Users
    $group->get('/users', [TenantUserController::class, 'listUsers']);
    $group->post('/users', [TenantUserController::class, 'createUser']);
    $group->put('/users/{id}', [TenantUserController::class, 'updateUser']);
    $group->delete('/users/{id}', [TenantUserController::class, 'deleteUser']);
    $group->post('/users/change-password', [TenantUserController::class, 'changePassword']);
    $group->put('/tenant/profile', [TenantUserController::class, 'updateTenantProfile']);

    // Persons
    $group->get('/persons', [PersonController::class, 'listPersons']);
    $group->get('/persons/{id}', [PersonController::class, 'getPerson']);
    $group->post('/persons', [PersonController::class, 'createPerson']);
    $group->put('/persons/{id}', [PersonController::class, 'updatePerson']);
    $group->delete('/persons/{id}', [PersonController::class, 'deletePerson']);
    $group->post('/persons/import', [PersonController::class, 'importPersons']);

    // Dashboard stats
    $group->get('/stats', [EventController::class, 'getDashboardStats']);

    // Events
    $group->get('/events', [EventController::class, 'listEvents']);
    $group->get('/events/{id}', [EventController::class, 'getEvent']);
    $group->post('/events', [EventController::class, 'createEvent']);
    $group->put('/events/{id}', [EventController::class, 'updateEvent']);
    $group->post('/events/{id}', [EventController::class, 'updateEvent']); // method-override alias for file uploads
    $group->delete('/events/{id}', [EventController::class, 'deleteEvent']);
    $group->get('/files/{filename}', [EventController::class, 'serveFile']);

    // Event guests
    $group->get('/events/{event_id}/guests', [EventGuestController::class, 'listGuests']);
    $group->post('/events/{event_id}/guests', [EventGuestController::class, 'addGuests']);
    $group->get('/events/{event_id}/guests/export', [EventGuestController::class, 'exportGuests']);
    $group->delete('/events/{event_id}/guests/{guest_id}', [EventGuestController::class, 'removeGuest']);
    $group->put('/events/{event_id}/guests/{guest_id}/status', [EventGuestController::class, 'updateGuestStatus']);
    $group->post('/events/{event_id}/guests/generate-tokens', [EventGuestController::class, 'generateInvitationTokens']);
    $group->get('/events/{event_id}/guests/stats', [EventGuestController::class, 'getGuestStats']);
    $group->get('/events/{event_id}/guests/{guest_id}/answers', [EventGuestController::class, 'getGuestAnswers']);

    // Questions
    $group->get('/events/{event_id}/questions', [QuestionController::class, 'listQuestions']);
    $group->post('/events/{event_id}/questions', [QuestionController::class, 'createQuestion']);
    $group->put('/events/{event_id}/questions/{id}', [QuestionController::class, 'updateQuestion']);
    $group->delete('/events/{event_id}/questions/{id}', [QuestionController::class, 'deleteQuestion']);
    $group->post('/events/{event_id}/questions/reorder', [QuestionController::class, 'reorderQuestions']);

    // Mail templates
    $group->get('/mail-templates', [MailController::class, 'listTemplates']);
    $group->get('/mail-templates/{id}', [MailController::class, 'getTemplate']);
    $group->post('/mail-templates', [MailController::class, 'createTemplate']);
    $group->put('/mail-templates/{id}', [MailController::class, 'updateTemplate']);
    $group->delete('/mail-templates/{id}', [MailController::class, 'deleteTemplate']);
    $group->post('/mails/send', [MailController::class, 'sendMails']);
    $group->get('/mail-log', [MailController::class, 'getMailLog']);

    // Texts (event-specific)
    $group->get('/events/{event_id}/texts', [TextController::class, 'getTexts']);
    $group->post('/events/{event_id}/texts', [TextController::class, 'saveTexts']);

    // SMTP
    $group->get('/smtp', [SmtpController::class, 'getSmtpConfig']);
    $group->post('/smtp', [SmtpController::class, 'saveSmtpConfig']);
    $group->post('/smtp/test', [SmtpController::class, 'testSmtpConfig']);
    $group->delete('/smtp', [SmtpController::class, 'deleteSmtpConfig']);

})->add(new AuthMiddleware())->add(new TenantMiddleware());

$app->run();
