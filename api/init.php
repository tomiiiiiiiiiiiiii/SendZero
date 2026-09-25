<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sz_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$fileSize = (float)sz_read_request_value('file_size', 0);
$ttl = (int)sz_read_request_value('ttl', 86400);
$once = sz_read_request_value('once', '0') === '1';
$allocation = (string)sz_read_request_value('allocation', '');

if ($fileSize <= 0 || $fileSize > MAX_FILE_BYTES) {
    sz_json(array('ok' => false, 'error' => 'invalid_file_size'), 413);
}

if (!in_array($ttl, $GLOBALS['SENDZERO_TTLS'], true)) {
    sz_json(array('ok' => false, 'error' => 'invalid_ttl'), 400);
}

if (!SENDZERO_NODE_ACCEPT_UPLOADS) {
    sz_json(array('ok' => false, 'error' => 'node_not_accepting_uploads'), 503);
}

$free = @disk_free_space(DATA_DIR);
$total = @disk_total_space(DATA_DIR);

if ($free === false) {
    $free = 0;
}
if ($total === false) {
    $total = 0;
}

$usedPercent = $total > 0
    ? max(0.0, min(100.0, (($total - $free) / $total) * 100.0))
    : 100.0;

$required = (float)$fileSize + SENDZERO_NODE_RESERVE_BYTES;

if (
    $free < $required ||
    $free < SENDZERO_NODE_MIN_FREE_BYTES ||
    $usedPercent >= SENDZERO_NODE_MAX_DISK_USED_PERCENT
) {
    sz_json(array(
        'ok' => false,
        'error' => 'node_insufficient_space',
        'disk_used_percent' => round($usedPercent, 2)
    ), 507);
}

$allocationPayload = sz_verify_and_claim_allocation($allocation, $fileSize, $ttl, $once);
if ($allocationPayload === false) {
    sz_json(array('ok' => false, 'error' => 'invalid_allocation'), 403);
}

$clientTag = isset($allocationPayload['client']) &&
    preg_match('/^[a-f0-9]{32}$/', (string)$allocationPayload['client'])
    ? (string)$allocationPayload['client']
    : sz_client_tag();

$chunkCount = (int)ceil($fileSize / CHUNK_BYTES);
if ($chunkCount < 1 || $chunkCount > 10000) {
    sz_json(array('ok' => false, 'error' => 'invalid_chunk_count'), 400);
}

try {
    $id = sz_random_hex(16);
    $uploadToken = sz_random_hex(32);
} catch (Exception $e) {
    sz_json(array('ok' => false, 'error' => 'server_random_unavailable'), 500);
}

$now = time();
$uploadExpiresAt = $now + UPLOAD_SESSION_TTL;

if (!sz_active_upload_acquire($clientTag, $id, $uploadExpiresAt)) {
    sz_json(array(
        'ok' => false,
        'error' => 'too_many_active_uploads'
    ), 429);
}

$dir = sz_transfer_dir($id);
if (!@mkdir($dir, 0700, true)) {
    sz_active_upload_release($clientTag, $id);
    sz_json(array('ok' => false, 'error' => 'store_failed'), 500);
}
$meta = array(
    'version' => 3,
    'node_id' => SENDZERO_NODE_ID,
    'state' => 'uploading',
    'created_at' => $now,
    'expires_at' => $uploadExpiresAt,
    'client_tag' => $clientTag,
    'retention_ttl' => $ttl,
    'file_size' => (int)$fileSize,
    'chunk_size' => CHUNK_BYTES,
    'chunk_count' => $chunkCount,
    'once' => $once ? 1 : 0,
    'upload_token_hash' => hash('sha256', $uploadToken)
);

if (!sz_write_meta($id, $meta)) {
    sz_active_upload_release($clientTag, $id);
    sz_delete_transfer($id);
    sz_json(array('ok' => false, 'error' => 'metadata_failed'), 500);
}

sz_json(array(
    'ok' => true,
    'id' => $id,
    'node_id' => SENDZERO_NODE_ID,
    'upload_token' => $uploadToken,
    'chunk_size' => CHUNK_BYTES,
    'chunk_count' => $chunkCount,
    'max_file_bytes' => MAX_FILE_BYTES
), 201);
