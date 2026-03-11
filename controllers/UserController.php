<?php
// 🔧 FIXED: Added missing includes and session start
require_once __DIR__ . '/../models/User.php';

class UserController {

    /**
     *  Punoan nga tigdumala sa request, mopili kung unsa nga function ang tawagon base sa HTTP method.
     */
    public function handleRequest($method) {
        // [SAKTONG PAG-AYO] Siguraduhon nga ang session nagsugod sa dili pa mo-handle sa bisan unsang request.
        // Kini ang mosulbad sa mga isyu diin ang $_SESSION gigamit sa dili pa masugdan (e.g., sa login, logout, checkSession).
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        switch ($method) {
            case 'POST':
                $this->handlePost();
                break;
            case 'GET':
                $this->handleGet();
                break;
            case 'DELETE':
                $this->handleDelete();
                break;
            default:
                $this->sendResponse(405, ['status' => 'Error', 'message' => 'Method Not Allowed']);
                break;
        }
    }

    /**
     *  Mo-handle sa mga POST request (login, signup).
     */
    private function handlePost() {
        // [GI-AYO] Gihimong mas klaro ang pag-handle sa lain-laing Content-Type.
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

        // --- Handle JSON requests (login, password reset) ---
        if (strpos($contentType, 'application/json') !== false) {
            $data = json_decode(file_get_contents('php://input'), true);
            
            // [GI-AYO] I-check kung valid ba ang JSON data
            if (!is_array($data)) {
                $this->sendResponse(400, ['status' => 'Error', 'message' => 'Invalid JSON input']);
            }

            $action = $data['action'] ?? null;

            switch ($action) {
                case 'login':
                    $this->login($data);
                    break;
                case 'verify_reset':
                    $this->verifyReset($data);
                    break;
                case 'reset_password':
                    $this->resetPassword($data);
                    break;
                default:
                    $this->sendResponse(400, ['status' => 'Error', 'message' => 'Invalid JSON action specified.', 'received_action' => $action]);
            }
            return; // Importante: Hunongon ang execution para sa JSON requests.
        }

        // --- Handle form-data requests (para sa signup nga naay file uploads) ---
        // Ang `strpos` para sa 'multipart/form-data' mo-handle sa mga request nga naay file uploads.
        $action = $_POST['action'] ?? null;
        if ($action === 'signup') {
            $this->signup($_POST, $_FILES);
            return;
        }

        // --- Fallback kung dili JSON o signup ---
        $this->sendResponse(415, ['status' => 'Error', 'message' => 'Unsupported Content-Type or invalid action for form data.']);
    }

    /**
     *  Mo-handle sa mga GET request (pagkuha og user data).
     */
    private function handleGet() {
        $action = $_GET['action'] ?? null;
        
        if ($action === 'session') {
            $this->checkSession();
            return;
        }
        
        // [GI-USAB] Ang default GET request sa /user endpoint dapat dili mo-trigger og error.
        // Ang pagkuha sa tanang users dapat sa AdminController na.
        // Magpadala na lang ta og "Invalid Action" kung walay specific action nga gihatag.
        $this->sendResponse(400, ['status' => 'Error', 'message' => 'Invalid GET action specified for user.']);
    }

