<?php
require_once __DIR__ . '/common.php';

sz_require_role('master');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sz_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$fileSize = (float)sz_read_request_value('file_size', 0);
$ttl = (int)sz_read_request_value('ttl', 86400);
$once = sz_read_request_value('once', '0') === '1';
$requestId = strtolower((string)sz_read_request_value('request_id', ''));

if ($fileSize <= 0 || $fileSize > MAX_FILE_BYTES) {
    sz_json(array('ok' => false, 'error' => 'invalid_file_size'), 413);
}

if (!in_array($ttl, $GLOBALS['SENDZERO_TTLS'], true)) {
    sz_json(array('ok' => false, 'error' => 'invalid_ttl'), 400);
}


$clientTag = sz_client_tag();
$preRate = sz_rate_limit_consume($fileSize, $clientTag, $requestId, false);

if (empty($preRate['ok'])) {
    $retryAfter = isset($preRate['retry_after']) ? max(1, (int)$preRate['retry_after']) : 60;
    header('Retry-After: ' . $retryAfter);

    sz_json(array(
        'ok' => false,
        'error' => isset($preRate['error']) ? $preRate['error'] : 'rate_limited',
        'retry_after' => $retryAfter
    ), 429);
}

$selected = sz_master_choose_node($fileSize);
if ($selected === false) {
    sz_json(array('ok' => false, 'error' => 'no_storage_node_available'), 503);
}

$nodeId = $selected['id'];
$node = $selected['node'];
$secret = sz_master_node_secret($node);


/*
 * Commit the quota only after a healthy node was found. The second locked
 * check also closes the race between simultaneous allocation requests.
 */
$rate = sz_rate_limit_consume($fileSize, $clientTag, $requestId, true);

if (empty($rate['ok'])) {
    $retryAfter = isset($rate['retry_after']) ? max(1, (int)$rate['retry_after']) : 60;
    header('Retry-After: ' . $retryAfter);

    sz_json(array(
        'ok' => false,
        'error' => isset($rate['error']) ? $rate['error'] : 'rate_limited',
        'retry_after' => $retryAfter
    ), 429);
}

if ($secret === '') {
    sz_json(array('ok' => false, 'error' => 'node_not_configured'), 503);
}

try {
    $nonce = sz_random_hex(16);
} catch (Exception $e) {
    sz_json(array('ok' => false, 'error' => 'server_random_unavailable'), 500);
}

$payload = array(
    'v' => 1,
    'node' => $nodeId,
    'size' => (int)$fileSize,
    'ttl' => $ttl,
    'once' => $once ? 1 : 0,
    'client' => $clientTag,
    'exp' => time() + SENDZERO_ALLOCATION_TTL,
    'nonce' => $nonce
);

$token = sz_allocation_sign($payload, $secret);

sz_json(array(
    'ok' => true,
    'node_id' => $nodeId,
    'api_base' => sz_master_node_url($node),
    'allocation_token' => $token,
    'allocation_expires_at' => (int)$payload['exp']
), 200);
