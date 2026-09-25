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

$meta = sz_load_meta($id);
if ($meta === false) {
    sz_json(array('ok' => false, 'error' => 'not_found'), 404);
}

if (sz_is_expired($meta)) {
    sz_delete_transfer($id);
    sz_json(array('ok' => false, 'error' => 'expired'), 410);
}

if (!isset($meta['state']) || $meta['state'] !== 'uploading') {
    sz_json(array('ok' => false, 'error' => 'not_uploading'), 409);
}

if (!sz_check_upload_token($meta, $token)) {
    sz_json(array('ok' => false, 'error' => 'forbidden'), 403);
}

if (!isset($_FILES['payload']) || $_FILES['payload']['error'] !== UPLOAD_ERR_OK) {
    sz_json(array('ok' => false, 'error' => 'missing_payload'), 400);
}

$size = (int)$_FILES['payload']['size'];
if ($size < 32 || $size > MAX_MANIFEST_BYTES) {
    sz_json(array('ok' => false, 'error' => 'invalid_manifest_size'), 400);
}

$final = sz_manifest_path($id);
$tmp = $final . '.part.' . getmypid();

if (!@move_uploaded_file($_FILES['payload']['tmp_name'], $tmp)) {
    sz_json(array('ok' => false, 'error' => 'store_failed'), 500);
}

@chmod($tmp, 0600);
if (!@rename($tmp, $final)) {
    @unlink($tmp);
    sz_json(array('ok' => false, 'error' => 'store_failed'), 500);
}

@chmod($final, 0600);
sz_json(array('ok' => true), 201);