    /**
     *  Mo-handle sa mga DELETE request (pag-delete og user).
     */
    private function handleDelete() {
        $action = $_GET['action'] ?? null;

        if ($action === 'logout') {
            // Kung ang action kay 'logout', tawagon ang logout function ug mohunong na.
            $this->logout();
            return;
        }

        // [SAKTONG PAG-AYO] Kung dili logout, ang default action kay pag-delete og user, nga para sa admin lang.
        // Gibalhin ang logic sa sulod sa 'else' para dili na mag-execute kung logout ang action.
        $this->authorizeAdmin(); // Siguraduhon nga admin ang nag-request.
        $idToDelete = $_GET['id'] ?? null;
        if (!$idToDelete) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'User ID is required for deletion.']);
        } elseif (User::delete($idToDelete)) {
            $this->sendResponse(200, ['status' => 'Success', 'message' => 'User deleted successfully.']);
        } else {
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Failed to delete user.']);
        }
    }

    /**
     *  Function para sa user login.
     */
    private function login($data) {
        $username = $data['username'] ?? null;
        $password = $data['password'] ?? null;

        if (!$username || !$password) {
            $this->sendResponse(400, ['status' => 'Error', 'message' => 'Username and password are required']);
            return;
        }

        // Tawagon ang gi-ayo nga authenticate function. Dili na kinahanglan ipasa ang role.
        $user = User::authenticate($username, $password);

        if ($user) {
            // [IMPORTANTE] I-store ang user info sa session pagkahuman og login.
            error_log("User::login - User '{$username}' authenticated with role: {$user['role']}");
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['user_info'] = $user;

            // [GI-AYO] Gikuha ang session_write_close(). Ang PHP na ang bahala sa pag-manage sa session lifecycle.
            $this->sendResponse(200, ['status' => 'Success', 'message' => 'Login successful', 'user' => $user]);
        } else {
            $this->sendResponse(401, ['status' => 'Error', 'message' => 'Invalid credentials']);
        }
    }

    /**
     * [BAG-O] I-verify ang user para sa password reset.
     */
    private function verifyReset($data) {
        $username = $data['username'] ?? '';
        $email = $data['email'] ?? '';
        
        $user = User::verifyUserForReset($username, $email);
        if ($user) {
            // [GI-AYO] Pasimplehon ang session reset.
            // Gamiton ang session_unset() para limpyohan ang variables nga dili gub-on ang session file dayon.
            // Kini mas stable sa local development environments.
            session_unset(); 
            
            $_SESSION['reset_user_id'] = $user['id']; // I-store sa session para secure
            $this->sendResponse(200, ['status' => 'Success', 'message' => 'Identity verified. Please enter new password.']);
        } else {
            $this->sendResponse(404, ['status' => 'Error', 'message' => 'No account found with that username and email.']);
        }
    }

    /**
     * [BAG-O] I-reset ang password.
     */
    private function resetPassword($data) {
        if (!isset($_SESSION['reset_user_id'])) {
            $this->sendResponse(403, ['status' => 'Error', 'message' => 'Unauthorized reset request.']);
            return;
        }
        
        $newPassword = $data['new_password'] ?? '';
        if (strlen($newPassword) < 6) {
             $this->sendResponse(400, ['status' => 'Error', 'message' => 'Password must be at least 6 characters.']);
             return;
        }
        
        $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
        if (User::update($_SESSION['reset_user_id'], ['password' => $hashed])) {
            unset($_SESSION['reset_user_id']); // Limpyohan ang session
            $this->sendResponse(200, ['status' => 'Success', 'message' => 'Password reset successfully.']);
        } else {
            $this->sendResponse(500, ['status' => 'Error', 'message' => 'Failed to update password.']);
        }
    }

    /**
     *  Function para sa user signup.
     */
    private function signup($data, $files) {
        try {
            // --- 1. Basic Validation ---
            $required_fields = ['full_name', 'username', 'email', 'password', 'role'];
            foreach ($required_fields as $field) {
                if (empty($data[$field])) {
                    // Gamiton nato ang sendResponse() para consistent
                    $this->sendResponse(400, ['status' => 'Error', 'message' => "Missing required field: {$field}"]);
                    return; // Hunongon ang execution
                }
            }

            $role = $data['role'];

            // --- 2. Owner-specific File Validation ---
            if ($role === 'owner') {
                if (empty($files['idPicture']) || $files['idPicture']['error'] !== UPLOAD_ERR_OK) {
                    throw new Exception('ID Picture is required for owner registration and must be uploaded successfully.', 400);
                }
                if (empty($files['businessPermit']) || $files['businessPermit']['error'] !== UPLOAD_ERR_OK) {
                    throw new Exception('Business Permit is required for owner registration and must be uploaded successfully.', 400);
                }
            }

            // --- 3. Tawagon ang User Model ---
            $userId = User::create($data, $files);

            if ($userId) {
                $this->sendResponse(201, ['status' => 'Success', 'message' => 'User created successfully', 'user_id' => $userId]);
            } else {
                throw new Exception('Failed to create user for an unknown reason.', 500);
            }
        } catch (Exception $e) {
            if ($e instanceof PDOException && $e->getCode() == '23000') {
                $this->sendResponse(409, ['status' => 'Error', 'message' => 'Duplicate entry: The username or email is already taken.']);
            } else {
                $statusCode = ($e->getCode() >= 400 && $e->getCode() < 600) ? $e->getCode() : 500;
                $this->sendResponse($statusCode, ['status' => 'Error', 'message' => $e->getMessage()]);
            }
        }
    }

    /**
     *  Logs out the current user by destroying the session.
     */
    public function logout() {
        // [SAKTONG PAG-AYO] Gamiton ang standard ug mas luwas nga pamaagi sa pag-logout.
        // session_unset() - Hawanan ang tanang session variables.
        session_unset();
        // session_destroy() - Gub-on ang session file sa server.
        session_destroy();

        // Magpadala og success response sa client.
        $this->sendResponse(200, ['status' => 'Success', 'message' => 'Logout successful']);
    }

    /**
     *  Helper function para magpadala og JSON response.
     */
    private function sendResponse($statusCode, $data) {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit; // [IMPORTANTE] Hunongon ang script dinhi para walay extra output nga makaguba sa JSON.
    }

    /**
     *  Helper function para i-check kung admin ba ang naka-login.
     */
    private function authorizeAdmin() {
        if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
            $this->sendResponse(403, ['status' => 'Error', 'message' => 'Forbidden: Admin access required.']);
            exit; // Importante nga ihunong ang script kung dili admin.
        }
    }

    /**
     *  Function para i-check ang kasamtangang session.
     *  Gamiton ni para ma-verify kung naka-login pa ba ang user sa pag-load sa page.
     */
    public function checkSession() {
        error_log("DEBUG: checkSession() called.");
        error_log("DEBUG: \$_SESSION['user_id'] is " . (isset($_SESSION['user_id']) ? "set with value: " . $_SESSION['user_id'] : "not set"));
        error_log("DEBUG: \$_SESSION['user_info'] is " . (isset($_SESSION['user_info']) ? "set" : "not set"));

        if (isset($_SESSION['user_id']) && isset($_SESSION['user_info'])) {
            error_log("DEBUG: checkSession() - Session IS active. User ID: {$_SESSION['user_id']}, Role: {$_SESSION['role']}");
            $this->sendResponse(200, [
                'status' => 'Success',
                'isLoggedIn' => true,
                'user' => $_SESSION['user_info']
            ]);
        } else {
            error_log("DEBUG: checkSession() - Session IS NOT active.");
            $this->sendResponse(200, [
                'status' => 'Success', 
                'isLoggedIn' => false
            ]);
        }
    }
}