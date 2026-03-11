<?php
require_once __DIR__ . '/../models/BoardinghouseModel.php';
require_once __DIR__ . '/../models/User.php'; // Needed for user roles, etc.
require_once __DIR__ . '/../../core/Database.php'; // Required by BoardinghouseModel, but good to ensure

class BoardinghouseController {

    private function requireUserLogin(): void {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (!isset($_SESSION['user_id'])) {
            $this->sendResponse(401, ['status' => 'Error', 'message' => 'Unauthorized access. Login required.']);
            exit;
        }
    }

    private function requireOwnerOrAdmin(): void {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (!isset($_SESSION['user_id']) || ($_SESSION['role'] !== 'owner' && $_SESSION['role'] !== 'admin')) {
            $this->sendResponse(403, ['status' => 'Error', 'message' => 'Forbidden. Owner or Admin access required.']);
            exit;
        }
    }

    private function sendResponse(int $statusCode, array $data): void {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    public function handleRequest(string $method): void {
        // Ensure session is started for all operations in this controller
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        switch ($method) {
            case 'GET':
                $this->getBoardingHouses();
                // Check if the request is for geocoding
                if (isset($_GET['action']) && $_GET['action'] === 'geocode') {
                    $this->proxyGeocode();
                    return; // Stop further execution
                }
                break;
            case 'POST':
                $this->requireOwnerOrAdmin(); // Only owner or admin can add BH
                $this->createBoardingHouse();
                break;
            case 'PUT':
                $this->requireOwnerOrAdmin(); // Only owner or admin can update BH
                $this->updateBoardingHouse();
                break;
            case 'DELETE':
                $this->requireOwnerOrAdmin(); // Only owner or admin can delete BH
                $this->deleteBoardingHouse();
                break;
            default:
                $this->sendResponse(405, ['status' => 'Error', 'message' => 'Method Not Allowed']);
        }
    }

    /**
     * [BAG-O] Function para i-handle ang mga request para sa individual rooms.
     */
    public function handleRoomRequest(string $method): void {
        $this->requireOwnerOrAdmin(); // Siguraduhon nga owner o admin lang ang maka-access

        switch ($method) {
            case 'GET':
                $bhId = $_GET['bh_id'] ?? null;
                if ($bhId) {
                    $rooms = BoardingHouseModel::getRooms($bhId);
                    $this->sendResponse(200, $rooms);
                }
                break;
            case 'POST':
                $this->addRoomToBoardingHouse();
                break;
            case 'DELETE':
                $this->deleteRoomFromBoardingHouse();
                break;
        }
    }

    /**
     * [BAG-O] Function para i-handle ang mga request para sa notifications.
     */
    public function handleNotificationRequest(string $method): void
    {
        switch ($method) {
            case 'GET':
                $this->getNotificationsForOwner();
                break;
            case 'PUT':
                // Para sa pag-mark as read sa umaabot
                $this->markNotificationAsRead();
                break;
            default:
                $this->sendResponse(405, ['status' => 'Error', 'message' => 'Method Not Allowed for notifications.']);
        }
    }

    /**
     * [BAG-O] Function para i-mark as read ang usa ka notification.
     */
    private function markNotificationAsRead(): void
    {
        $this->requireUserLogin();
        $notifId = $_GET['id'] ?? null;
        if (!$notifId) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Notification ID is required.']);
        }

        // I-assume nga naay function sa model para ani.
        // BoardingHouseModel::markNotificationAsRead($notifId, $_SESSION['user_id']);
        $this->sendResponse(200, ['status' => 'Success']); // Fire-and-forget
    }

