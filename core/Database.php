<?php
class Database {
    private static ?PDO $conn = null;

    public static function getInstance(): PDO {
        if (self::$conn === null) {
            // 🔧 Database configuration
            $host = "localhost";
            $port = "5432";
            $dbname = "BH_db";          // imong database name
            $user = "pos_role";         // ilisi kung lain ang imong PostgreSQL user
            $password = "jayson222000"; // pwede empty kung walay password

            $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";

            try {
                self::$conn = new PDO($dsn, $user, $password, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]);

            } catch (PDOException $e) {
                // JSON output para klaro ug dali masabtan
                header('Content-Type: application/json');
                echo json_encode([
                    "error" => "Database connection failed",
                    "message" => $e->getMessage()
                ]);
                exit;
            }
        }

        return self::$conn;
    }
}