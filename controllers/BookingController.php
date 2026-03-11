<?php
require_once __DIR__ . '/../models/BookingModel.php';
require_once __DIR__ . '/../models/BoardinghouseModel.php';
require_once __DIR__ . '/../public/auth_middleware.php';

class BookingController {

    private function sendResponse(int $statusCode, array $data): void {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    public function handleRequest(string $method): void {
        // The session is already started by index.php
        $user = authenticate_user();

        switch ($method) {
            case 'GET':
                $this->getBookings($user);
                break;
            case 'POST':
                $this->createBooking($user);
                break;
            case 'PUT':
                $this->updateBookingStatus($user);
                break;
            case 'DELETE':
                // [GI-USAB] Gihimong deleteBooking para ma-handle ang owner ug tenant deletion
                $this->deleteBooking($user);
                break;
            default:
                $this->sendResponse(405, ['status' => 'Error', 'message' => 'Method Not Allowed']);
        }
    }

    private function getBookings(?array $user): void {
        if (!$user) {
            $this->sendResponse(401, ['status' => 'Error', 'message' => 'Authentication required.']);
        }

        $view = $_GET['view'] ?? null;

        try {
            $bookings = [];
            if ($view === 'tenant' && $user['role'] === 'tenant') {
                $bookings = BookingModel::findByTenant($user['id']);
            } elseif ($view === 'owner' && $user['role'] === 'owner') {
                $bookings = BookingModel::findByOwner($user['id']);
            } else {
                $this->sendResponse(403, ['status' => 'Error', 'message' => 'You are not authorized to view this data.']);
            }
            // Use sendResponse for consistency, which automatically encodes to JSON
            $this->sendResponse(200, $bookings);

        } catch (PDOException $e) {
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function createBooking(?array $user): void {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$user || $user['role'] !== 'tenant') {
            $this->sendResponse(403, ['status' => 'Error', 'message' => 'Authentication required. Only tenants can book.']);
        }

        if (!isset($data['bh_id'])) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Boarding house ID is required.']);
        }

        $bh_id = filter_var($data['bh_id'], FILTER_SANITIZE_NUMBER_INT);
        $tenant_id = $user['id'];

        try {
            $existingBooking = BookingModel::findActiveBookingByTenantAndBh($tenant_id, $bh_id);
            if ($existingBooking) {
                $this->sendResponse(409, ['status' => 'Error', 'message' => 'You already have an active booking for this boarding house.']);
            }

            $boardingHouse = BoardingHouseModel::findByIdForAdmin($bh_id);
            if (!$boardingHouse || !isset($boardingHouse['owner_id'])) {
                $this->sendResponse(404, ['status' => 'Error', 'message' => 'Boarding house not found or has no owner.']);
            }
            $owner_id = $boardingHouse['owner_id'];

            $bookingData = [
                'bh_id' => $bh_id,
                'tenant_id' => $tenant_id,
                'owner_id' => $owner_id,
                'expiry_date' => date('Y-m-d H:i:s', strtotime('+3 days')),
                'status' => 'pending'
            ];

            $bookingId = BookingModel::create($bookingData);

            if ($bookingId) {
                $this->sendResponse(200, ['status' => 'Success', 'message' => 'Booking created successfully. Your reservation is valid for 3 days.']);
            } else {
                throw new Exception("Failed to create booking record in database.");
            }
        } catch (PDOException $e) {
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Database error: ' . $e->getMessage()]);
        } catch (Exception $e) {
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * [GI-USAB] Mo-handle sa request para i-delete o i-cancel ang usa ka booking.
     * Pwede kini gamiton sa Tenant (cancel) ug Owner (delete record).
     *
     * @param array|null $user Ang data sa naka-login nga user.
     * @return void
     */
    private function deleteBooking(?array $user): void {
        if (!$user) {
            $this->sendResponse(401, ['status' => 'Error', 'message' => 'Authentication required.']);
        }

        $bookingId = $_GET['id'] ?? null;
        if (!$bookingId) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Booking ID is required.']);
        }

        $success = false;

        if ($user['role'] === 'tenant') {
            // Tenant cancelling their own booking
            $success = BookingModel::delete((int)$bookingId, $user['id']);
        } elseif ($user['role'] === 'owner') {
            // [BAG-O] Owner deleting a booking record
            $success = BookingModel::deleteByOwner((int)$bookingId, $user['id']);
        }

        if ($success) {
            $this->sendResponse(200, ['status' => 'Success', 'message' => 'Booking record deleted successfully.']);
        } else {
            $this->sendResponse(404, ['status' => 'Error', 'message' => 'Booking not found or permission denied.']);
        }
    }

    /**
     * [BAG-O] Mo-handle sa request para i-update ang status sa usa ka booking (approve/reject).
     */
    private function updateBookingStatus(?array $user): void {
        if (!$user || $user['role'] !== 'owner') {
            $this->sendResponse(403, ['status' => 'Error', 'message' => 'Authentication required. Only owners can update booking status.']);
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $bookingId = $data['booking_id'] ?? null;
        $newStatus = $data['status'] ?? null;

        if (!$bookingId || !$newStatus) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Booking ID and new status are required.']);
        }

        try {
            // Ang `updateStatusByOwner` na ang bahala sa security check
            if (BookingModel::updateStatusByOwner((int)$bookingId, $newStatus, $user['id'])) {
                $this->sendResponse(200, ['status' => 'Success', 'message' => 'Booking status updated successfully.']);
            } else {
                $this->sendResponse(404, ['status' => 'Error', 'message' => 'Booking not found or you do not have permission to update it.']);
            }
        } catch (PDOException $e) {
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Database error: ' . $e->getMessage()]);
        }
    }
}