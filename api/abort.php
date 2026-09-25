<?php
require_once __DIR__ . '/common.php';

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

if (empty($meta['once'])) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => true), 200);
}

if (!sz_check_download_token($meta, $token)) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'forbidden'), 403);
}

unset($meta['download_token_hash']);
unset($meta['download_session_expires']);

ftruncate($fh, 0);
rewind($fh);
fwrite($fh, json_encode($meta));
fflush($fh);
flock($fh, LOCK_UN);
fclose($fh);

sz_json(array('ok' => true), 200);
