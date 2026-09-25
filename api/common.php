<?php
require_once dirname(__DIR__) . '/config.php';

function sz_json($data, $status) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data);
    exit;
}

function sz_random_hex($bytes) {
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes($bytes));
    }

    if (function_exists('openssl_random_pseudo_bytes')) {
        $strong = false;
        $raw = openssl_random_pseudo_bytes($bytes, $strong);
        if ($raw !== false && $strong) {
            return bin2hex($raw);
        }
    }

    throw new Exception('No cryptographically secure random source available.');
}

function sz_valid_id($id) {
    return is_string($id) && preg_match('/^[a-f0-9]{32}$/', $id);
}

function sz_valid_token($token) {
    return is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token);
}

function sz_safe_equals($a, $b) {
    if (function_exists('hash_equals')) {
        return hash_equals($a, $b);
    }

    if (!is_string($a) || !is_string($b) || strlen($a) !== strlen($b)) {
        return false;
    }

    $result = 0;
    $len = strlen($a);
    for ($i = 0; $i < $len; $i++) {
        $result |= ord($a[$i]) ^ ord($b[$i]);
    }
    return $result === 0;
}

function sz_transfer_dir($id) {
    return DATA_DIR . '/' . $id;
}

function sz_meta_path($id) {
    return sz_transfer_dir($id) . '/meta.json';
}

function sz_manifest_path($id) {
    return sz_transfer_dir($id) . '/manifest.bin';
}

function sz_chunk_path($id, $index) {
    return sz_transfer_dir($id) . '/chunk_' . sprintf('%06d', $index) . '.bin';
}

function sz_load_meta($id) {
    $path = sz_meta_path($id);
    if (!is_file($path)) {
        return false;
    }

    $raw = @file_get_contents($path);
    if ($raw === false) {
        return false;
    }

    $meta = json_decode($raw, true);
    return is_array($meta) ? $meta : false;
}

function sz_write_meta($id, $meta) {
    $path = sz_meta_path($id);
    $tmp = $path . '.tmp.' . getmypid() . '.' . mt_rand(1000, 999999);
    $json = json_encode($meta);

    if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
        return false;
    }

    @chmod($tmp, 0600);
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return false;
    }

    @chmod($path, 0600);
    return true;
}

function sz_delete_tree($path) {
    if (!file_exists($path)) {
        return;
    }

    if (is_file($path) || is_link($path)) {
        @unlink($path);
        return;
    }

    $items = @scandir($path);
    if (is_array($items)) {
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            sz_delete_tree($path . '/' . $item);
        }
    }

    @rmdir($path);
}

function sz_delete_transfer($id) {
    if (sz_valid_id($id)) {
        sz_delete_tree(sz_transfer_dir($id));
    }
}

function sz_is_expired($meta) {
    return !isset($meta['expires_at']) || (int)$meta['expires_at'] <= time();
}

function sz_require_ready_meta($id) {
    if (!sz_valid_id($id)) {
        sz_json(array('ok' => false, 'error' => 'invalid_id'), 400);
    }

    $meta = sz_load_meta($id);
    if ($meta === false) {
        sz_json(array('ok' => false, 'error' => 'not_found'), 404);
    }

    if (sz_is_expired($meta)) {
        sz_delete_transfer($id);
        sz_json(array('ok' => false, 'error' => 'expired'), 410);
    }

    if (!isset($meta['state']) || $meta['state'] !== 'ready') {
        sz_json(array('ok' => false, 'error' => 'not_ready'), 409);
    }

    return $meta;
}

function sz_check_upload_token($meta, $token) {
    if (!sz_valid_token($token) || !isset($meta['upload_token_hash'])) {
        return false;
    }
    return sz_safe_equals($meta['upload_token_hash'], hash('sha256', $token));
}

function sz_check_download_token($meta, $token) {
    if (empty($meta['once'])) {
        return true;
    }

    if (!sz_valid_token($token) || !isset($meta['download_token_hash'])) {
        return false;
    }

    if (!isset($meta['download_session_expires']) || (int)$meta['download_session_expires'] <= time()) {
        return false;
    }

    return sz_safe_equals($meta['download_token_hash'], hash('sha256', $token));
}

function sz_read_request_value($name, $default) {
    if (isset($_POST[$name])) {
        return $_POST[$name];
    }
    return $default;
}
