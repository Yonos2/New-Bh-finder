<?php
require_once __DIR__ . '/../../core/Database.php';

class BoardingHouseModel {
    // ✅ GET ALL boarding houses
    public static function getAll() {
        // Gibag-o para mokuha lang sa mga 'approved' ug naay owner info
        $db = Database::getInstance();
        $stmt = $db->query("
            SELECT bh.*, u.full_name as owner_name, u.phone as owner_phone 
            FROM pos_schema.boarding_houses bh 
            LEFT JOIN pos_schema.users u ON bh.owner_id = u.id
            WHERE bh.status = 'approved' 
            ORDER BY bh.id
        ");
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($results as &$house) {
            if (!empty($house['image_urls']) && is_string($house['image_urls'])) {
                $house['image_urls'] = json_decode($house['image_urls'], true, 512, JSON_THROW_ON_ERROR);
            }
        }
        return $results;
    }

    // ✅ GET single by ID
    public static function findById($id) {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT bh.*, u.full_name as owner_name, u.phone as owner_phone 
            FROM pos_schema.boarding_houses bh 
            LEFT JOIN pos_schema.users u ON bh.owner_id = u.id
            WHERE bh.id = :id AND bh.status = 'approved'
        ");
        $stmt->execute([':id' => $id]);
        $house = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($house && !empty($house['image_urls']) && is_string($house['image_urls'])) {
            try {
                $house['image_urls'] = json_decode($house['image_urls'], true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException $e) {
                error_log("JSON Decode Error in findById for image_urls: " . $e->getMessage() . " - Data: " . $house['image_urls']);
                $house['image_urls'] = []; // Default to empty array on error
            }
        }
        
        // Decode rooms JSON if present
        if ($house && !empty($house['rooms']) && is_string($house['rooms'])) {
            try {
                $house['rooms'] = json_decode($house['rooms'], true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException $e) {
                error_log("JSON Decode Error in findById for rooms: " . $e->getMessage() . " - Data: " . $house['rooms']);
                $house['rooms'] = []; // Default to empty array on error
            }
        }

        return $house;
    }

    // 🟢 [BAG-O] GET single by ID para sa Admin (bisan unsa nga status)
    public static function findByIdForAdmin($id) {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT bh.*, u.full_name as owner_name, u.phone as owner_phone 
            FROM pos_schema.boarding_houses bh 
            LEFT JOIN pos_schema.users u ON bh.owner_id = u.id
            WHERE bh.id = :id
        ");
        $stmt->execute([':id' => $id]);
        $house = $stmt->fetch(PDO::FETCH_ASSOC);
        // I-decode ang image_urls
        if ($house && !empty($house['image_urls']) && is_string($house['image_urls'])) {
            $house['image_urls'] = json_decode($house['image_urls'], true, 512, JSON_THROW_ON_ERROR);
        }
        return $house;
    }

    // ✅ GET all by owner_id
    public static function findByOwner($owner_id) {
        error_log("[DEBUG] BoardinghouseModel: findByOwner called with owner_id: " . $owner_id);
        // Gidugangan og owner info
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT bh.*, u.full_name as owner_name, u.phone as owner_phone 
            FROM pos_schema.boarding_houses bh 
            LEFT JOIN pos_schema.users u ON bh.owner_id = u.id
            WHERE bh.owner_id = :owner_id 
            ORDER BY bh.id
        ");
        $stmt->execute([':owner_id' => $owner_id]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log("[DEBUG] BoardinghouseModel: findByOwner returned " . count($results) . " results for owner_id: " . $owner_id);
        foreach ($results as &$house) {
            if (!empty($house['image_urls']) && is_string($house['image_urls'])) {
                $house['image_urls'] = json_decode($house['image_urls'], true, 512, JSON_THROW_ON_ERROR);
            }
            // Ensure status field is always present and valid
            if (!isset($house['status']) || $house['status'] === null || $house['status'] === '') {
                $house['status'] = 'pending';
            }
        }
        return $results;
    }

    // ✅ CREATE new boarding house
    public static function create($data) {
        // [GI-AYO] Klaruhon pag-set ang status sa 'pending' sa application level para sigurado.
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("
                INSERT INTO pos_schema.boarding_houses 
                (owner_id, name, address, phone_number, available_rooms, price_per_month, amenities, latitude, longitude, image_urls, beds_per_room, gender_allowed, facebook_link, website_link, rooms, status, terms_and_regulations)
                VALUES (:owner_id, :name, :address, :phone_number, :available_rooms, :price_per_month, :amenities, :latitude, :longitude, :image_urls, :beds_per_room, :gender_allowed, :facebook_link, :website_link, :rooms, :status, :terms_and_regulations)
            ");

            $stmt->execute([
                ':owner_id' => $data['owner_id'] ?? null,
                ':name' => $data['name'],
                ':address' => $data['address'],
                ':phone_number' => $data['phone_number'] ?? null,
                ':available_rooms' => $data['available_rooms'] ?? 0,
                ':price_per_month' => $data['price_per_month'] ?? 0,
                ':amenities' => $data['amenities'] ?? '',
                ':latitude' => $data['latitude'] ?? null,
                ':longitude' => $data['longitude'] ?? null,
                ':image_urls' => $data['image_urls'] ?? '[]',
                ':beds_per_room' => $data['beds_per_room'] ?? 1,
                ':gender_allowed' => $data['gender_allowed'] ?? 'both',
                ':facebook_link' => $data['facebook_link'] ?? null,
                ':website_link' => $data['website_link'] ?? null, // [GI-DUGANG] I-apil ang website link sa pag-save
                ':rooms' => $data['rooms'] ?? json_encode([]),
                ':status' => 'pending', // Siguraduhon nga 'pending' gyud ang status inig create.
                ':terms_and_regulations' => $data['terms_and_regulations'] ?? null
            ]);

            return $db->lastInsertId();

        } catch (PDOException $e) {
            throw new Exception("Database error on create: " . $e->getMessage());
        }
    }

    // ✅ UPDATE existing boarding house
    public static function update($id, $data) {
        try {
            $db = Database::getInstance();
            $fields = [];
            $params = [':id' => $id];

            foreach ($data as $key => $value) {
                $fields[] = "$key = :$key";
                $params[":$key"] = $value;
            }

            if (empty($fields)) return false;

            $sql = "UPDATE pos_schema.boarding_houses SET " . implode(", ", $fields) . " WHERE id = :id";
            $stmt = $db->prepare($sql);
            return $stmt->execute($params);

        } catch (PDOException $e) {
            throw new Exception("Database error on update: " . $e->getMessage());
        }
    }

    // ✅ DELETE boarding house
    public static function delete($id) {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("DELETE FROM pos_schema.boarding_houses WHERE id = :id");
            return $stmt->execute([':id' => $id]);
        } catch (PDOException $e) {
            throw new Exception("Database error on delete: " . $e->getMessage());
        }
    }

    // 🟢 [BAG-O] GET ALL para sa Admin (apil ang pending/rejected)
    public static function getAllForAdmin() {
        $db = Database::getInstance();
        $stmt = $db->query("
            SELECT bh.*, u.full_name as owner_name, u.phone as owner_phone 
            FROM pos_schema.boarding_houses bh 
            LEFT JOIN pos_schema.users u ON bh.owner_id = u.id
            ORDER BY bh.created_at DESC
        ");
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($results as &$house) {
            if (!empty($house['image_urls']) && is_string($house['image_urls'])) {
                $house['image_urls'] = json_decode($house['image_urls'], true);
            }
        }
        return $results;
    }

    // 🟢 [BAG-O] UPDATE status sa boarding house (para sa admin)
    public static function updateStatus($id, $status, $rejection_reason = null) {
        $allowed_statuses = ['approved', 'rejected', 'pending'];
        if (!in_array($status, $allowed_statuses)) {
            return false; // Dili valid ang status
        }

        try {
            $db = Database::getInstance();
            // [GI-AYO] I-update ang rejection_reason kung ang status kay 'rejected'.
            // Kung dili 'rejected', i-set sa NULL para malimpyohan ang daan nga rason.
            $sql = "UPDATE pos_schema.boarding_houses SET status = :status, rejection_reason = :rejection_reason WHERE id = :id";
            $stmt = $db->prepare($sql);
            return $stmt->execute([
                ':status' => $status,
                ':rejection_reason' => ($status === 'rejected') ? $rejection_reason : null,
                ':id' => $id
            ]);
        } catch (PDOException $e) {
            throw new Exception("Database error on status update: " . $e->getMessage());
        }
    }

    /**
     * 🔍 [GI-AYO] Flexible search function para sa public view (name, address, price range).
     * @param array $filters Usa ka associative array sa mga filter (e.g., ['q' => 'test', 'min_price' => 1000, 'max_price' => 2000])
     * @return array Ang resulta sa pagpangita
     */
    public static function search($filters = []) {
        $db = Database::getInstance();
        
        $baseQuery = "
            SELECT bh.*, u.full_name as owner_name, u.phone as owner_phone 
            FROM pos_schema.boarding_houses bh 
            LEFT JOIN pos_schema.users u ON bh.owner_id = u.id
        ";

        $conditions = ["bh.status = 'approved'"];
        $params = [];

        if (!empty($filters['q'])) {
            $conditions[] = "(bh.name ILIKE :term OR bh.address ILIKE :term)";
            $params[':term'] = '%' . $filters['q'] . '%';
        }

        if (!empty($filters['min_price'])) {
            $conditions[] = "bh.price_per_month >= :min_price";
            $params[':min_price'] = (float)$filters['min_price'];
        }

        if (!empty($filters['max_price'])) {
            $conditions[] = "bh.price_per_month <= :max_price";
            $params[':max_price'] = (float)$filters['max_price'];
        }

        if (count($conditions) > 0) {
            $baseQuery .= " WHERE " . implode(' AND ', $conditions);
        }

        $baseQuery .= " ORDER BY bh.price_per_month ASC";

        $stmt = $db->prepare($baseQuery);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // I-decode ang image_urls gikan sa JSON string ngadto sa array
        foreach ($results as &$house) {
            if (!empty($house['image_urls']) && is_string($house['image_urls'])) {
                $house['image_urls'] = json_decode($house['image_urls'], true, 512, JSON_THROW_ON_ERROR);
            }
        }
        return $results;
    }

    /**
     * 🔍 [BAG-O] Search function para sa public view (name or address)
     * @param string $term Ang text nga gipangita
     * @return array Ang resulta sa pagpangita (text search)
     */
    public static function searchText($term) {
        $db = Database::getInstance();

        if (is_numeric($term)) {
            $stmt = $db->prepare("
                SELECT bh.*, u.full_name as owner_name, u.phone as owner_phone 
                FROM pos_schema.boarding_houses bh 
                LEFT JOIN pos_schema.users u ON bh.owner_id = u.id
                WHERE bh.status = 'approved' 
                AND bh.price_per_month = :price
                ORDER BY bh.price_per_month DESC
            ");
            $stmt->execute([':price' => floatval($term)]);
        } else {
            $searchTerm = '%' . $term . '%';
            $stmt = $db->prepare("
                SELECT bh.*, u.full_name as owner_name, u.phone as owner_phone 
                FROM pos_schema.boarding_houses bh 
                LEFT JOIN pos_schema.users u ON bh.owner_id = u.id
                WHERE bh.status = 'approved' 
                AND (bh.name ILIKE :term OR bh.address ILIKE :term)
                ORDER BY bh.id
            ");
            $stmt->execute([':term' => $searchTerm]);
        }
        
        foreach ($results as &$house) {
            if (!empty($house['image_urls']) && is_string($house['image_urls'])) {
                $house['image_urls'] = json_decode($house['image_urls'], true, 512, JSON_THROW_ON_ERROR);
            }
        }
        return $results;
    }

    /**
     * 🔍 [BAG-O] Search function para sa public view (maximum price)
     * @param float $price Ang maximum nga presyo nga gipangita
     * @return array Ang resulta sa pagpangita (price search)
     */
    public static function searchByPrice($price) {
        $db = Database::getInstance();

        // Ipadayon diretso ang pagpangita sa tanan nga ubos o parehas sa presyo.
        $stmt = $db->prepare("
            SELECT bh.*, u.full_name as owner_name, u.phone as owner_phone 
            FROM pos_schema.boarding_houses bh 
            LEFT JOIN pos_schema.users u ON bh.owner_id = u.id
            WHERE bh.status = 'approved' 
            AND bh.price_per_month <= :price
            ORDER BY bh.price_per_month DESC
        ");
        $stmt->execute([':price' => $price]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($results as &$house) { 
            if (!empty($house['image_urls']) && is_string($house['image_urls'])) {
                $house['image_urls'] = json_decode($house['image_urls'], true, 512, JSON_THROW_ON_ERROR);
            }
        }
        return $results;
    }

    /**
     * Rooms helpers for JSONB 'rooms' column
     */
    // Get rooms array (decoded) for a boarding house
    public static function getRooms($boarding_house_id) {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT COALESCE(rooms, '[]'::jsonb) as rooms FROM pos_schema.boarding_houses WHERE id = :id");
        $stmt->execute([':id' => $boarding_house_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return [];
        return json_decode($row['rooms'], true) ?: [];
    }

    // Add a room (room is an associative array). Returns the room id (generated) or false on failure
    public static function addRoom($boarding_house_id, $room) {
        $db = Database::getInstance();

        if (empty($room['id'])) {
            $room['id'] = 'r' . time() . bin2hex(random_bytes(4));
        }

        try {
            $db->beginTransaction();

            $sql = "UPDATE pos_schema.boarding_houses SET rooms = COALESCE(rooms, '[]'::jsonb) || :room::jsonb WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute([':room' => json_encode($room), ':id' => $boarding_house_id]);

            $db->commit();
            return $room['id'];
        } catch (Exception $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw new Exception('Failed to add room: ' . $e->getMessage());
        }
    }

    // Update a room by its id. $updates is associative array of fields to replace for that room.
    public static function updateRoom($boarding_house_id, $room_id, $updates) {
        $db = Database::getInstance();
        try {
            $db->beginTransaction();

            $stmt = $db->prepare("SELECT COALESCE(rooms, '[]'::jsonb) as rooms FROM pos_schema.boarding_houses WHERE id = :id FOR UPDATE");
            $stmt->execute([':id' => $boarding_house_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $rooms = json_decode($row['rooms'], true) ?: [];

            $found = false;
            foreach ($rooms as &$r) {
                if (isset($r['id']) && $r['id'] == $room_id) {
                    $r = array_merge($r, $updates);
                    $found = true;
                    break;
                }
            }

            if (!$found) {
                $db->rollBack();
                return false; // room not found
            }

            $updateStmt = $db->prepare("UPDATE pos_schema.boarding_houses SET rooms = :rooms::jsonb WHERE id = :id");
            $updateStmt->execute([':rooms' => json_encode(array_values($rooms)), ':id' => $boarding_house_id]);

            $db->commit();
            return true;
        } catch (Exception $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw new Exception('Failed to update room: ' . $e->getMessage());
        }
    }

    // Delete a room by id
    public static function deleteRoom($boarding_house_id, $room_id) {
        $db = Database::getInstance();
        try {
            $db->beginTransaction();

            $stmt = $db->prepare("SELECT COALESCE(rooms, '[]'::jsonb) as rooms FROM pos_schema.boarding_houses WHERE id = :id FOR UPDATE");
            $stmt->execute([':id' => $boarding_house_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $rooms = json_decode($row['rooms'], true) ?: [];

            $newRooms = array_values(array_filter($rooms, function($r) use ($room_id) {
                return !(isset($r['id']) && $r['id'] == $room_id);
            }));

            $updateStmt = $db->prepare("UPDATE pos_schema.boarding_houses SET rooms = :rooms::jsonb WHERE id = :id");
            $updateStmt->execute([':rooms' => json_encode($newRooms), ':id' => $boarding_house_id]);

            $db->commit();
            return true;
        } catch (Exception $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw new Exception('Failed to delete room: ' . $e->getMessage());
        }
    }

    // Search boarding houses where any room has price <= $price
    public static function searchByRoomPrice($price) {
        $db = Database::getInstance();

        $stmt = $db->prepare("SELECT DISTINCT bh.*, u.full_name as owner_name, u.phone as owner_phone
            FROM pos_schema.boarding_houses bh
            LEFT JOIN pos_schema.users u ON bh.owner_id = u.id
            WHERE bh.status = 'approved' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(COALESCE(bh.rooms, '[]'::jsonb)) AS r
                WHERE (r->>'price')::numeric <= :price
            )
            ORDER BY bh.id");

        $stmt->execute([':price' => $price]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($results as &$house) { 
            if (!empty($house['image_urls']) && is_string($house['image_urls'])) {
                $house['image_urls'] = json_decode($house['image_urls'], true, 512, JSON_THROW_ON_ERROR);
            }
        }
        return $results;
    }

    /**
     * [BAG-O] Mag-create ug notification para sa owner kung ang iyang BH ma-approve o ma-reject.
     *
     * @param int $bhId Ang ID sa boarding house.
     * @param string $status Ang bag-ong status ('approved' or 'rejected').
     * @return void
     */
    public static function createStatusNotification(int $bhId, string $status): void
    {
        $pdo = Database::getInstance();

        try {
            // 1. Kuhaon ang owner_id ug ngalan sa BH
            $stmt = $pdo->prepare("SELECT owner_id, name FROM pos_schema.boarding_houses WHERE id = ?");
            $stmt->execute([$bhId]);
            $bhInfo = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($bhInfo) {
                $owner_id = $bhInfo['owner_id'];
                $bh_name = $bhInfo['name'];
                $message = "Your boarding house '$bh_name' has been $status.";

                $sql = "INSERT INTO pos_schemanotifications (user_id, bh_id, message) VALUES (?, ?, ?)";
                $stmt_insert = $pdo->prepare($sql);
                $stmt_insert->execute([$owner_id, $bhId, $message]);
            }
        } catch (PDOException $e) {
            error_log("Notification Creation Error: " . $e->getMessage());
        }
    }
}