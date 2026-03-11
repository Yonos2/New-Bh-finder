<?php
require_once __DIR__ . '/../../core/Database.php';

class BookingModel {

    /**
     * Maghimo og bag-ong booking sa database.
     *
     * @param array $data Ang data sa booking (bh_id, tenant_id, owner_id, etc.).
     * @return int|null Ang ID sa bag-ong booking kung malampuson, null kung napakyas.
     */
    public static function create(array $data): ?int {
        // [GI-AYO] Gamiton ang saktong Singleton pattern para makuha ang database instance.
        $pdo = Database::getInstance();
        
        $sql = "INSERT INTO pos_schema.bookings (bh_id, tenant_id, owner_id, expiry_date, status) VALUES (?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        
        if ($stmt->execute([
            $data['bh_id'], 
            $data['tenant_id'], 
            $data['owner_id'], 
            $data['expiry_date'], 
            $data['status'] ?? 'pending'
        ])) {
            return $pdo->lastInsertId();
        }
        return null;
    }

    /**
     * Mokuha sa tanang bookings sa usa ka tenant.
     *
     * @param int $tenantId Ang ID sa tenant.
     * @return array Lista sa mga bookings.
     */
    public static function findByTenant(int $tenantId): array {
        // [GI-AYO] Gamiton ang saktong Singleton pattern para makuha ang database instance.
        $pdo = Database::getInstance();
        $sql = "
            SELECT 
                b.id, b.status, b.booking_date, b.expiry_date,
                bh.name AS bh_name, bh.price_per_month
            FROM 
                pos_schema.bookings b
            JOIN 
                pos_schema.boarding_houses bh ON b.bh_id = bh.id
            WHERE 
                b.tenant_id = ?
            ORDER BY b.booking_date DESC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$tenantId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Mokuha sa tanang bookings para sa mga properties sa usa ka owner.
     *
     * @param int $ownerId Ang ID sa owner.
     * @return array Lista sa mga bookings.
     */
    public static function findByOwner(int $ownerId): array {
        // [GI-AYO] Gamiton ang saktong Singleton pattern para makuha ang database instance.
        $pdo = Database::getInstance();
        $sql = "
            SELECT 
                b.id, b.status, b.booking_date, b.expiry_date,
                bh.name AS bh_name, u.full_name AS tenant_name, u.email AS tenant_email,
                u.phone AS tenant_phone
            FROM 
                pos_schema.bookings b
            JOIN 
                pos_schema.boarding_houses bh ON b.bh_id = bh.id
            JOIN
                pos_schema.users u ON b.tenant_id = u.id
            WHERE
                bh.owner_id = ?
            ORDER BY b.booking_date DESC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$ownerId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * [BAG-O] Mokuha sa active booking sa usa ka tenant para sa specific nga boarding house.
     *
     * @param int $tenantId Ang ID sa tenant.
     * @param int $bhId Ang ID sa boarding house.
     * @return array|null Ang booking kung naa, null kung wala.
     */
    public static function findActiveBookingByTenantAndBh(int $tenantId, int $bhId): ?array {
        // [GI-AYO] Gamiton ang saktong Singleton pattern para makuha ang database instance.
        $pdo = Database::getInstance();
        $sql = "SELECT id FROM pos_schema.bookings WHERE tenant_id = ? AND bh_id = ? AND status = 'pending' AND expiry_date > NOW()";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$tenantId, $bhId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    /**
     * [BAG-O] Mo-delete sa usa ka booking.
     * Para sa seguridad, kinahanglan ipasa ang tenant_id para masiguro nga ang user
     * makadelete lang sa iyang kaugalingong booking.
     *
     * @param int $bookingId Ang ID sa booking nga i-delete.
     * @param int $tenantId Ang ID sa tenant nga nanag-iya sa booking.
     * @return bool True kung malampuson ang pag-delete, false kung wala.
     */
    public static function delete(int $bookingId, int $tenantId): bool {
        $pdo = Database::getInstance();
        $sql = "DELETE FROM pos_schema.bookings WHERE id = ? AND tenant_id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$bookingId, $tenantId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * [BAG-O] Mo-delete sa usa ka booking base sa owner ID.
     * Kini nagtugot sa owner nga mag-delete sa booking record sa ilang property.
     *
     * @param int $bookingId Ang ID sa booking.
     * @param int $ownerId Ang ID sa owner.
     * @return bool True kung malampuson.
     */
    public static function deleteByOwner(int $bookingId, int $ownerId): bool {
        $pdo = Database::getInstance();
        $sql = "DELETE FROM pos_schema.bookings WHERE id = :bookingId AND bh_id IN (SELECT id FROM pos_schema.boarding_houses WHERE owner_id = :ownerId)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':bookingId' => $bookingId, ':ownerId' => $ownerId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * [BAG-O] Mo-update sa status sa usa ka booking (e.g., 'approved', 'rejected').
     * Naay security check para masiguro nga ang owner ra sa BH ang maka-update.
     *
     * @param int $bookingId Ang ID sa booking nga i-update.
     * @param string $newStatus Ang bag-ong status.
     * @param int $ownerId Ang ID sa owner nga nag-request sa update.
     * @return bool True kung malampuson, false kung wala.
     */
    public static function updateStatusByOwner(int $bookingId, string $newStatus, int $ownerId): bool
    {
        $pdo = Database::getInstance();
        try {
            $sql = "UPDATE pos_schema.bookings b
                    SET status = :newStatus
                    FROM pos_schema.boarding_houses bh
                    WHERE b.id = :bookingId
                      AND b.bh_id = bh.id
                      AND bh.owner_id = :ownerId";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':newStatus' => $newStatus, ':bookingId' => $bookingId, ':ownerId' => $ownerId]);
            return $stmt->rowCount() > 0; // I-return true kung naay row nga na-update
        } catch (PDOException $e) {
            error_log("Booking status update error: " . $e->getMessage());
            return false;
        }
    }
}