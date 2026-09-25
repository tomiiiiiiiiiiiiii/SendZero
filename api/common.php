<?php
require_once dirname(__DIR__) . '/config.php';

function sz_json($data, $status) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    sz_apply_cors_headers();
    echo json_encode($data);
    exit;
}

function sz_has_role($role) {
    return SENDZERO_ROLE === 'both' || SENDZERO_ROLE === $role;
}

function sz_require_role($role) {
    if (!sz_has_role($role)) {
        sz_json(array('ok' => false, 'error' => 'role_disabled'), 404);
    }
}

function sz_apply_cors_headers() {
    if (!isset($_SERVER['HTTP_ORIGIN']) || $_SERVER['HTTP_ORIGIN'] === '') {
        return;
    }

    $origin = rtrim($_SERVER['HTTP_ORIGIN'], '/');
    $allowed = isset($GLOBALS['SENDZERO_ALLOWED_ORIGINS'])
        ? $GLOBALS['SENDZERO_ALLOWED_ORIGINS']
        : array();

    if (in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 600');
    }
}

function sz_handle_options() {
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        sz_apply_cors_headers();
        http_response_code(204);
        exit;
    }
}

sz_apply_cors_headers();
sz_handle_options();

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

function sz_valid_node_id($nodeId) {
    return is_string($nodeId) && preg_match('/^[A-Za-z0-9_-]{1,32}$/', $nodeId);
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

function sz_base64url_encode($raw) {
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function sz_base64url_decode($value) {
    $value = strtr($value, '-_', '+/');
    $pad = strlen($value) % 4;
    if ($pad) {
        $value .= str_repeat('=', 4 - $pad);
    }
    return base64_decode($value, true);
}

function sz_local_node_secret() {
    if (SENDZERO_NODE_SECRET !== '') {
        return SENDZERO_NODE_SECRET;
    }

    $path = DATA_DIR . '/.node-secret';
    if (is_file($path)) {
        $secret = trim((string)@file_get_contents($path));
        if (strlen($secret) >= 32) {
            return $secret;
        }
    }

    try {
        $secret = sz_random_hex(32);
    } catch (Exception $e) {
        throw $e;
    }

    if (@file_put_contents($path, $secret . PHP_EOL, LOCK_EX) === false) {
        throw new Exception('Could not persist local node secret.');
    }
    @chmod($path, 0600);
    return $secret;
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
    if (!sz_valid_id($id)) {
        return;
    }

    $meta = sz_load_meta($id);
    if (is_array($meta) && !empty($meta['client_tag'])) {
        sz_active_upload_release((string)$meta['client_tag'], $id);
    }

    sz_delete_tree(sz_transfer_dir($id));
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


/* ---------- client identity / file-based anti-abuse ---------- */

function sz_client_ip() {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? trim((string)$_SERVER['REMOTE_ADDR']) : '';

    if (SENDZERO_CLIENT_IP_HEADER !== '' && isset($_SERVER[SENDZERO_CLIENT_IP_HEADER])) {
        $candidate = trim((string)$_SERVER[SENDZERO_CLIENT_IP_HEADER]);

        /*
         * Some proxy headers may contain a comma-separated chain. When an
         * explicitly trusted header is configured, use the first address.
         */
        if (strpos($candidate, ',') !== false) {
            $parts = explode(',', $candidate);
            $candidate = trim($parts[0]);
        }

        if (filter_var($candidate, FILTER_VALIDATE_IP)) {
            $ip = $candidate;
        }
    }

    if (!filter_var($ip, FILTER_VALIDATE_IP)) {
        $ip = '0.0.0.0';
    }

    return $ip;
}

function sz_rate_secret() {
    $path = DATA_DIR . '/.rate-secret';

    if (is_file($path)) {
        $secret = trim((string)@file_get_contents($path));
        if (strlen($secret) >= 32) {
            return $secret;
        }
    }

    $secret = sz_random_hex(32);
    if (@file_put_contents($path, $secret . PHP_EOL, LOCK_EX) === false) {
        throw new Exception('Could not persist rate-limit secret.');
    }

    @chmod($path, 0600);
    return $secret;
}

function sz_client_tag() {
    try {
        $secret = sz_rate_secret();
    } catch (Exception $e) {
        /*
         * Fail closed to one shared bucket rather than storing raw IPs or
         * silently disabling abuse protection.
         */
        return str_repeat('0', 32);
    }

    return substr(hash_hmac('sha256', sz_client_ip(), $secret), 0, 32);
}

function sz_rate_limit_consume($fileSize, $clientTag, $commit) {
    if (!SENDZERO_RATE_LIMIT_ENABLED) {
        return array('ok' => true, 'retry_after' => 0);
    }

    if (!preg_match('/^[a-f0-9]{32}$/', $clientTag)) {
        return array('ok' => false, 'error' => 'rate_limit_identity_failed', 'retry_after' => 60);
    }

    $dir = DATA_DIR . '/.ratelimit';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        return array('ok' => false, 'error' => 'rate_limit_unavailable', 'retry_after' => 60);
    }

    $path = $dir . '/' . $clientTag . '.json';
    $fh = @fopen($path, 'c+');
    if (!$fh) {
        return array('ok' => false, 'error' => 'rate_limit_unavailable', 'retry_after' => 60);
    }

    if (!@flock($fh, LOCK_EX)) {
        fclose($fh);
        return array('ok' => false, 'error' => 'rate_limit_busy', 'retry_after' => 10);
    }

    rewind($fh);
    $state = json_decode(stream_get_contents($fh), true);
    if (!is_array($state)) {
        $state = array();
    }

    $now = time();
    $hourStart = (int)(floor($now / 3600) * 3600);
    $dayStart = (int)(floor($now / 86400) * 86400);

    if (!isset($state['hour_start']) || (int)$state['hour_start'] !== $hourStart) {
        $state['hour_start'] = $hourStart;
        $state['hour_count'] = 0;
    }

    if (!isset($state['day_start']) || (int)$state['day_start'] !== $dayStart) {
        $state['day_start'] = $dayStart;
        $state['day_bytes'] = 0;
    }

    $hourCount = isset($state['hour_count']) ? (int)$state['hour_count'] : 0;
    $dayBytes = isset($state['day_bytes']) ? (float)$state['day_bytes'] : 0;

    if (
        SENDZERO_RATE_MAX_ALLOCATIONS_PER_HOUR > 0 &&
        $hourCount >= SENDZERO_RATE_MAX_ALLOCATIONS_PER_HOUR
    ) {
        @flock($fh, LOCK_UN);
        fclose($fh);

        return array(
            'ok' => false,
            'error' => 'too_many_transfers',
            'retry_after' => max(1, ($hourStart + 3600) - $now)
        );
    }

    if (
        SENDZERO_RATE_MAX_BYTES_PER_DAY > 0 &&
        $dayBytes + (float)$fileSize > SENDZERO_RATE_MAX_BYTES_PER_DAY
    ) {
        @flock($fh, LOCK_UN);
        fclose($fh);

        return array(
            'ok' => false,
            'error' => 'daily_transfer_limit',
            'retry_after' => max(1, ($dayStart + 86400) - $now)
        );
    }

    if (!$commit) {
        @flock($fh, LOCK_UN);
        fclose($fh);
        return array('ok' => true, 'retry_after' => 0);
    }

    $state['hour_count'] = $hourCount + 1;
    $state['day_bytes'] = $dayBytes + (float)$fileSize;
    $state['updated_at'] = $now;

    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($state));
    fflush($fh);
    @flock($fh, LOCK_UN);
    fclose($fh);
    @chmod($path, 0600);

    return array('ok' => true, 'retry_after' => 0);
}

function sz_active_uploads_path($clientTag) {
    return DATA_DIR . '/.active_uploads/' . $clientTag . '.json';
}

function sz_active_upload_acquire($clientTag, $id, $expiresAt) {
    if (SENDZERO_NODE_MAX_ACTIVE_UPLOADS_PER_CLIENT <= 0) {
        return true;
    }

    if (!preg_match('/^[a-f0-9]{32}$/', $clientTag) || !sz_valid_id($id)) {
        return false;
    }

    $dir = DATA_DIR . '/.active_uploads';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        return false;
    }

    $path = sz_active_uploads_path($clientTag);
    $fh = @fopen($path, 'c+');
    if (!$fh) {
        return false;
    }

    if (!@flock($fh, LOCK_EX)) {
        fclose($fh);
        return false;
    }

    rewind($fh);
    $state = json_decode(stream_get_contents($fh), true);
    if (!is_array($state)) {
        $state = array();
    }

    $now = time();
    foreach ($state as $transferId => $expiry) {
        if (!sz_valid_id($transferId) || (int)$expiry <= $now) {
            unset($state[$transferId]);
        }
    }

    if (!isset($state[$id]) && count($state) >= SENDZERO_NODE_MAX_ACTIVE_UPLOADS_PER_CLIENT) {
        @flock($fh, LOCK_UN);
        fclose($fh);
        return false;
    }

    $state[$id] = (int)$expiresAt;

    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($state));
    fflush($fh);
    @flock($fh, LOCK_UN);
    fclose($fh);
    @chmod($path, 0600);

    return true;
}

