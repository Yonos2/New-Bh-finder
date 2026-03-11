<?php
require_once __DIR__ . '/../../core/Database.php';

class Admin {
    public static function getAll() {
        $db = Database::getInstance();
        $stmt = $db->query("SELECT * FROM pos_schema.users WHERE role = 'admin' ORDER BY id");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function findById($id) {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM pos_schema.users WHERE id = :id AND role = 'admin'");
        $stmt->execute([':id' => $id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public static function create($data) {
        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO pos_schema.users (username, password, full_name, email, phone, role) VALUES (:username, :password, :full_name, :email, :phone, 'admin')");
        $stmt->execute([
            ':username' => $data['username'],
            ':password' => password_hash($data['password'], PASSWORD_DEFAULT),
            ':full_name' => $data['full_name'] ?? null,
            ':email' => $data['email'] ?? null,
            ':phone' => $data['phone'] ?? null,
        ]);
        return $db->lastInsertId();
    }

    public static function update($id, $data) {
        $db = Database::getInstance();
        $fields = [];
        $params = [':id' => $id];
        foreach ($data as $key => $value) {
            $fields[] = "$key = :$key";
            $params[":$key"] = $value;
        }
        if (empty($fields)) return false;
        // 🔧 FIXED: Changed from upos_schema to pos_schema
        $sql = "UPDATE pos_schema.users SET " . implode(", ", $fields) . " WHERE id = :id AND role = 'admin'";
        $stmt = $db->prepare($sql);
        return $stmt->execute($params);
    }

    public static function delete($id) {
        $db = Database::getInstance();
        // 🔧 FIXED: Changed from upos_schema to pos_schema
        $stmt = $db->prepare("DELETE FROM pos_schema.users WHERE id = :id AND role = 'admin'");
        return $stmt->execute([':id' => $id]);
    }

    public static function authenticate($username, $password) {
        $db = Database::getInstance();
        // 🔧 FIXED: Changed from upos_schema to pos_schema
        $stmt = $db->prepare("SELECT * FROM pos_schema.users WHERE username = :username AND role = 'admin' LIMIT 1");
        $stmt->execute([':username' => $username]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($admin && password_verify($password, $admin['password'])) {
            return $admin;
        }
        return null;
    }
}