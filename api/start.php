<?php
require_once __DIR__ . '/common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sz_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$id = strtolower((string)sz_read_request_value('id', ''));
if (!sz_valid_id($id)) {
    sz_json(array('ok' => false, 'error' => 'invalid_id'), 400);
}

$metaPath = sz_meta_path($id);
$fh = @fopen($metaPath, 'c+');
if (!$fh) {
    sz_json(array('ok' => false, 'error' => 'not_found'), 404);
}

if (!@flock($fh, LOCK_EX)) {
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'busy'), 503);
}

rewind($fh);
$meta = json_decode(stream_get_contents($fh), true);
if (!is_array($meta)) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'metadata_failed'), 500);
}

if (sz_is_expired($meta)) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_delete_transfer($id);
    sz_json(array('ok' => false, 'error' => 'expired'), 410);
}

if (!isset($meta['state']) || $meta['state'] !== 'ready') {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'not_ready'), 409);
}

if (empty($meta['once'])) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => true, 'token' => ''), 200);
}

if (isset($meta['download_session_expires']) && (int)$meta['download_session_expires'] > time()) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'one_time_in_progress'), 409);
}

try {
    $token = sz_random_hex(32);
} catch (Exception $e) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'server_random_unavailable'), 500);
}

$meta['download_token_hash'] = hash('sha256', $token);
$meta['download_session_expires'] = time() + DOWNLOAD_SESSION_TTL;

ftruncate($fh, 0);
rewind($fh);
fwrite($fh, json_encode($meta));
fflush($fh);
flock($fh, LOCK_UN);
fclose($fh);
@chmod($metaPath, 0600);

sz_json(array('ok' => true, 'token' => $token), 200);