function sz_active_upload_release($clientTag, $id) {
    if (!is_string($clientTag) || !preg_match('/^[a-f0-9]{32}$/', $clientTag) || !sz_valid_id($id)) {
        return;
    }

    $path = sz_active_uploads_path($clientTag);
    $fh = @fopen($path, 'c+');
    if (!$fh) {
        return;
    }

    if (!@flock($fh, LOCK_EX)) {
        fclose($fh);
        return;
    }

    rewind($fh);
    $state = json_decode(stream_get_contents($fh), true);
    if (!is_array($state)) {
        $state = array();
    }

    unset($state[$id]);

    if (count($state) === 0) {
        @flock($fh, LOCK_UN);
        fclose($fh);
        @unlink($path);
        return;
    }

    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($state));
    fflush($fh);
    @flock($fh, LOCK_UN);
    fclose($fh);
    @chmod($path, 0600);
}

/* ---------- allocation tokens ---------- */

function sz_allocation_sign($payload, $secret) {
    $json = json_encode($payload);
    $body = sz_base64url_encode($json);
    $sig = hash_hmac('sha256', $body, $secret, true);
    return $body . '.' . sz_base64url_encode($sig);
}

function sz_allocation_verify($token, $secret) {
    if (!is_string($token) || strpos($token, '.') === false) {
        return false;
    }

    list($body, $sigText) = explode('.', $token, 2);
    $sig = sz_base64url_decode($sigText);
    if ($sig === false) {
        return false;
    }

    $expected = hash_hmac('sha256', $body, $secret, true);
    if (!sz_safe_equals($expected, $sig)) {
        return false;
    }

    $json = sz_base64url_decode($body);
    if ($json === false) {
        return false;
    }

    $payload = json_decode($json, true);
    if (!is_array($payload) || !isset($payload['exp']) || (int)$payload['exp'] < time()) {
        return false;
    }

    return $payload;
}

