<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sz_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$id = strtolower((string)sz_read_request_value('id', ''));
$token = strtolower((string)sz_read_request_value('token', ''));
$index = (int)sz_read_request_value('index', -1);

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

if ($index < 0 || $index >= (int)$meta['chunk_count']) {
    sz_json(array('ok' => false,'error' => 'invalid_index'), 400);
}

if (!isset($_FILES['payload'])) {
    sz_json(array('ok' => false, 'error' => 'missing_payload'), 400);
}

$uploadError = isset($_FILES['payload']['error'])
    ? (int)$_FILES['payload']['error']
    : UPLOAD_ERR_NO_FILE;

if ($uploadError === UPLOAD_ERR_INI_SIZE || $uploadError === UPLOAD_ERR_FORM_SIZE) {
    sz_json(array(
        'ok' => false,
        'error' => 'request_too_large',
        'limit' => 'upload_max_filesize'
    ), 413);
}

if ($uploadError !== UPLOAD_ERR_OK) {
    sz_json(array(
        'ok' => false,
        'error' => 'upload_failed',
        'upload_error' => $uploadError
    ), 400);
}

$plainSize = min((int)$meta['chunk_size'], (int)$meta['file_size'] - ($index * (int)$meta['chunk_size']));
$expectedSize = $plainSize + 36; // magic(4) + index(4) + IV(12) + GCM tag(16)
$actualSize = (int)$_FILES['payload']['size'];

if ($actualSize !== $expectedSize || $actualSize > MAX_CHUNK_UPLOAD_BYTES) {
    sz_json(array('ok' => false, 'error' => 'invalid_chunk_size'), 400);
}

$final = sz_chunk_path($id, $index);
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

sz_json(array('ok' => true, 'index' => $index), 201);