    private function getBoardingHouses(): void {
        try {
            $id = $_GET['id'] ?? null;
            $ownerId = $_GET['owner_id'] ?? null;
            $view = $_GET['view'] ?? 'public'; // 'public' or 'admin'

            // Determine the server's base URL dynamically
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
            $host = $_SERVER['HTTP_HOST'];
            // [GI-AYO] Tungod kay ang document root kay ang 'public' folder (-t public),
            // ang base URL dapat mao ra ang protocol ug host.
            $base_url = $protocol . $host; // e.g., http://localhost:8000

            if ($id) {
                // Fetch a single boarding house
                $boardingHouse = ($view === 'admin') ? BoardingHouseModel::findByIdForAdmin($id) : BoardingHouseModel::findById($id);

                if (!$boardingHouse) {
                    $this->sendResponse(404, ['status' => 'Error', 'message' => 'Boarding house not found']);
                    return;
                }

                // Make image URLs absolute
                if (!empty($boardingHouse['image_urls']) && is_array($boardingHouse['image_urls'])) {
                    $boardingHouse['image_urls'] = array_map(function($url) use ($base_url) {
                        // [GI-AYO] Siguraduhon nga dili magdoble ang slash.
                        // Ang $base_url mahimong naay trailing slash, ug ang $url mahimong naay leading slash.
                        if (strpos($url, 'http') === 0) {
                            return $url; // Kung full URL na, ayaw na usba
                        }
                        // I-combine ang duha ka parte ug dayon i-replace ang double slash sa usa lang.
                        return $base_url . '/' . ltrim($url, '/');
                    }, $boardingHouse['image_urls']);
                }

                // Also make room image URLs absolute if they exist
                if (!empty($boardingHouse['rooms'])) { // rooms might be string or array
                    $rooms = is_string($boardingHouse['rooms']) ? json_decode($boardingHouse['rooms'], true) : $boardingHouse['rooms'];
                    if ($rooms) {
                        foreach ($rooms as &$room) {
                            if (!empty($room['image_urls']) && is_array($room['image_urls'])) {
                                $room['image_urls'] = array_map(function($url) use ($base_url) {
                                    // [GI-AYO] I-apply ang parehas nga logic sa room images.
                                    if (strpos($url, 'http') === 0) {
                                        return $url;
                                    }
                                    return $base_url . '/' . ltrim($url, '/');
                                }, $room['image_urls']);
                            }
                        }
                        $boardingHouse['rooms'] = $rooms; // Keep as array
                    }
                }

                $this->sendResponse(200, $boardingHouse);

            } else {
                // Fetch a list of boarding houses
                $boardingHouses = [];

                // [GI-AYO] Kolektahon tanan filters gikan sa URL
                $filters = [
                    'q' => $_GET['q'] ?? null,
                    'min_price' => $_GET['min_price'] ?? null,
                    'max_price' => $_GET['max_price'] ?? null,
                ];

                // I-filter out ang mga empty values
                $filters = array_filter($filters);

                if ($ownerId) {
                    $boardingHouses = BoardingHouseModel::findByOwner($ownerId);
                } else {
                    // Gamiton ang bag-ong flexible search function
                    $boardingHouses = BoardingHouseModel::search($filters);
                }

                // Make all image URLs absolute for the list
                foreach ($boardingHouses as &$house) {
                    if (!empty($house['image_urls']) && is_array($house['image_urls'])) {
                        $house['image_urls'] = array_map(function($url) use ($base_url) {
                            // [GI-AYO] I-apply ang parehas nga logic sa list view.
                            if (strpos($url, 'http') === 0) {
                                return $url;
                            }
                            return $base_url . '/' . ltrim($url, '/');
                        }, $house['image_urls']);
                    }
                }
                $this->sendResponse(200, $boardingHouses);
            }

        } catch (Exception $e) {
            error_log("BH_Finder Error: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Failed to retrieve data', 'error' => $e->getMessage()]);
        }
    }

    /**
     * Helper function para i-save ang Base64 encoded image sa usa ka file.
     *
     * @param string $base64_string Ang Base64 data sa hulagway.
     * @param string $upload_dir Ang folder kung asa i-save ang file.
     * @return string|null Ang public URL sa na-save nga file, o null kung naay error.
     */
    private function save_base64_image($base64_string, $upload_dir) {
        if (empty($base64_string) || !str_contains($base64_string, ',')) {
            return null;
        }

        list($type, $data) = explode(';', $base64_string);
        list(, $data)      = explode(',', $data);
        $data = base64_decode($data);

        if ($data === false) {
            return null;
        }

        preg_match('/^data:image\/(png|jpeg|jpg|gif)/', $base64_string, $matches);
        $extension = $matches[1] ?? 'jpg';
        if ($extension === 'jpeg') $extension = 'jpg';

        $filename = uniqid('bh_', true) . '.' . $extension;
        $file_path = $upload_dir . '/' . $filename;

        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }

        if (file_put_contents($file_path, $data)) {
            return 'uploads/' . $filename;
        }

        return null;
    }