function sz_claim_allocation_nonce($nonce, $expiresAt) {
    if (!is_string($nonce) || !preg_match('/^[a-f0-9]{32}$/', $nonce)) {
        return false;
    }

    $dir = DATA_DIR . '/.allocations';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        return false;
    }

    $path = $dir . '/' . $nonce;
    $fh = @fopen($path, 'x');
    if (!$fh) {
        return false;
    }

    fwrite($fh, (string)$expiresAt);
    fclose($fh);
    @chmod($path, 0600);
    return true;
}

function sz_verify_and_claim_allocation($token, $fileSize, $ttl, $once) {
    if (!SENDZERO_REQUIRE_ALLOCATION) {
        return array(
            'client' => sz_client_tag(),
            'exp' => time() + SENDZERO_ALLOCATION_TTL
        );
    }

    $payload = sz_allocation_verify($token, sz_local_node_secret());
    if ($payload === false) {
        return false;
    }

    if (
        !isset($payload['node']) ||
        $payload['node'] !== SENDZERO_NODE_ID ||
        !isset($payload['size']) ||
        (string)$payload['size'] !== (string)(int)$fileSize ||
        !isset($payload['ttl']) ||
        (int)$payload['ttl'] !== (int)$ttl ||
        !isset($payload['once']) ||
        (int)$payload['once'] !== ($once ? 1 : 0) ||
        !isset($payload['nonce'])
    ) {
        return false;
    }

    if (!sz_claim_allocation_nonce($payload['nonce'], (int)$payload['exp'])) {
        return false;
    }

    return $payload;
}

/* ---------- node status / master dispatcher ---------- */

function sz_local_node_status() {
    $free = @disk_free_space(DATA_DIR);
    $total = @disk_total_space(DATA_DIR);

    if ($free === false) {
        $free = 0;
    }
    if ($total === false) {
        $total = 0;
    }

    $load = 0.0;
    if (function_exists('sys_getloadavg')) {
        $loads = @sys_getloadavg();
        if (is_array($loads) && isset($loads[0])) {
            $load = (float)$loads[0];
        }
    }

    $usedPercent = $total > 0
        ? max(0.0, min(100.0, (($total - $free) / $total) * 100.0))
        : 100.0;

    $diskWarning = $usedPercent >= SENDZERO_NODE_WARN_DISK_USED_PERCENT;

    $accept = SENDZERO_NODE_ACCEPT_UPLOADS &&
        $free >= SENDZERO_NODE_MIN_FREE_BYTES &&
        $usedPercent < SENDZERO_NODE_MAX_DISK_USED_PERCENT;

    return array(
        'ok' => true,
        'node_id' => SENDZERO_NODE_ID,
        'accept_uploads' => $accept,
        'free_bytes' => (float)$free,
        'total_bytes' => (float)$total,
        'disk_used_percent' => round($usedPercent, 2),
        'disk_warning' => $diskWarning,
        'disk_stop_percent' => SENDZERO_NODE_MAX_DISK_USED_PERCENT,
        'load_1m' => $load,
        'time' => time()
    );
}

