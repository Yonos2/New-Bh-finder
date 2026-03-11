<?php
// server.php - Ang atong simple nga router para sa PHP built-in server

// I-define ang DOCUMENT_ROOT para sa mas klaro ug lig-on nga path resolution
if (!defined('DOCUMENT_ROOT')) {
    define('DOCUMENT_ROOT', __DIR__);
}

// Kini nga bahin mosiguro nga ang PHP built-in server mo-serve sa static files direkta.
// Kung ang request URI motakdo sa usa ka static file extension, i-balik ang FALSE.
// Kung dili, ang request ipasa sa index.php para sa routing.
if (preg_match('/\.(?:png|jpg|jpeg|gif|css|js|html)$/', $_SERVER["REQUEST_URI"])) {
    return false; // I-serve ang asset isip static file
}

// I-pasa ang tanang uban pang requests sa atong main router (index.php)
require_once DOCUMENT_ROOT . '/index.php';