    private function createBoardingHouse(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Invalid JSON input.']);
        }

        if (!isset($_SESSION['user_id'])) {
            $this->sendResponse(401, ['status' => 'Error', 'message' => 'Unauthorized. Owner ID not found in session.']);
        }
        $input['owner_id'] = $_SESSION['user_id'];

        // [GI-AYO] Siguraduhon nga ang upload directory motudlo sa saktong 'public/uploads' folder.
        // Ang __DIR__ . '/../' motudlo sa 'controllers' folder, busa '/../public/uploads' ang saktong dalan.
        $upload_dir = __DIR__ . '/../public/uploads';

        // 1. I-proseso ang mga main BH images
        $bh_image_urls = [];
        if (isset($input['images']) && is_array($input['images'])) {
            foreach ($input['images'] as $base64_image) {
                $url = $this->save_base64_image($base64_image, $upload_dir);
                if ($url) {
                    $bh_image_urls[] = $url;
                }
            }
        }
        $input['image_urls'] = json_encode($bh_image_urls);

        // 2. I-proseso ang mga hulagway sa matag kwarto
        if (isset($input['rooms']) && is_array($input['rooms'])) {
            foreach ($input['rooms'] as &$room) { // Use reference to modify directly
                $room_image_urls = [];
                if (isset($room['files']) && is_array($room['files'])) {
                    foreach ($room['files'] as $base64_image) {
                        $url = $this->save_base64_image($base64_image, $upload_dir);
                        if ($url) {
                            $room_image_urls[] = $url;
                        }
                    }
                }
                $room['image_urls'] = $room_image_urls;
                unset($room['files']);
            }
        }
        $input['rooms'] = json_encode($input['rooms'] ?? []);

