<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sz_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$id = strtolower((string)sz_read_request_value('id', ''));
$token = strtolower((string)sz_read_request_value('token', ''));
$meta = sz_require_ready_meta($id);

if (empty($meta['once'])) {
    sz_json(array('ok' => true, 'deleted' => false), 200);
}

if (!sz_check_download_token($meta, $token)) {
    sz_json(array('ok' => false, 'error' => 'forbidden'), 403);
}

sz_delete_transfer($id);
sz_json(array('ok' => true, 'deleted' => true), 200);
