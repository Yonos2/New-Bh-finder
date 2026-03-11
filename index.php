<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);
// [SAKTONG AYO] I-una gyud ang session_start() sa tanan.
// Kini ang mosiguro nga andam na ang session sa dili pa ang bisan unsang output o logic.
if (session_status() === PHP_SESSION_NONE) {
    // [GI-SIMPLIFY] Pabay-an ang PHP nga mogamit sa iyang default session cookie settings.
    // Kini ang pinaka-reliable nga pamaagi para masiguro ang session persistence.
    session_start();
}

// Define APP_ROOT - The base directory for both BH_Finder and core
define('APP_ROOT', __DIR__ . '/../..');

// 🟢 Global headers (CORS + JSON for API endpoints)
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($requestOrigin) {
    header("Access-Control-Allow-Origin: $requestOrigin");
    header('Vary: Origin');
} else {
    header('Access-Control-Allow-Origin: http://localhost:8000');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true'); // Allow credentials (cookies, HTTP auth) to be sent with requests

// 🟢 Handle CORS preflight request early and exit
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 🟢 Core files - Sigurohon nga saktong relative path ang gigamit.
require_once APP_ROOT . '/core/Database.php';

// Models
require_once APP_ROOT . '/BH_Finder/models/User.php';
require_once APP_ROOT . '/BH_Finder/models/BoardinghouseModel.php';
require_once APP_ROOT . '/BH_Finder/models/Admin.php';
require_once APP_ROOT . '/BH_Finder/models/BookingModel.php'; // [BAG-O] I-apil ang bag-ong model

// Controllers
require_once APP_ROOT . '/BH_Finder/controllers/UserController.php';
require_once APP_ROOT . '/BH_Finder/controllers/BoardinghouseController.php';
require_once APP_ROOT . '/BH_Finder/controllers/AdminController.php';
require_once APP_ROOT . '/BH_Finder/controllers/BookingController.php'; // [BAG-O] I-apil ang bag-ong controller

// [SAKTONG ROUTING LOGIC]
// I-parse ang request URI para makuha ang endpoint (e.g., /user, /admin)
$request_uri = $_SERVER['REQUEST_URI'];
$path = trim(parse_url($request_uri, PHP_URL_PATH), '/');

// 🧠 [KRITIKAL NGA PAG-AYO] Kuhaon ang unang bahin sa URL path isip endpoint.
// Pananglitan: Ang request para sa "/boardinghouse?q=test" o "/boardinghouse"
// Ang $path mahimong "boardinghouse"
// Ang $endpoint mahimong "boardinghouse"
$endpoint = explode('/', $path)[0];

$method = strtoupper($_SERVER['REQUEST_METHOD']);
try {
    switch ($endpoint) {
        case 'user':
            // [SAKTONG AYO] I-pasa ang request sa UserController.
            // Check for a specific sub-endpoint for session checking (e.g., /user/session)
            $path_parts = explode('/', $path); // e.g., ['user', 'session']
            if (isset($path_parts[1]) && $path_parts[1] === 'session') {
                (new UserController())->checkSession();
            } else {
                (new UserController())->handleRequest($method);
            }
            break;

        case 'boardinghouse':
            // I-pasa ang request sa BoardinghouseController.
            (new BoardinghouseController())->handleRequest($method);
            break;

        case 'admin':
            // I-pasa ang request sa AdminController.
            (new AdminController())->handleRequest($method);
            break;

        case 'geocode':
            // Handle Nominatim geocoding requests via proxy
            (new BoardinghouseController())->proxyGeocode();
            break;

        case 'room':
            // [BAG-O] Endpoint para sa pag-manage sa individual rooms
            (new BoardinghouseController())->handleRoomRequest($method);
            break;

        case 'notification':
            // [BAG-O] Endpoint para sa pag-handle sa notification-related requests
            (new BoardinghouseController())->handleNotificationRequest($method);
            break;

        case 'booking':
            // [SAKTONG AYO] I-pasa ang request sa BookingController para sa mas consistent nga pag-handle.
            (new BookingController())->handleRequest($method); // Kini ang mo-handle sa GET, POST, PUT, DELETE
            break;

        default:
            http_response_code(404);
            header('Content-Type: application/json');
            echo json_encode([
                'status' => 'Error',
                'message' => 'Endpoint not found'
            ]);
            break;
    }
} catch (Throwable $e) {
    // Error handler para sa bisan unsang wala damha nga sayop.
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'Error',
        'message' => 'Server error',
        'error' => $e->getMessage()
    ]);
}