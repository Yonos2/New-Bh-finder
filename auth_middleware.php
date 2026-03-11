<?php
/**
 * Middleware para sa Authentication
 * File: public/auth_middleware.php
 */

/**
 * Function para i-authenticate ang user base sa kasamtangang active session.
 *
 * @return array|null Ang data sa user kung naay active session, null kung wala.
 */
function authenticate_user(): ?array {
    // Ang session gisugdan na sa index.php, busa direkta na tang mo-check.
    if (session_status() === PHP_SESSION_NONE) {
        // Kini usa ka fallback kung sa umaabot naay motawag aning file nga wala nagsugod og session.
        session_start();
    }

    // [GI-AYO] Siguraduhon nga ang 'user_info' key anaa gyud sa session ug dili empty.
    // Kini ang mosulbad sa '401 Unauthorized' error kung ang session anaa pero walay sulod.
    if (isset($_SESSION['user_info']) && is_array($_SESSION['user_info'])) {
        return $_SESSION['user_info'];
    }

    return null; // I-return ang null kung walay user nga naka-log in.
}