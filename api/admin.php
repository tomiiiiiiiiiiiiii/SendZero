<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sz_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$action = (string)sz_read_request_value('action', '');
$id = strtolower((string)sz_read_request_value('id', ''));

if (!in_array($action, array('status', 'info', 'delete'), true)) {
    sz_json(array('ok' => false, 'error' => 'invalid_action'), 400);
}

if ($action !== 'status' && !sz_valid_id($id)) {
    sz_json(array('ok' => false, 'error' => 'invalid_id'), 400);
}

$auth = isset($_SERVER['HTTP_X_SENDZERO_ADMIN_AUTH'])
    ? $_SERVER['HTTP_X_SENDZERO_ADMIN_AUTH']
    : '';

try {
    $secret = sz_local_node_secret();
} catch (Exception $e) {
    sz_json(array('ok' => false, 'error' => 'node_secret_unavailable'), 500);
}

if (!sz_verify_admin_auth($auth, $secret, $action, $id)) {
    sz_json(array('ok' => false, 'error' => 'forbidden'), 403);
}

if ($action === 'status') {
    sz_json(array(
        'ok' => true,
        'status' => sz_local_node_status()
    ), 200);
}

$info = sz_admin_transfer_info($id);
if ($info === false) {
    sz_json(array('ok' => false, 'error' => 'not_found'), 404);
}

if ($action === 'info') {
    sz_json(array(
        'ok' => true,
        'transfer' => $info
    ), 200);
}

sz_delete_transfer($id);

sz_json(array(
    'ok' => true,
    'deleted' => true,
    'transfer' => $info
), 200);
