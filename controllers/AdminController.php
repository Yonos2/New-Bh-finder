<?php
// 🔧 FIXED: Added missing includes and session start
require_once __DIR__ . '/../models/Admin.php';
require_once __DIR__ . '/../models/User.php'; // [BAG-O] Gikinahanglan para sa user management
require_once __DIR__ . '/../models/BoardinghouseModel.php';

class AdminController {
    // SEGURIDAD: Kini ang sekreto nga (key) para lang sa mga admin nga gustong mag-signup.
    // Ang purpose ani kay para mapugngan nga bisan kinsa lang makahimo og admin account.
    private const ADMIN_SECRET_KEY = 'bh-finder-secret-key-123';

    private function requireAdminLogin() {
        if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
            http_response_code(401); // Unauthorized
            echo json_encode(["status" => "Error", "message" => "Unauthorized access. Admin login required."]);
            exit;
        }
    }

    /**
     *  Helper function para magpadala og JSON response.
     */
    private function sendResponse($statusCode, $data) {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
    }
    
    public function handleRequest($method) {
        // [SAKTONG PAG-AYO] Siguraduhon nga ang session nagsugod sa dili pa mo-handle sa bisan unsang request.
        // Kini ang mosulbad sa login bug diin ang session data dili ma-save sa unang pagsulay.
        if (session_status() === PHP_SESSION_NONE) {
            // [OPTIMIZED] Mas lig-on nga cookie settings para sa modernong browsers.
            // Kini mosiguro nga ang cookie madawat dayon sa browser.
            session_set_cookie_params([
                'lifetime' => 0,
                'path' => '/',
                'domain' => '',
                'secure' => false, // I-true kini kung naggamit kag HTTPS
                'httponly' => true,
                'samesite' => 'Lax'
            ]);
            session_start();
        }
        header('Content-Type: application/json');

        $objData = json_decode(file_get_contents("php://input"), true);

        // Get the full path from REQUEST_URI and split it
        $request_uri = $_SERVER['REQUEST_URI'];
        $path = trim(parse_url($request_uri, PHP_URL_PATH), '/');
        $path_parts = explode('/', $path);

        // The first part is 'admin', the second part should be the action
        $action = $path_parts[1] ?? null;

        switch ($method) {
            case 'GET':
                // Check for action based on path_parts
                if ($action === 'users') { // Corresponds to /admin/users
                    $this->requireAdminLogin();
                    $users = User::getAll();
                    // [BAG-O] Kung naay 'status' filter, i-apply.
                    if (isset($_GET['status'])) {
                        $users = User::findUsersByStatus($_GET['status']);
                    }
                    $this->sendResponse(200, $users);
                } else if ($action === 'boardinghouses') { // Corresponds to /admin/boardinghouses
                    $this->requireAdminLogin();
                    $boardingHouses = BoardinghouseModel::getAllForAdmin();
                    $this->sendResponse(200, $boardingHouses);
                } else if ($action === 'session') { // Corresponds to /admin/session
                    $this->checkSession();
                } else if ($action && is_numeric($action)) { // For specific admin ID like /admin/123 (if needed)
                    // [GI-AYO] Kini nga bahin para sa pagkuha og specific user, dili admin.
                    // Ang Admin::findById() kay para lang sa admin role.
                    // Kung gusto mokuha og bisan unsang user, gamita ang User::findById().
                    $this->requireAdminLogin();
                    $admin = User::findById($action); // Assuming findById can take the ID directly
                    $this->sendResponse(200, $admin ?: ["status" => "Error", "message" => "Admin not found"]);
                } else {
                    // Fallback or default action if no specific path segment action is found
                    $this->requireAdminLogin(); // Still require admin for any GET to /admin endpoint
                    $this->sendResponse(400, ["status" => "Error", "message" => "Invalid or missing action for GET request."]);
                }
                break;

            case 'POST':
                $action = $objData['action'] ?? null;

                // --- Login Logic ---
                if ($action === 'login') {
                    if (!empty($objData['username']) && !empty($objData['password'])) {
                        // [SAKTONG AYO] Gamiton ang User::authenticate ug ipasa ang 'admin' role
                        // para masiguro nga admin account gyud ang gipangita.
                        $admin = User::authenticate($objData['username'], $objData['password'], 'admin');
                        
                        if ($admin && $admin['role'] === 'admin') {
                            // [BAG-O] Limpyohan ang bisan unsang daan nga session data para sa fresh start.
                            session_unset();

                            // [GI-USAB] Gi-disable ang session_regenerate_id(true) kay kini ang hinungdan
                            // sa "login twice" bug diin mawala ang session sa unang redirect.
                            // session_regenerate_id(true);

                            // [GI-SIMPLIFY] Gihimong parehas sa UserController ang session logic.
                            $_SESSION['user_id'] = $admin['id'];
                            $_SESSION['role'] = $admin['role'];
                            $_SESSION['user_info'] = $admin;
                            
                            // [SOLUSYON] I-save dayon ang session data para mabasa kini sa dashboard inig redirect.
                            session_write_close();
                            echo json_encode(["status" => "Success", "user" => $admin]);
                        } else {
                            echo json_encode(["status" => "Error", "message" => "Invalid credentials"]);
                        }
                    } else {
                        echo json_encode(["status" => "Error", "message" => "Username and password are required"]);
                    }
                } 
                // --- Signup Logic ---
                else if ($action === 'signup') {
                    // SEGURIDAD (ADMIN SIGNUP): Dinhi gisusi kung ang gi-type nga secret key kay parehas ba sa gi-set sa taas.
                    if (!isset($objData['secret_key']) || $objData['secret_key'] !== self::ADMIN_SECRET_KEY) { 
                        http_response_code(403); // Forbidden
                        echo json_encode(["status" => "Error", "message" => "Invalid Admin Secret Key. Access denied."]);
                        return; // Kung sayop ang key, hunungon ang proseso.
                    }

                    // Kung sakto ang secret key, ipadayon ang paghimo og user.
                    if (!empty($objData['username']) && !empty($objData['password'])) {
                        try {
                            // [SAKTONG AYO] Gamiton ang User::create para maghimo og admin account.
                            $adminData = $objData;
                            $adminData['role'] = 'admin'; // I-set gyud ang role sa 'admin'
                            $id = User::create($adminData);
                            echo json_encode(["status" => "Success", "message" => "Admin account created", "id" => $id]);
                        } catch (Exception $e) {
                            http_response_code(409); // Conflict
                            echo json_encode(["status" => "Error", "message" => "Failed to create account: " . $e->getMessage()]);
                        }
                    } else {
                        http_response_code(400); // Bad Request
                        echo json_encode(["status" => "Error", "message" => "Username and password are required"]);
                    }
                }
                // [BAG-O] Action para sa pag-review sa owner (approve/reject)
                else if ($action === 'review_owner') {
                    $this->requireAdminLogin(); // Siguraduhon nga admin ang nag-request
                    if (!isset($objData['user_id']) || !isset($objData['status'])) {
                        $this->sendResponse(400, ["status" => "Error", "message" => "User ID and status are required."]);
                        return;
                    }

                    $userId = $objData['user_id'];
                    $newStatus = $objData['status']; // 'approved' or 'rejected'

                    // [BAG-O] Gamiton ang User model para i-update ang status
                    if (User::updateStatus($userId, $newStatus)) {
                        $this->sendResponse(200, ["status" => "Success", "message" => "Owner status updated to " . $newStatus]);
                    } else {
                        $this->sendResponse(500, ["status" => "Error", "message" => "Failed to update owner status."]);
                    }
                }
                // [BAG-O] Action para markahan nga "viewed" na ang user
                else if ($action === 'mark_user_viewed') {
                    $this->requireAdminLogin();
                    if (!isset($objData['user_id'])) {
                        $this->sendResponse(400, ["status" => "Error", "message" => "User ID is required."]);
                        return;
                    }
                    $userId = $objData['user_id'];
                    if (User::markAsViewed($userId)) {
                        $this->sendResponse(200, ["status" => "Success", "message" => "User marked as viewed."]);
                    } else {
                        $this->sendResponse(500, ["status" => "Error", "message" => "Failed to update user status."]);
                    }
                }
                // [BAG-O] Action para sa pag-delete og user (gibalhin gikan sa UserController)
                else if ($action === 'delete_user') {
                    $this->deleteUser($objData);
                }
                // --- Invalid Action ---
                else {
                    http_response_code(400); // Bad Request
                    echo json_encode(["status" => "Error", "message" => "Invalid or missing action."]);
                }
                break;

            case 'DELETE':
                // [GI-AYO] Ang DELETE method sa AdminController kay para sa pag-delete og user.
                // Ang ID gikan sa query string.
                $this->deleteUser($_GET);
                break;

            default:
                echo json_encode(["status" => "Error", "message" => "Method not allowed"]);
        }
    }

    /**
     * [BAG-O] Function para sa pag-delete og user.
     * Gibalhin gikan sa UserController para ang admin ra ang makadelete og users.
     */
    private function deleteUser($data) {
        $this->requireAdminLogin(); // Siguraduhon nga admin ang nag-request.
        $idToDelete = $data['id'] ?? null;
        if (!$idToDelete) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'User ID is required for deletion.']);
            return;
        }
        // Sigurohon nga dili ma-delete ang kaugalingong admin account
        if ($_SESSION['user_id'] == $idToDelete) {
            $this->sendResponse(403, ['status' => 'Error', 'message' => 'Cannot delete your own admin account.']);
            return;
        }
        $deleted = User::delete($idToDelete);
        $this->sendResponse($deleted ? 200 : 500, ["status" => $deleted ? "Success" : "Error", "message" => $deleted ? "User deleted successfully." : "Failed to delete user."]);
    }

    /**
     *  Function para i-check ang kasamtangang session sa admin.
     */
    public function checkSession() {
        if (isset($_SESSION['user_id']) && isset($_SESSION['role']) && $_SESSION['role'] === 'admin') {
            $this->sendResponse(200, [
                'status' => 'Success',
                'isLoggedIn' => true,
                'user' => $_SESSION['user_info'] ?? null
            ]);
        } else {
            $this->sendResponse(200, [
                'status' => 'Success',
                'isLoggedIn' => false
            ]);
        }
    }
}