        try {
            $bhId = BoardingHouseModel::create($input);
            $this->sendResponse(201, ['status' => 'Success', 'message' => 'Boarding house created successfully.', 'id' => $bhId]);
        } catch (Exception $e) {
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Failed to create boarding house.', 'error' => $e->getMessage()]);
        }
    }

    private function updateBoardingHouse(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id'])) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Invalid JSON input or missing ID.']);
        }

        $bhId = $input['id'];
        $action = $input['action'] ?? null;

        if ($action === 'update_status') {
            if (!isset($input['status'])) {
                $this->sendResponse(400, ['status' => 'Error', 'message' => 'Missing status for update.']);
            }
            // Only admin can update status to approved/rejected
            if ($_SESSION['role'] !== 'admin') {
                $this->sendResponse(403, ['status' => 'Error', 'message' => 'Only admins can change status.']);
            }
            try {
                // [GI-AYO] I-pass ang rejection reason sa updateStatus
                if (BoardingHouseModel::updateStatus($bhId, $input['status'], $input['rejection_reason'] ?? null)) {
                    
                    // [BAG-O] Paghimo og notification human ma-update ang status
                    if ($input['status'] === 'approved' || $input['status'] === 'rejected') {
                        BoardingHouseModel::createStatusNotification($bhId, $input['status']);
                    }

                    $this->sendResponse(200, ['status' => 'Success', 'message' => 'Boarding house status updated.']);
                } else {
                    $this->sendResponse(400, ['status' => 'Error', 'message' => 'Failed to update status.']);
                }
            } catch (Exception $e) {
                error_log("BH_Finder Status Update Error: " . $e->getMessage());
                $this->sendResponse(500, ['status' => 'Error', 'message' => 'Database error on status update.']);
            }
            return; // Exit after status update
        }

        // For regular updates by owner
        if ($_SESSION['role'] !== 'owner' && $_SESSION['role'] !== 'admin') {
             $this->sendResponse(403, ['status' => 'Error', 'message' => 'Only owner or admin can update this boarding house.']);
        }

        // Verify ownership for owners
        if ($_SESSION['role'] === 'owner') {
            $bh = BoardingHouseModel::findByIdForAdmin($bhId); // Use for admin view to get all details including owner_id
            if (!$bh || $bh['owner_id'] != $_SESSION['user_id']) {
                $this->sendResponse(403, ['status' => 'Error', 'message' => 'You do not own this boarding house.']);
            }
        }
        
        // Remove 'id' and 'owner_id' from input if present, to prevent unauthorized changes
        unset($input['id']);
        unset($input['owner_id']);
        // [GI-AYO] I-unset ang mga fields nga dili dapat ma-update direkta sa user
        // sama sa status, rejection_reason, ug uban pa.
        unset($input['status']);
        unset($input['rejection_reason']);
        unset($input['action']); // Remove action field

        // Handle image updates if needed (similar to create, but for existing BH)
        // This part needs careful consideration if images are handled via base64 in update.
        // For simplicity, let's assume image updates are separate or append for now.
        // If image_urls is passed, it should be the full array of URLs, not raw files.
        if (isset($input['image_urls']) && is_array($input['image_urls'])) {
            $input['image_urls'] = json_encode($input['image_urls']);
        }
        if (isset($input['rooms']) && is_array($input['rooms'])) {
             // For room updates, we assume the frontend sends the full updated JSON structure for rooms
             $input['rooms'] = json_encode($input['rooms']);
        }


        try {
            if (BoardingHouseModel::update($bhId, $input)) {
                $this->sendResponse(200, ['status' => 'Success', 'message' => 'Boarding house updated successfully.']);
            } else {
                $this->sendResponse(500, ['status' => 'Error', 'message' => 'Failed to update boarding house.']);
            }
        } catch (Exception $e) {
            error_log("BH_Finder Update Error: " . $e->getMessage());
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Database error on update.']);
        }
    }

    private function deleteBoardingHouse(): void {
        $id = $_GET['id'] ?? null; // Get ID from query string for DELETE
        if (!$id) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Missing ID for deletion.']);
        }

        // Verify ownership for owners
        if ($_SESSION['role'] === 'owner') {
            $bh = BoardingHouseModel::findByIdForAdmin($id);
            if (!$bh || $bh['owner_id'] != $_SESSION['user_id']) {
                $this->sendResponse(403, ['status' => 'Error', 'message' => 'You do not own this boarding house.']);
            }
        }

        try {
            if (BoardingHouseModel::delete($id)) {
                $this->sendResponse(200, ['status' => 'Success', 'message' => 'Boarding house deleted successfully.']);
            } else {
                $this->sendResponse(500, ['status' => 'Error', 'message' => 'Failed to delete boarding house.']);
            }
        } catch (Exception $e) {
            error_log("BH_Finder Delete Error: " . $e->getMessage());
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Database error on delete.']);
        }
    }

    public function proxyGeocode(): void {
        error_log("BH_Finder ProxyGeocode Debug: proxyGeocode method called.");
        $query = $_GET['q'] ?? '';
        error_log("BH_Finder ProxyGeocode Debug: Query received: " . $query);

        if (empty($query)) {
            error_log("BH_Finder ProxyGeocode Debug: Empty query, sending 400 response.");
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Query parameter "q" is required.']);
            return;
        }

        // Construct Nominatim API URL
        // Prioritize results near Dapitan City, ZN using viewbox
        $nominatimUrl = "https://nominatim.openstreetmap.org/search?" . http_build_query([
            'format' => 'json',
            'q' => $query,
            'countrycodes' => 'ph',
            'viewbox' => '123.35,8.7,123.5,8.5', // Coordinates for Dapitan City area
            'bounded' => 1,
            'limit' => 5
        ]);
        error_log("BH_Finder ProxyGeocode Debug: Nominatim URL: " . $nominatimUrl);

        // Use cURL for a robust server-side request
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $nominatimUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        // 🧠 [KRITIKAL NGA PAG-AYO] I-set ang User-Agent para malikayan ang pagka-block sa Nominatim.
        // Kinahanglan ni para mo-comply sa ilang usage policy.
        // Ilisi ang email sa imong tinuod nga email para kung naay problema, makontak ka nila.
        curl_setopt($ch, CURLOPT_USERAGENT, 'BH_Finder_App/1.0 (contact: jaysoncabanero222000@email.com)');
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); 

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        error_log("BH_Finder ProxyGeocode Debug: cURL executed. HTTP Code: " . $httpCode);

        if (curl_errno($ch)) {
            $error_msg = curl_error($ch);
            curl_close($ch);
            error_log("BH_Finder ProxyGeocode Error: Nominatim cURL Error: " . $error_msg);
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Failed to connect to geocoding service.', 'curl_error' => $error_msg]);
            return;
        }
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("BH_Finder ProxyGeocode Error: Nominatim API returned HTTP " . $httpCode . ": " . $response);
            $this->sendResponse($httpCode, ['status' => 'Error', 'message' => 'Geocoding service returned an error.', 'nominatim_response' => $response]);
            return;
        }

        // Forward Nominatim's response directly to the client
        header('Content-Type: application/json');
        echo $response;
        error_log("BH_Finder ProxyGeocode Debug: Forwarding Nominatim response. Exiting.");
        exit;
    }

    /**
     * [BAG-O] Function para mag-add ug kwarto sa usa ka existing boarding house.
     */
    private function addRoomToBoardingHouse(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['bh_id']) || !isset($input['name']) || !isset($input['price_per_month'])) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Missing required room data.']);
            return;
        }

        $bhId = $input['bh_id'];

        // I-verify kung ang nag-request kay mao ba ang tag-iya
        if ($_SESSION['role'] === 'owner') {
            $bh = BoardingHouseModel::findByIdForAdmin($bhId);
            if (!$bh || $bh['owner_id'] != $_SESSION['user_id']) {
                $this->sendResponse(403, ['status' => 'Error', 'message' => 'You do not own this boarding house.']);
                return;
            }
        }

        $upload_dir = __DIR__ . '/../public/uploads';
        $room_image_urls = [];
        if (isset($input['image_urls']) && is_array($input['image_urls'])) {
            foreach ($input['image_urls'] as $base64_image) {
                $url = $this->save_base64_image($base64_image, $upload_dir);
                if ($url) $room_image_urls[] = $url;
            }
        }
        $input['image_urls'] = $room_image_urls;

        $roomId = BoardingHouseModel::addRoom($bhId, $input);
        $this->sendResponse(201, ['status' => 'Success', 'message' => 'Room added successfully.', 'room_id' => $roomId]);
    }

    /**
     * [BAG-O] Function para mag-delete ug kwarto gikan sa usa ka existing boarding house.
     */
    private function deleteRoomFromBoardingHouse(): void {
        $bhId = $_GET['bh_id'] ?? null;
        $roomId = $_GET['room_id'] ?? null;

        if (!$bhId || !$roomId) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Missing boarding house ID or room ID.']);
            return;
        }

        // I-verify kung ang nag-request kay mao ba ang tag-iya
        if ($_SESSION['role'] === 'owner') {
            $bh = BoardingHouseModel::findByIdForAdmin($bhId);
            if (!$bh || $bh['owner_id'] != $_SESSION['user_id']) {
                $this->sendResponse(403, ['status' => 'Error', 'message' => 'You do not own this boarding house.']);
                return;
            }
        }

        BoardingHouseModel::deleteRoom($bhId, $roomId);
        $this->sendResponse(200, ['status' => 'Success', 'message' => 'Room deleted successfully.']);
    }
}