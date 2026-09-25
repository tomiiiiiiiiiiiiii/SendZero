<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

$auth = isset($_SERVER['HTTP_X_SENDZERO_NODE_AUTH'])
    ? $_SERVER['HTTP_X_SENDZERO_NODE_AUTH']
    : '';

try {
    $secret = sz_local_node_secret();
} catch (Exception $e) {
    sz_json(array('ok' => false, 'error' => 'node_secret_unavailable'), 500);
}

if (!sz_verify_node_status_auth($auth, $secret)) {
    sz_json(array('ok' => false, 'error' => 'forbidden'), 403);
}

sz_json(sz_local_node_status(), 200);