function sz_node_status_auth($secret, $timestamp) {
    return $timestamp . ':' . hash_hmac('sha256', 'status|' . $timestamp, $secret);
}

function sz_verify_node_status_auth($header, $secret) {
    if (!is_string($header) || strpos($header, ':') === false) {
        return false;
    }

    list($timestamp, $sig) = explode(':', $header, 2);
    if (!ctype_digit((string)$timestamp) || abs(time() - (int)$timestamp) > 60) {
        return false;
    }

    $expected = hash_hmac('sha256', 'status|' . $timestamp, $secret);
    return sz_safe_equals($expected, $sig);
}

function sz_master_nodes() {
    return isset($GLOBALS['SENDZERO_NODES']) && is_array($GLOBALS['SENDZERO_NODES'])
        ? $GLOBALS['SENDZERO_NODES']
        : array();
}

function sz_master_node_secret($node) {
    if (isset($node['secret']) && $node['secret'] === '@local') {
        return sz_local_node_secret();
    }
    return isset($node['secret']) ? (string)$node['secret'] : '';
}

function sz_master_node_url($node) {
    return isset($node['url']) ? rtrim((string)$node['url'], '/') : '';
}

function sz_master_find_node($nodeId) {
    $nodes = sz_master_nodes();
    return isset($nodes[$nodeId]) ? $nodes[$nodeId] : false;
}

function sz_master_probe_node($nodeId, $node) {
    $url = sz_master_node_url($node);

    if ($url === '' && sz_has_role('node') && $nodeId === SENDZERO_NODE_ID) {
        return sz_local_node_status();
    }

    $secret = sz_master_node_secret($node);
    if ($url === '' || $secret === '') {
        return false;
    }

    $timestamp = time();
    $auth = sz_node_status_auth($secret, $timestamp);
    $target = $url . '/api/node_status.php';

    $raw = false;

    if (function_exists('curl_init')) {
        $ch = curl_init($target);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, max(1, (int)ceil(SENDZERO_NODE_STATUS_TIMEOUT)));
        curl_setopt($ch, CURLOPT_TIMEOUT, max(1, (int)ceil(SENDZERO_NODE_STATUS_TIMEOUT + 1)));
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'X-SendZero-Node-Auth: ' . $auth
        ));

        $raw = curl_exec($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($statusCode < 200 || $statusCode >= 300) {
            $raw = false;
        }
    }

    if ($raw === false) {
        $context = stream_context_create(array(
            'http' => array(
                'method' => 'GET',
                'timeout' => SENDZERO_NODE_STATUS_TIMEOUT,
                'ignore_errors' => true,
                'header' => "X-SendZero-Node-Auth: " . $auth . "\r\n"
            )
        ));

        $raw = @file_get_contents($target, false, $context);
    }

    if ($raw === false) {
        return false;
    }

    $data = json_decode($raw, true);
    return is_array($data) && !empty($data['ok']) ? $data : false;
}

function sz_master_choose_node($fileSize) {
    $best = false;
    $bestScore = -1;

    foreach (sz_master_nodes() as $nodeId => $node) {
        if (!sz_valid_node_id($nodeId) || empty($node['enabled'])) {
            continue;
        }

        $status = sz_master_probe_node($nodeId, $node);
        if ($status === false || empty($status['accept_uploads'])) {
            continue;
        }

        $free = isset($status['free_bytes']) ? (float)$status['free_bytes'] : 0;
        $required = (float)$fileSize + SENDZERO_NODE_RESERVE_BYTES;

        if ($free < $required) {
            continue;
        }

        $weight = isset($node['weight']) ? max(1, (int)$node['weight']) : 100;
        $score = ($free / max(1, $required)) * $weight;

        if ($score > $bestScore) {
            $bestScore = $score;
            $best = array(
                'id' => $nodeId,
                'node' => $node,
                'status' => $status
            );
        }
    }

    return $best;
}
