<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sz_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$id = strtolower((string)sz_read_request_value('id', ''));
$token = strtolower((string)sz_read_request_value('token', ''));

if (!sz_valid_id($id) || !sz_valid_token($token)) {
    sz_json(array('ok' => false, 'error' => 'invalid_request'), 400);
}

$meta = sz_load_meta($id);
if ($meta === false) {
    sz_json(array('ok' => false, 'error' => 'not_found'), 404);
}

if (
    !isset($meta['delete_token_hash']) ||
    !sz_safe_equals($meta['delete_token_hash'], hash('sha256', $token))
) {
    sz_json(array('ok' => false, 'error' => 'forbidden'), 403);
}

sz_delete_transfer($id);

sz_json(array(
    'ok' => true,
    'deleted' => true
), 200);
