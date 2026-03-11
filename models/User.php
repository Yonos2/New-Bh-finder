<?php
// [SAKTONG PAG-AYO] Gidugang ang saktong path sa Database.php.
require_once __DIR__ . '/../../core/Database.php';

class User {
    // GET: All users
    public static function getAll() {
        $db = Database::getInstance();
        $stmt = $db->query("SELECT * FROM pos_schema.users WHERE role != 'admin' ORDER BY id");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * [BAG-O] Mokuha sa tanang users base sa ilang status.
     * [GI-TANGTANG] Gi-comment out kay wala na ang 'status' column sa 'users' table.
     * @param string $status Ang status nga pangitaon (e.g., 'pending', 'approved', 'rejected').
     * @return array Lista sa mga users.
     */
    /*
    public static function findUsersByStatus(string $status): array {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM pos_schema.users WHERE status = :status ORDER BY created_at DESC");
        $stmt->execute([':status' => $status]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    */
    // GET: Single user by ID
    public static function findById($id) {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM pos_schema.users WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // GET: Single user by username
    public static function findByUsername($username) {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM pos_schema.users WHERE username = :username");
        $stmt->execute([':username' => $username]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // CREATE: Insert new user
    public static function create($data, $files = []) {
        $db = Database::getInstance();

        // --- [BAG-O] File Upload Logic para sa Owner ---
        $id_picture_path = null;
        $business_permit_path = null;
        $role = $data['role'] ?? 'tenant';

        // [BAG-O NGA DEBUG LOG] I-log ang tibuok sulod sa $_FILES array para makita kung nadawat ba.
        error_log("[DEBUG] User::create - Received files array: " . print_r($files, true));

        if ($role === 'owner') {
            // [GI-USAB] Himuong mas simple ang folder path.
            // [GI-USAB] Gihimong 'user_documents' ang pangalan sa folder para dili magkasagol sa laing uploads.
            // [SAKTONG PAG-AYO] Ibutang ang upload folder sa sulod sa 'public' directory para ma-access sa web.
            $upload_dir = __DIR__ . '/../public/user_documents/'; 

            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0775, true);
            }

            // [BAG-O NGA SEGURIDAD] I-check kung ang folder writable ba.
            // Kini ang kasagarang hinungdan sa file upload errors.
            if (!is_writable($upload_dir)) {
                throw new Exception("Upload directory is not writable. Please check folder permissions for '{$upload_dir}'.");
            }

            // Helper function para sa pag-move sa file
            $moveFile = function($fileKey, $prefix) use ($upload_dir, $files) {
                // [BAG-O NGA LOG] Susiha kung ang file key anaa ba sa $files array.
                error_log("[DEBUG] moveFile: Checking for file key '{$fileKey}'.");

                if (isset($files[$fileKey]) && $files[$fileKey]['error'] == 0) {
                    $file = $files[$fileKey];

                    // [BAG-O NGA SEGURIDAD] I-verify ang MIME type sa file para masigurong hulagway gyud.
                    $finfo = finfo_open(FILEINFO_MIME_TYPE);
                    $mime_type = finfo_file($finfo, $file['tmp_name']);
                    finfo_close($finfo);

                    $allowed_mime_types = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
                    if (!in_array($mime_type, $allowed_mime_types)) {
                        throw new Exception("Invalid file type for {$fileKey}. Only JPG, PNG, GIF, and PDF are allowed.");
                    }

                    $filename = $prefix . uniqid() . '-' . preg_replace("/[^a-zA-Z0-9\._-]/", "_", basename($file['name']));
                    $target_file = $upload_dir . $filename;

                    // [BAG-O NGA LOG] I-log ang temporaryong file ug ang destinasyon niini.
                    error_log("[DEBUG] moveFile: Attempting to move '{$file['tmp_name']}' to '{$target_file}'.");

                    if (move_uploaded_file($file['tmp_name'], $target_file)) {
                        // I-return ang relative path para i-save sa database
                        // [GI-USAB] I-adjust ang path nga i-save sa database para motugma sa bag-ong lokasyon.
                        // Ang 'public/' dili na kinahanglan.

                        // [BAG-O NGA LOG] Kumpirmahon nga malampuson ang pag-move sa file.
                        error_log("[DEBUG] moveFile: Successfully moved file for key '{$fileKey}'.");
                        return 'user_documents/' . $filename; 
                    } else {
                        // [SAKTONG PAG-AYO] I-throw dayon ang error kung mapakyas ang pag-move.
                        throw new Exception("Failed to move uploaded file for {$fileKey}. Check server logs and folder permissions.");
                    }
                }

                // [GI-AYO] Mas klaro nga error message kung wala gyud nadawat ang file.
                // Kini kasagaran tungod sa PHP configuration (upload_max_filesize).
                if (!isset($files[$fileKey])) {
                    throw new Exception("No file data received for {$fileKey}. This might be due to server upload limits (e.g., 'upload_max_filesize' in php.ini).");
                }
                
                throw new Exception("File upload failed for {$fileKey}. Error code: " . ($files[$fileKey]['error'] ?? 'N/A'));
            };

            $id_picture_path = $moveFile('idPicture', 'id-');
            $business_permit_path = $moveFile('businessPermit', 'permit-');

            // Ang validation sa sulod sa `moveFile` na ang bahala sa pag-throw og error kung naay mapakyas.
        }

        // --- Database Insertion ---
        // [GI-USAB] Gidugang ang mga bag-ong columns
        // [GI-USAB] Gikuha na ang `id_type` sa query
        // [GI-AYO] Gitangtang ang 'status' column kay wala kini sa database.
        $sql = "INSERT INTO pos_schema.users 
                    (username, password, full_name, email, phone, role, id_picture_path, business_permit_path)
                VALUES 
                    (:username, :password, :full_name, :email, :phone, :role, :id_picture_path, :business_permit_path)";
        
        $params = [
            ':username'   => $data['username'],
            ':password'   => password_hash($data['password'], PASSWORD_DEFAULT),
            ':full_name'  => $data['full_name'] ?? null,
            ':email'      => $data['email'] ?? null,
            ':phone'      => $data['phone'] ?? null,
            ':role'       => $role,
            // [BAG-O] I-bind ang mga bag-ong values
            ':id_picture_path' => $id_picture_path,
            ':business_permit_path' => $business_permit_path
        ];

        error_log("User::create - SQL: " . $sql);
        error_log("User::create - Params: " . print_r($params, true));

        // [SAKTONG PAG-AYO] Gidugangan og try-catch block para madakop ang PDOException
        // ug i-re-throw kini para ma-handle sa controller.
        try {
            $stmt = $db->prepare($sql);
            $execResult = $stmt->execute($params);

            if (!$execResult) {
                error_log("User::create - PDO Error: " . print_r($stmt->errorInfo(), true));
                // Kung mapakyas ang execute pero dili mo-throw og exception, maghimo ta og atong kaugalingon.
                throw new PDOException("Failed to execute statement: " . implode(" - ", $stmt->errorInfo()));
            }

            $lastId = $db->lastInsertId();
            error_log("User::create - lastInsertId(): " . $lastId);
            return $lastId;
        } catch (PDOException $e) {
            error_log("User::create - PDOException: " . $e->getMessage());
            throw $e; // I-re-throw ang exception para madakop sa UserController
        }
    }

    /**
     * [GI-AYO PARA SA SEGURIDAD] Authenticates a user by username and verifies the hashed password.
     * @param string $username The user's username.
     * @param string $password The user's plain-text password.
     * @param string|null $role Optional role filter (e.g., 'admin', 'user')
     * @return array|null The user data if authentication is successful, otherwise null.
     */
    public static function authenticate($username, $password, $role = null) {
        error_log("User::authenticate - Attempting login for username: {$username}, role filter: " . ($role ?? 'none'));
        $user = self::findByUsername($username); // Gamiton ang findByUsername para makuha ang usa ra ka user

        if ($user) {
            error_log("User::authenticate - Found user: " . print_r($user, true));
            // Kung naay gipasa nga role, i-check kung tugma ba ang role sa user.
            if ($role && $user['role'] !== $role) {
                error_log("User::authenticate - Role mismatch: Expected '{$role}', got '{$user['role']}'");
                return null; // Dili tugma ang role, dili i-authenticate.
            }
            // Kung walay role nga gipasa (general user login), sigurohon nga dili admin ang ma-authenticate.
            // Kini nga bahin kinahanglan lang kung ang admin mosulay og login sa general user interface.
            if (!$role && $user['role'] === 'admin') {
                error_log("User::authenticate - Admin tried to log in via non-admin interface.");
                return null; // Admin account, pero gi-login sa non-admin interface.
            }

            if (password_verify($password, $user['password'])) {
                error_log("User::authenticate - Password verified successfully.");
                // Kung sakto ang password, i-rehash kung kinahanglan ug i-return ang user.
                if (password_needs_rehash($user['password'], PASSWORD_DEFAULT)) {
                    $newHash = password_hash($password, PASSWORD_DEFAULT);
                    self::update($user['id'], ['password' => $newHash]);
                    error_log("User::authenticate - Password rehashed and updated for user ID: {$user['id']}");
                }
                return $user; // Login successful! Nakit-an ang saktong account.
            } else {
                error_log("User::authenticate - Password verification failed for username: {$username}");
            }
        } else {
            error_log("User::authenticate - User not found for username: {$username}");
        }

        return null; // Kung walay user nga nakit-an o sayop gyud ang password.
    }

    // UPDATE: Modify existing user
    public static function update($id, $data) {
        $db = Database::getInstance();
        $fields = [];
        $params = [':id' => $id];

        // Dynamic update (para flexible kung unsa lang ang i-update)
        foreach ($data as $key => $value) {
            $fields[] = "$key = :$key";
            $params[":$key"] = $value;
        }

        if (empty($fields)) return false;

        $sql = "UPDATE pos_schema.users SET " . implode(", ", $fields) . " WHERE id = :id";
        $stmt = $db->prepare($sql);
        return $stmt->execute($params);
    }

    // [BAG-O] Verify user for password reset (Username + Email match)
    public static function verifyUserForReset($username, $email) {
        $db = Database::getInstance();
        // [GI-AYO] Gigamit ang LOWER() para dili case-sensitive (e.g., 'User' ug 'user' parehas ra)
        $stmt = $db->prepare("SELECT id, role FROM pos_schema.users WHERE LOWER(username) = LOWER(:username) AND LOWER(email) = LOWER(:email)");
        $stmt->execute([':username' => $username, ':email' => $email]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * [BAG-O] Mo-update sa status sa usa ka user.
     * [GI-TANGTANG] Gi-comment out kay wala na ang 'status' column sa 'users' table.
     * @param int $userId Ang ID sa user nga i-update.
     * @param string $newStatus Ang bag-ong status (e.g., 'approved', 'rejected').
     * @return bool True kung malampuson ang pag-update, false kung wala.
     */
    /*
    public static function updateStatus(int $userId, string $newStatus): bool {
        $db = Database::getInstance();
        $stmt = $db->prepare("UPDATE pos_schema.users SET status = :status WHERE id = :id");
        return $stmt->execute([
            ':status' => $newStatus,
            ':id' => $userId
        ]);
    }
    */

    /**
     * [BAG-O] Markahan ang usa ka user nga "viewed" na sa admin (is_new = false).
     * @param int $userId Ang ID sa user.
     * @return bool True kung malampuson, false kung wala.
     */
    public static function markAsViewed(int $userId): bool {
        $db = Database::getInstance();
        $stmt = $db->prepare("UPDATE pos_schema.users SET is_new = FALSE WHERE id = :id");
        return $stmt->execute([':id' => $userId]);
    }


    // DELETE: Remove user
    public static function delete($id) {
        $db = Database::getInstance();
        $stmt = $db->prepare("DELETE FROM pos_schema.users WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
}