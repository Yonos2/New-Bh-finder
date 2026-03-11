<?php
/**
 * API Endpoint para sa pag-handle sa mga booking.
 *
 * HTTP Methods:
 * - POST: Para mag-create og bag-ong booking.
 * - GET: Para mukuha sa mga booking (para sa tenant o owner).
 */

header('Content-Type: application/json');

// Sigurohon nga ang session gisugdan na.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// [GI-AYO] I-require ang mga models nga gikinahanglan para sa database operations.
// Ang matag model na ang bahala sa pag-establish sa ilang kaugalingong database connection.
require_once __DIR__ . '/../models/BookingModel.php';
require_once __DIR__ . '/../models/BoardinghouseModel.php';

require_once 'auth_middleware.php';

// I-authenticate ang user. Kung walay naka-login, hunongon ang script.
$user = authenticate_user();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    // --- Logic para sa pag-CREATE og bag-ong booking ---
    $data = json_decode(file_get_contents('php://input'), true);

    // [GI-AYO] I-check kung tenant ba ang user para sa POST request
    if (!$user || $user['role'] !== 'tenant') {
        http_response_code(403); // Forbidden
        echo json_encode(['status' => 'Error', 'message' => 'Authentication required. Only tenants can book.']);
        exit;
    }

    if (!isset($data['bh_id'])) {
        http_response_code(400); // Bad Request
        echo json_encode(['status' => 'Error', 'message' => 'Boarding house ID is required.']);
        exit;
    }

    $bh_id = filter_var($data['bh_id'], FILTER_SANITIZE_NUMBER_INT);
    $tenant_id = $user['id'];

    try {
        // I-check kung naa na bay active booking ang tenant sa maong BH
        // [GI-AYO] Gamiton ang model para sa mas limpyo nga code.
        // (Note: Maghimo ta og assumption nga naay ing-ani nga function sa BookingModel or i-implement nato)
        $existingBooking = BookingModel::findActiveBookingByTenantAndBh($tenant_id, $bh_id);
        if ($existingBooking) {
            http_response_code(409); // Conflict
            echo json_encode(['status' => 'Error', 'message' => 'You already have an active booking for this boarding house.']);
            exit;
        }

        // [GI-AYO] Kuhaon ang owner_id gikan sa boarding house
        $boardingHouse = BoardingHouseModel::findByIdForAdmin($bh_id); // Gamiton ang findByIdForAdmin para makuha ang owner_id
        if (!$boardingHouse || !isset($boardingHouse['owner_id'])) {
            http_response_code(404); // Not Found
            echo json_encode(['status' => 'Error', 'message' => 'Boarding house not found or has no owner.']);
            exit;
        }
        $owner_id = $boardingHouse['owner_id'];

        // [GI-AYO] Gamiton ang BookingModel->create() para i-insert ang bag-ong booking
        $bookingData = [
            'bh_id' => $bh_id,
            'tenant_id' => $tenant_id,
            'owner_id' => $owner_id,
            'expiry_date' => date('Y-m-d H:i:s', strtotime('+3 days')),
            'status' => 'pending' // or 'active' depende sa imong logic
        ];

        $bookingId = BookingModel::create($bookingData);

        if ($bookingId) {
            echo json_encode(['status' => 'Success', 'message' => 'Booking created successfully. Your reservation is valid for 3 days.']);
        } else {
            throw new Exception("Failed to create booking record in database.");
        }
    } catch (PDOException $e) {
        http_response_code(500); // Internal Server Error
        // Para sa development, ipakita ang error. Sa production, i-log na lang.
        echo json_encode(['status' => 'Error', 'message' => 'Database error: ' . $e->getMessage()]);
    }
} elseif ($method === 'GET') {
    // --- [BAG-O] Logic para sa pag-FETCH sa mga booking ---

    if (!$user) {
        http_response_code(401); // Unauthorized
        echo json_encode(['status' => 'Error', 'message' => 'Authentication required.']);
        exit;
    }

    $view = $_GET['view'] ?? null;

    try {
        $bookings = [];

        if ($view === 'tenant' && $user['role'] === 'tenant') {
            // [GI-AYO] Gamiton ang BookingModel para makuha ang bookings sa tenant
            $bookings = BookingModel::findByTenant($user['id']);

        } elseif ($view === 'owner' && $user['role'] === 'owner') {
            // [GI-AYO] Gamiton ang BookingModel para makuha ang bookings sa owner
            $bookings = BookingModel::findByOwner($user['id']);

        } else {
            http_response_code(403); // Forbidden
            echo json_encode(['status' => 'Error', 'message' => 'You are not authorized to view this data.']);
            exit;
        }

        echo json_encode($bookings);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['status' => 'Error', 'message' => 'Database error: ' . $e->getMessage()]);
    }

}
else {
    // I-handle ang ubang methods kung dili POST o GET
    http_response_code(405); // Method Not Allowed
    echo json_encode(['status' => 'Error', 'message' => 'Method not allowed.']);
}