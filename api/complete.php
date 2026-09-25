<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sz_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$id = strtolower((string)sz_read_request_value('id', ''));
$token = strtolower((string)sz_read_request_value('token', ''));

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

if (!sz_check_upload_token($meta, $token)) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'forbidden'), 403);
}

if (!is_file(sz_manifest_path($id))) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'manifest_missing'), 409);
}

$chunkCount = (int)$meta['chunk_count'];
for ($i = 0; $i < $chunkCount; $i++) {
    $path = sz_chunk_path($id, $i);
    if (!is_file($path)) {
        flock($fh, LOCK_UN);
        fclose($fh);
        sz_json(array('ok' => false, 'error' => 'chunk_missing', 'index' => $i), 409);
    }

    $plainSize = min((int)$meta['chunk_size'], (int)$meta['file_size'] - ($i * (int)$meta['chunk_size']));
    if ((int)@filesize($path) !== $plainSize + 36) {
        flock($fh, LOCK_UN);
        fclose($fh);
        sz_json(array('ok' => false, 'error' => 'chunk_size_mismatch', 'index' => $i), 409);
    }
}

$now = time();
$meta['state'] = 'ready';
$meta['completed_at'] = $now;
$meta['expires_at'] = $now + (int)$meta['retention_ttl'];
unset($meta['upload_token_hash']);

$json = json_encode($meta);
ftruncate($fh, 0);
rewind($fh);
fwrite($fh, $json);
fflush($fh);
flock($fh, LOCK_UN);
fclose($fh);
@chmod($metaPath, 0600);

sz_json(array(
    'ok' => true,
    'id' => $id,
    'expires_at' => (int)$meta['expires_at'],
    'once' => !empty($meta['once'])
), 200);
